import type { CellValue, SheetColumn } from './xlsx';

/**
 * The shape of a report, so adding one is a definition rather than a screen.
 *
 * A report is a list of columns over a list of rows. Everything the table does
 * — searching, filtering, sorting, choosing and ordering columns, paging — is
 * derived from the column definitions, so a new report needs no new UI.
 */

export type ColumnType = 'text' | 'number' | 'money' | 'date' | 'badge' | 'id';

export interface ReportColumn<Row> {
  key: string;
  header: string;
  type?: ColumnType;
  /** The value shown and exported. Keep it a primitive so sorting works. */
  value: (row: Row) => CellValue;
  /** Shown instead of value() in the table, when a plain value reads badly */
  render?: (row: Row) => React.ReactNode;
  width?: number;
  /** Hidden until the user picks it in the column menu */
  defaultHidden?: boolean;
  /** Excluded from the free-text search box */
  notSearchable?: boolean;
  align?: 'start' | 'center' | 'end';
  /**
   * Offer a dropdown of this column's distinct values. The options come from
   * the rows themselves, so a report never shows a filter for a category no
   * row has — and never needs a hardcoded list that drifts from the data.
   */
  filterable?: boolean;
  /** Label for that dropdown; the header is used when absent */
  filterLabel?: string;
}

/** One figure above the table, computed from the rows the filters left */
export interface ReportStat {
  key: string;
  label: string;
  value: string;
  /** a second line, when the figure needs one */
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface ReportDefinition<Row> {
  key: string;
  title: string;
  columns: ReportColumn<Row>[];
  /** The column holding the row's date, for the period filter */
  dateKey?: string;
  /** A permission the viewer must hold, checked again by RLS on the data */
  requiredPermission?: string;
  /**
   * The figures shown above the table, from the rows that passed the filters.
   * A report returns only what its data supports: a stat it cannot compute is
   * left out rather than shown as a zero that reads like a real answer.
   */
  stats?: (rows: Row[]) => ReportStat[];
  /** A stable key per row, so paging reuses the right DOM nodes */
  rowKey?: (row: Row) => string;
}

export type SortDirection = 'asc' | 'desc';

export interface ReportState {
  search: string;
  sortKey: string | null;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
  /** Column keys in display order; absent keys are hidden */
  visibleColumns: string[];
  from: string | null;
  to: string | null;
  /** column key -> the one value kept, for the filterable columns */
  filters: Record<string, string>;
}

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [25, 50, 100, 250];

export function initialState<Row>(definition: ReportDefinition<Row>): ReportState {
  return {
    search: '',
    sortKey: definition.dateKey ?? null,
    sortDirection: 'desc',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    visibleColumns: definition.columns.filter(c => !c.defaultHidden).map(c => c.key),
    from: null,
    to: null,
    filters: {},
  };
}

const asComparable = (value: CellValue): string | number => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  return String(value);
};

const asDate = (value: CellValue): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/** The columns the user has chosen, in the order they chose */
export function orderedColumns<Row>(
  definition: ReportDefinition<Row>,
  state: ReportState,
): ReportColumn<Row>[] {
  const byKey = new Map(definition.columns.map(c => [c.key, c]));
  return state.visibleColumns
    .map(key => byKey.get(key))
    .filter((c): c is ReportColumn<Row> => Boolean(c));
}

export interface ReportResult<Row> {
  rows: Row[];
  /** After searching and the date filter, before paging */
  total: number;
  pageCount: number;
  /** All matching rows, for an export that ignores the current page */
  allMatching: Row[];
  /** Figures over allMatching, so they answer for what the filters left */
  stats: ReportStat[];
  /**
   * True when `from` is after `to`. Such a range matches nothing, and an empty
   * table is a misleading way to say "those two dates are the wrong way round".
   */
  invalidRange: boolean;
}

/** The distinct values of a filterable column, for its dropdown */
export function filterOptions<Row>(column: ReportColumn<Row>, rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = column.value(row);
    if (value === null || value === undefined || value === '') continue;
    seen.add(value instanceof Date ? value.toISOString().slice(0, 10) : String(value));
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'ar'));
}

