import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download, FileSpreadsheet,
  Search, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import {
  runReport, initialState, orderedColumns, toSheetColumns,
  PAGE_SIZES, type ReportDefinition, type ReportState,
} from '@/lib/reportEngine';
import { downloadXlsx, downloadCsv } from '@/lib/xlsx';

interface Props<Row> {
  definition: ReportDefinition<Row>;
  rows: Row[];
  loading?: boolean;
  /** Shown when there is no data at all, before any filter */
  emptyText?: string;
}

/**
 * One table for every report.
 *
 * Search, period, sort, column choice and order, paging and export all come
 * from the report definition, so adding a report is a definition — no new
 * screen. Export covers every matching row, not the page on screen.
 */
export function ReportTable<Row>({ definition, rows, loading, emptyText }: Props<Row>) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [state, setState] = useState<ReportState>(() => initialState(definition));

  const columns = useMemo(() => orderedColumns(definition, state), [definition, state]);
  const result = useMemo(() => runReport(definition, rows, state), [definition, rows, state]);

  // Any change to what is matched sends the user back to page one, or they
  // land on an empty page after narrowing the search.
  const patch = (next: Partial<ReportState>) =>
    setState(s => ({ ...s, ...next, page: 'page' in next ? (next.page as number) : 1 }));

  const toggleSort = (key: string) =>
    setState(s => ({
      ...s,
      sortKey: key,
      sortDirection: s.sortKey === key && s.sortDirection === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));

  const toggleColumn = (key: string) =>
    setState(s => ({
      ...s,
      visibleColumns: s.visibleColumns.includes(key)
        ? s.visibleColumns.filter(k => k !== key)
        : [...s.visibleColumns, key],
    }));

  const moveColumn = (key: string, delta: number) =>
    setState(s => {
      const next = [...s.visibleColumns];
      const index = next.indexOf(key);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= next.length) return s;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...s, visibleColumns: next };
    });

  const fileName = `${definition.key}-${new Date().toISOString().slice(0, 10)}`;

  const exportXlsx = () =>
    downloadXlsx(fileName, [{
      name: definition.title,
      columns: toSheetColumns(columns),
      rows: result.allMatching,
      rightToLeft: isRTL,
    }]);

  const exportCsv = () => downloadCsv(fileName, toSheetColumns(columns), result.allMatching);

  const filtered = Boolean(state.search || state.from || state.to);
  const orderedKeys = [
    ...state.visibleColumns,
    ...definition.columns.map(c => c.key).filter(k => !state.visibleColumns.includes(k)),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input
            value={state.search}
            onChange={e => patch({ search: e.target.value })}
            placeholder={t ? 'ابحث في التقرير' : 'Search this report'}
            className="ps-9"
          />
        </div>

        {definition.dateKey && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">{t ? 'من' : 'From'}</Label>
              <Input type="date" value={state.from ?? ''} className="h-10"
                onChange={e => patch({ from: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t ? 'إلى' : 'To'}</Label>
              <Input type="date" value={state.to ?? ''} className="h-10"
                onChange={e => patch({ to: e.target.value || null })} />
            </div>
          </>
        )}

        {filtered && (
          <Button variant="ghost" size="sm" className="gap-1"
            onClick={() => patch({ search: '', from: null, to: null })}>
            <X className="w-3.5 h-3.5" />
            {t ? 'مسح' : 'Clear'}
          </Button>
        )}

        <div className="flex items-center gap-2 ms-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Columns3 className="w-4 h-4" />
                {t ? 'الأعمدة' : 'Columns'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <p className="text-xs text-muted-foreground px-2 pb-2">
                {t ? 'اختر الأعمدة ورتّبها' : 'Choose and order the columns'}
              </p>
              {orderedKeys.map(key => {
                const column = definition.columns.find(c => c.key === key);
                if (!column) return null;
                const shown = state.visibleColumns.includes(key);
                const position = state.visibleColumns.indexOf(key);
                return (
                  <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                    <Checkbox id={`col-${key}`} checked={shown} onCheckedChange={() => toggleColumn(key)} />
                    <label htmlFor={`col-${key}`} className="text-sm flex-1 cursor-pointer truncate">
                      {column.header}
                    </label>
                    {shown && (
                      <div className="flex gap-0.5">
                        <button type="button" className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          disabled={position === 0} onClick={() => moveColumn(key, -1)}
                          title={t ? 'للأعلى' : 'Up'}>
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button type="button" className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          disabled={position === state.visibleColumns.length - 1} onClick={() => moveColumn(key, 1)}
                          title={t ? 'للأسفل' : 'Down'}>
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" className="gap-2" onClick={exportXlsx} disabled={result.total === 0}>
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={result.total === 0}>
            <Download className="w-4 h-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => {
                  const sorted = state.sortKey === column.key;
                  return (
                    <TableHead
                      key={column.key}
                      className={cn(
                        'cursor-pointer select-none whitespace-nowrap',
                        column.align === 'center' && 'text-center',
                        column.align === 'end' && 'text-end',
                      )}
                      onClick={() => toggleSort(column.key)}
                      aria-sort={sorted ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span className="inline-flex items-center gap-1">
                        {column.header}
                        {sorted
                          ? (state.sortDirection === 'asc'
                              ? <ArrowUp className="w-3 h-3" />
                              : <ArrowDown className="w-3 h-3" />)
                          : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    {t ? 'جارٍ التحميل…' : 'Loading…'}
                  </TableCell>
                </TableRow>
              ) : result.total === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    {filtered
                      ? (t ? 'لا نتائج مطابقة لهذه التصفية' : 'Nothing matches these filters')
                      : (emptyText || (t ? 'لا توجد بيانات' : 'No data'))}
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map(column => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'end' && 'text-end',
                          (column.type === 'number' || column.type === 'money') && 'tabular-nums',
                        )}
                      >
                        {column.render ? column.render(row) : formatCell(column.value(row), column.type, isRTL)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {result.total > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-border text-sm">
            <span className="text-muted-foreground">
              {t
                ? `${result.total.toLocaleString('ar-SA')} صف`
                : `${result.total.toLocaleString()} rows`}
            </span>

            <Select value={String(state.pageSize)} onValueChange={v => patch({ pageSize: Number(v) })}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {t ? `${size} / صفحة` : `${size} / page`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 ms-auto">
              <Button variant="outline" size="sm" className="h-8 px-2"
                disabled={state.page <= 1} onClick={() => patch({ page: state.page - 1 })}>
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              <span className="px-2 tabular-nums text-muted-foreground">
                {state.page} / {result.pageCount}
              </span>
              <Button variant="outline" size="sm" className="h-8 px-2"
                disabled={state.page >= result.pageCount} onClick={() => patch({ page: state.page + 1 })}>
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(value: unknown, type: string | undefined, isRTL: boolean) {
  if (value === null || value === undefined || value === '') return '—';
  const locale = isRTL ? 'ar-SA' : 'en-US';

  if (value instanceof Date) return value.toLocaleDateString(locale);
  if (type === 'money' && typeof value === 'number') {
    return `${value.toLocaleString(locale)} ${isRTL ? 'ر.س' : 'SAR'}`;
  }
  if (type === 'number' && typeof value === 'number') return value.toLocaleString(locale);
  if (type === 'date') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(locale);
  }
  if (typeof value === 'boolean') return value ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No');
  return String(value);
}
