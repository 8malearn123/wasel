import type { CellValue, SheetColumn } from './xlsx';

/**
 * The shape of a report, so adding one is a definition rather than a screen.
 *
 * A report is a list of columns over a list of rows. Everything the table does
 * — searching, filtering, sorting, choosing and ordering columns, paging — is
 * derived from the column definitions, so a new report needs no new UI.
 */

export type ColumnType = 'text' | 'number' | 'money' | 'date' | 'badge';

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
}

export interface ReportDefinition<Row> {
  key: string;
  title: string;
  columns: ReportColumn<Row>[];
  /** The column holding the row's date, for the period filter */
  dateKey?: string;
  /** A permission the viewer must hold, checked again by RLS on the data */
  requiredPermission?: string;
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

  // period
  if (definition.dateKey && (state.from || state.to)) {
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
    rows: working.slice(start, start + state.pageSize),
    total,
    pageCount,
    allMatching: working,
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