/** The filters the user has actually set, for the chips that let them undo one */
export interface ActiveFilter {
  kind: 'search' | 'from' | 'to' | 'column';
  /** the column key, for kind 'column' */
  key?: string;
  label: string;
  value: string;
}

export function activeFilters<Row>(
  definition: ReportDefinition<Row>,
  state: ReportState,
  labels: { search: string; from: string; to: string },
): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  if (state.search.trim()) {
    chips.push({ kind: 'search', label: labels.search, value: state.search.trim() });
  }
  if (state.from) chips.push({ kind: 'from', label: labels.from, value: state.from });
  if (state.to) chips.push({ kind: 'to', label: labels.to, value: state.to });
  for (const [key, value] of Object.entries(state.filters)) {
    if (!value) continue;
    const column = definition.columns.find(c => c.key === key);
    if (!column) continue;
    chips.push({ kind: 'column', key, label: column.filterLabel ?? column.header, value });
  }
  return chips;
}

/**
 * Search, filter, sort and page, in that order.
 *
 * This runs in the browser over rows already fetched. The hooks feeding it cap
 * what they request, and the page size caps what is rendered — so a large table
 * costs one pass over an array, not a DOM node per row.
 */
export function runReport<Row>(
  definition: ReportDefinition<Row>,
  rows: Row[],
  state: ReportState,
): ReportResult<Row> {
  let working = rows;

  // A range the wrong way round filters everything out, which the caller
  // reports as such instead of showing an empty table.
  const invalidRange = Boolean(state.from && state.to && state.from > state.to);

  // period
  if (!invalidRange && definition.dateKey && (state.from || state.to)) {
    const column = definition.columns.find(c => c.key === definition.dateKey);
    if (column) {
      const from = state.from ? new Date(`${state.from}T00:00:00`) : null;
      const to = state.to ? new Date(`${state.to}T23:59:59.999`) : null;
      working = working.filter(row => {
        const date = asDate(column.value(row));
        if (!date) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      });
    }
  }

  // the per-column dropdowns, before the free-text search so the search runs
  // over fewer rows
  for (const [key, wanted] of Object.entries(state.filters)) {
    if (!wanted) continue;
    const column = definition.columns.find(c => c.key === key);
    if (!column) continue;
    working = working.filter(row => {
      const value = column.value(row);
      if (value === null || value === undefined) return false;
      const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
      return text === wanted;
    });
  }

  // free-text search across the searchable columns
  const term = state.search.trim().toLowerCase();
  if (term) {
    const searchable = definition.columns.filter(c => !c.notSearchable);
    working = working.filter(row =>
      searchable.some(column => {
        const value = column.value(row);
        if (value === null || value === undefined) return false;
        const text = value instanceof Date ? value.toISOString() : String(value);
        return text.toLowerCase().includes(term);
      }),
    );
  }

  // sort
  if (state.sortKey) {
    const column = definition.columns.find(c => c.key === state.sortKey);
    if (column) {
      const direction = state.sortDirection === 'asc' ? 1 : -1;
      // copied first: sorting the caller's array in place would reorder their state
      working = [...working].sort((a, b) => {
        const left = asComparable(column.value(a));
        const right = asComparable(column.value(b));
        if (left === right) return 0;
        if (typeof left === 'number' && typeof right === 'number') {
          return (left - right) * direction;
        }
        // Arabic needs a locale-aware compare, or ا and أ sort apart
        return String(left).localeCompare(String(right), 'ar') * direction;
      });
    }
  }

  const total = working.length;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;

  return {
    rows: invalidRange ? [] : working.slice(start, start + state.pageSize),
    total: invalidRange ? 0 : total,
    pageCount,
    allMatching: invalidRange ? [] : working,
    // over every matching row, not the page on screen
    stats: invalidRange || !definition.stats ? [] : definition.stats(working),
    invalidRange,
  };
}

/** The report's columns in export form */
export function toSheetColumns<Row>(columns: ReportColumn<Row>[]): SheetColumn<Row>[] {
  return columns.map(c => ({
    key: c.key,
    header: c.header,
    width: c.width ?? (c.type === 'date' ? 20 : 18),
    value: c.value,
  }));
}
