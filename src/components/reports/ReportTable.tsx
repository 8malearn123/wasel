import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown,
  FileSearch, Inbox, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import {
  runReport, initialState, orderedColumns,
  PAGE_SIZES, type ReportDefinition, type ReportState,
} from '@/lib/reportEngine';
import { fmtCount, fmtDate, fmtMoney, fmtNumber } from '@/lib/reportFormat';
import { ReportFilters } from './ReportFilters';
import { ReportExport } from './ReportExport';
import { ReportStats } from './ReportStats';

interface Props<Row> {
  definition: ReportDefinition<Row>;
  rows: Row[];
  loading?: boolean;
  /** A failed load, so the user is told rather than shown an empty table */
  error?: string | null;
  onRetry?: () => void;
  /** Shown when there is no data at all, before any filter */
  emptyText?: string;
}

/**
 * One table for every report.
 *
 * Stats, filters, search, sort, column choice and order, paging and export all
 * come from the report definition, so adding a report is a definition — no new
 * screen. Three things worth knowing:
 *
 *  - The stats are computed over the rows the filters left, so they answer for
 *    what is on screen rather than for the whole table.
 *  - Export covers those same rows, not the page being looked at.
 *  - A failed load is an error with a retry, never an empty table: "no data"
 *    and "the request failed" are different answers and used to look alike.
 */
