import { useState } from 'react';
import { ArrowDown, ArrowUp, Columns3, Download, FileSpreadsheet, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/i18n';
import { downloadCsv, downloadXlsx } from '@/lib/xlsx';
import {
  initialState, orderedColumns, toSheetColumns,
  type ReportColumn, type ReportDefinition, type ReportState,
} from '@/lib/reportEngine';

interface Props<Row> {
  definition: ReportDefinition<Row>;
  state: ReportState;
  onChange: (next: Partial<ReportState>) => void;
  /** every row the filters left, not the page on screen */
  rows: Row[];
}

/**
 * Column choice and export for a report.
 *
 * Two things it is careful about. It exports `rows` — everything the filters
 * left — rather than the page being looked at, because a report someone
 * exports is the answer to their filter, not to their scroll position. And it
 * only says the file was written once the writer returned: the old page-local
 * exporter showed "تم التصدير" even when it had bailed out on an empty array.
 */
export function ReportExport<Row>({ definition, state, onChange, rows }: Props<Row>) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [busy, setBusy] = useState<'csv' | 'xlsx' | null>(null);

  const columns = orderedColumns(definition, state);
  const empty = rows.length === 0 || columns.length === 0;
  const fileName = `${definition.key}-${new Date().toISOString().slice(0, 10)}`;

  const run = (kind: 'csv' | 'xlsx', write: () => void) => {
    if (empty) {
      toast.error(t ? 'لا توجد صفوف لتصديرها' : 'There are no rows to export');
      return;
    }
    setBusy(kind);
    try {
      write();
      toast.success(
        t ? `تم تصدير ${rows.length.toLocaleString('en-US')} صف` : `Exported ${rows.length} rows`,
      );
    } catch (error) {
      // Saying nothing, or saying "done", would leave the user looking for a
      // file that was never written
      toast.error(
        t ? 'فشل التصدير' : 'The export failed',
        { description: error instanceof Error ? error.message : undefined },
      );
    } finally {
      setBusy(null);
    }
  };

  const exportXlsx = () =>
    run('xlsx', () => downloadXlsx(fileName, [{
      name: definition.title,
      columns: toSheetColumns(columns),
      rows,
      rightToLeft: isRTL,
    }]));

  const exportCsv = () =>
    run('csv', () => downloadCsv(fileName, toSheetColumns(columns), rows));

  const toggleColumn = (key: string) =>
    onChange({
      visibleColumns: state.visibleColumns.includes(key)
        ? state.visibleColumns.filter(k => k !== key)
        : [...state.visibleColumns, key],
    });

  const moveColumn = (key: string, delta: number) => {
    const next = [...state.visibleColumns];
    const index = next.indexOf(key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ visibleColumns: next });
  };

  const resetColumns = () =>
    onChange({ visibleColumns: initialState(definition).visibleColumns });

  // shown columns in their chosen order, then the hidden ones
  const listed: ReportColumn<Row>[] = [
    ...state.visibleColumns
      .map(key => definition.columns.find(c => c.key === key))
      .filter((c): c is ReportColumn<Row> => Boolean(c)),
    ...definition.columns.filter(c => !state.visibleColumns.includes(c.key)),
  ];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 gap-2">
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t ? 'الأعمدة' : 'Columns'}</span>
            <span className="tabular-nums text-muted-foreground">
              {state.visibleColumns.length}/{definition.columns.length}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-2">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs text-muted-foreground">
              {t ? 'اختر الأعمدة ورتّبها' : 'Choose and order the columns'}
            </p>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={resetColumns}>
              <RotateCcw className="h-3 w-3" />
              {t ? 'إعادة تعيين' : 'Reset'}
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {listed.map(column => {
              const shown = state.visibleColumns.includes(column.key);
              const position = state.visibleColumns.indexOf(column.key);
              const last = shown && position === state.visibleColumns.length - 1;
              return (
                <div key={column.key} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                  <Checkbox
                    id={`col-${definition.key}-${column.key}`}
                    checked={shown}
                    // the table needs at least one column to render a row into
                    disabled={shown && state.visibleColumns.length === 1}
                    onCheckedChange={() => toggleColumn(column.key)}
                  />
                  <label
                    htmlFor={`col-${definition.key}-${column.key}`}
                    className="flex-1 cursor-pointer truncate text-sm"
                  >
                    {column.header}
                  </label>
                  {shown && (
                    <div className="flex gap-0.5">
                      <button
                        type="button" disabled={position === 0}
                        onClick={() => moveColumn(column.key, -1)}
                        aria-label={t ? 'تقديم العمود' : 'Move column earlier'}
                        className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button" disabled={last}
                        onClick={() => moveColumn(column.key, 1)}
                        aria-label={t ? 'تأخير العمود' : 'Move column later'}
                        className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 gap-2" onClick={exportXlsx} disabled={empty || busy !== null}>
            {busy === 'xlsx'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t ? 'ملف Excel بكل الصفوف المطابقة للتصفية' : 'An Excel file of every row matching the filters'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="h-10 gap-2" onClick={exportCsv} disabled={empty || busy !== null}>
            {busy === 'csv'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            CSV
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t ? 'نص CSV بترميز UTF-8، يفتح العربية في Excel' : 'UTF-8 CSV, so Arabic opens correctly in Excel'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