export function ReportTable<Row>({
  definition, rows, loading, error, onRetry, emptyText,
}: Props<Row>) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [state, setState] = useState<ReportState>(() => initialState(definition));

  // A different report means different columns; carrying the old visibleColumns
  // over would leave the table with keys this definition has never heard of.
  useEffect(() => { setState(initialState(definition)); }, [definition]);

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

  const filtered =
    Boolean(state.search.trim() || state.from || state.to) ||
    Object.values(state.filters).some(Boolean);

  const rowKey = (row: Row, index: number) =>
    definition.rowKey?.(row) ?? `${(state.page - 1) * state.pageSize + index}`;

  return (
    <div className="space-y-4">
      <ReportFilters
        definition={definition}
        rows={rows}
        state={state}
        onChange={patch}
        invalidRange={result.invalidRange}
      />

      {!loading && !error && result.stats.length > 0 && (
        <ReportStats stats={result.stats} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? (t ? 'جارٍ التحميل…' : 'Loading…')
            : t
              ? `${fmtCount(result.total)} صف${filtered ? ' مطابق للتصفية' : ''}`
              : `${fmtCount(result.total)} row${result.total === 1 ? '' : 's'}${filtered ? ' matching' : ''}`}
        </p>
        <ReportExport
          definition={definition}
          state={state}
          onChange={patch}
          rows={result.allMatching}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* max-h keeps the sticky header useful: the body scrolls under it
            rather than the whole page scrolling past it */}
        <div className="max-h-[65vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-border bg-muted/80 backdrop-blur hover:bg-muted/80">
                {columns.map(column => {
                  const sorted = state.sortKey === column.key;
                  return (
                    <TableHead
                      key={column.key}
                      aria-sort={sorted ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn(
                        'h-11 whitespace-nowrap p-0 text-xs font-semibold text-foreground',
                        column.align === 'center' && 'text-center',
                        column.align === 'end' && 'text-end',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex h-11 w-full items-center gap-1.5 px-4 transition-colors hover:text-primary',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          column.align === 'center' && 'justify-center',
                          column.align === 'end' && 'justify-end',
                        )}
                        title={t ? `ترتيب حسب ${column.header}` : `Sort by ${column.header}`}
                      >
                        {column.header}
                        {sorted
                          ? (state.sortDirection === 'asc'
                              ? <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
                              : <ArrowDown className="h-3 w-3 shrink-0 text-primary" />)
                          : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-25" />}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, row) => (
                  <TableRow key={`skeleton-${row}`} className="border-border/60 hover:bg-transparent">
                    {columns.map(column => (
                      <TableCell key={column.key} className="h-12 px-4">
                        <Skeleton className="h-3.5 w-full max-w-[8rem]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <TriangleAlert className="h-10 w-10 text-destructive" />
                      <div>
                        <p className="font-medium text-foreground">
                          {t ? 'تعذّر تحميل التقرير' : 'The report could not be loaded'}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
                      </div>
                      {onRetry && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
                          <RefreshCw className="h-4 w-4" />
                          {t ? 'إعادة المحاولة' : 'Try again'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : result.total === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      {filtered || result.invalidRange ? (
                        <>
                          <FileSearch className="h-10 w-10 text-muted-foreground/60" />
                          <div>
                            <p className="font-medium text-foreground">
                              {t ? 'لا نتائج مطابقة' : 'Nothing matches'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {result.invalidRange
                                ? (t ? 'نطاق التاريخ معكوس.' : 'The date range is reversed.')
                                : (t ? 'جرّب توسيع التصفية أو إعادة تعيينها.' : 'Try widening or resetting the filters.')}
                            </p>
                          </div>
                          {!result.invalidRange && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => patch({ search: '', from: null, to: null, filters: {} })}
                            >
                              {t ? 'إعادة تعيين التصفية' : 'Reset filters'}
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Inbox className="h-10 w-10 text-muted-foreground/60" />
                          <p className="font-medium text-foreground">
                            {emptyText || (t ? 'لا توجد بيانات بعد' : 'No data yet')}
                          </p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((row, index) => (
                  <TableRow key={rowKey(row, index)} className="border-border/60">
                    {columns.map(column => {
                      const numeric = column.type === 'number' || column.type === 'money';
                      return (
                        <TableCell
                          key={column.key}
                          className={cn(
                            'h-12 max-w-[20rem] truncate px-4 py-2',
                            column.align === 'center' && 'text-center',
                            column.align === 'end' && 'text-end',
                            numeric && 'tabular-nums',
                            // an identifier is read character by character, so it
                            // keeps Latin order even on an RTL page
                            column.type === 'id' && 'font-mono text-xs',
                          )}
                          title={column.render ? undefined : plainText(column.value(row))}
                        >
                          {column.render
                            ? column.render(row)
                            : formatCell(column.value(row), column.type, isRTL)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && !error && result.total > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm">
            <Select value={String(state.pageSize)} onValueChange={v => patch({ pageSize: Number(v) })}>
              <SelectTrigger className="h-9 w-32" aria-label={t ? 'عدد الصفوف في الصفحة' : 'Rows per page'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {t ? `${size} / صفحة` : `${size} / page`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">
              {t
                ? `الصفوف ${fmtCount((state.page - 1) * state.pageSize + 1)}–${fmtCount(Math.min(state.page * state.pageSize, result.total))} من ${fmtCount(result.total)}`
                : `${fmtCount((state.page - 1) * state.pageSize + 1)}–${fmtCount(Math.min(state.page * state.pageSize, result.total))} of ${fmtCount(result.total)}`}
            </span>

            <div className="ms-auto flex items-center gap-1">
              <Button
                variant="outline" size="sm" className="h-9 px-2"
                aria-label={t ? 'الصفحة السابقة' : 'Previous page'}
                disabled={state.page <= 1} onClick={() => patch({ page: state.page - 1 })}
              >
                {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <span className="px-2 tabular-nums text-muted-foreground">
                {state.page} / {result.pageCount}
              </span>
              <Button
                variant="outline" size="sm" className="h-9 px-2"
                aria-label={t ? 'الصفحة التالية' : 'Next page'}
                disabled={state.page >= result.pageCount} onClick={() => patch({ page: state.page + 1 })}
              >
                {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The cell's text, for the title attribute that reveals a truncated value */
function plainText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function formatCell(value: unknown, type: string | undefined, isRTL: boolean) {
  if (value === null || value === undefined || value === '') return '—';

  if (value instanceof Date || type === 'date') return fmtDate(value, isRTL);
  if (type === 'money' && typeof value === 'number') return fmtMoney(value, isRTL);
  if (type === 'number' && typeof value === 'number') return fmtNumber(value);
  if (typeof value === 'boolean') return value ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No');
  return String(value);
}
