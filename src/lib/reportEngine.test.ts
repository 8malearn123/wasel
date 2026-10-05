import { describe, it, expect } from 'vitest';
import { runReport, initialState, orderedColumns, type ReportDefinition } from './reportEngine';

interface Sale { id: string; customer: string; total: number; at: Date; branch: string }

const definition: ReportDefinition<Sale> = {
  key: 'sales',
  title: 'المبيعات',
  dateKey: 'at',
  columns: [
    { key: 'id', header: 'رقم', value: r => r.id },
    { key: 'customer', header: 'العميل', value: r => r.customer },
    { key: 'total', header: 'الإجمالي', type: 'money', value: r => r.total },
    { key: 'at', header: 'التاريخ', type: 'date', value: r => r.at },
    { key: 'branch', header: 'الفرع', value: r => r.branch, defaultHidden: true },
  ],
};

const sales: Sale[] = [
  { id: 'INV-1', customer: 'أحمد', total: 500, at: new Date('2026-01-10'), branch: 'الرئيسي' },
  { id: 'INV-2', customer: 'سارة', total: 1500, at: new Date('2026-02-20'), branch: 'الفرع الثاني' },
  { id: 'INV-3', customer: 'إبراهيم', total: 250, at: new Date('2026-03-05'), branch: 'الرئيسي' },
  { id: 'INV-4', customer: 'أحمد', total: 900, at: new Date('2026-03-25'), branch: 'الرئيسي' },
];

const state = (over = {}) => ({ ...initialState(definition), ...over });

describe('runReport', () => {
  it('returns everything by default, newest first', () => {
    const r = runReport(definition, sales, state());
    expect(r.total).toBe(4);
    expect(r.rows[0].id).toBe('INV-4');
  });

  it('searches across the searchable columns', () => {
    expect(runReport(definition, sales, state({ search: 'أحمد' })).total).toBe(2);
    expect(runReport(definition, sales, state({ search: 'INV-2' })).total).toBe(1);
    expect(runReport(definition, sales, state({ search: 'لا أحد' })).total).toBe(0);
  });

  it('skips columns marked not searchable', () => {
    const d = { ...definition, columns: definition.columns.map(c => c.key === 'customer' ? { ...c, notSearchable: true } : c) };
    expect(runReport(d, sales, state({ search: 'أحمد' })).total).toBe(0);
  });

  it('filters by period, inclusive at both ends', () => {
    expect(runReport(definition, sales, state({ from: '2026-02-01', to: '2026-03-31' })).total).toBe(3);
    expect(runReport(definition, sales, state({ from: '2026-03-05', to: '2026-03-05' })).total).toBe(1);
    expect(runReport(definition, sales, state({ from: '2027-01-01' })).total).toBe(0);
  });

  it('sorts numbers numerically, not as text', () => {
    const asc = runReport(definition, sales, state({ sortKey: 'total', sortDirection: 'asc' }));
    expect(asc.rows.map(r => r.total)).toEqual([250, 500, 900, 1500]);
  });

  // The point of localeCompare over a plain < : Arabic collation treats أ, إ and
  // ا as the same letter, so إبراهيم sorts before أحمد on the second letter
  // (ب before ح). A codepoint sort would put every إ after every أ instead.
  it('sorts Arabic by locale, not by codepoint', () => {
    const asc = runReport(definition, sales, state({ sortKey: 'customer', sortDirection: 'asc' }));
    expect(asc.rows.map(r => r.customer)).toEqual(['إبراهيم', 'أحمد', 'أحمد', 'سارة']);

    const byCodepoint = [...new Set(sales.map(s => s.customer))].sort();
    expect(byCodepoint[0]).not.toBe('إبراهيم');
  });

  it('reverses on descending', () => {
    const desc = runReport(definition, sales, state({ sortKey: 'customer', sortDirection: 'desc' }));
    expect(desc.rows[0].customer).toBe('سارة');
  });

  it('pages without losing the total', () => {
    const r = runReport(definition, sales, state({ pageSize: 2, page: 2 }));
    expect(r.rows).toHaveLength(2);
    expect(r.total).toBe(4);
    expect(r.pageCount).toBe(2);
  });

  it('clamps a page beyond the end instead of showing nothing', () => {
    const r = runReport(definition, sales, state({ pageSize: 2, page: 99 }));
    expect(r.rows).toHaveLength(2);
  });

  it('exports every match, not just the visible page', () => {
    const r = runReport(definition, sales, state({ pageSize: 1 }));
    expect(r.rows).toHaveLength(1);
    expect(r.allMatching).toHaveLength(4);
  });

  it('does not reorder the array it was given', () => {
    const copy = [...sales];
    runReport(definition, sales, state({ sortKey: 'total', sortDirection: 'asc' }));
    expect(sales).toEqual(copy);
  });

  it('combines period, search and sort', () => {
    const r = runReport(definition, sales, state({ from: '2026-03-01', search: 'أحمد', sortKey: 'total' }));
    expect(r.total).toBe(1);
    expect(r.rows[0].id).toBe('INV-4');
  });
});

describe('column selection', () => {
  it('hides the columns marked hidden by default', () => {
    expect(orderedColumns(definition, state()).map(c => c.key)).toEqual(['id', 'customer', 'total', 'at']);
  });

  it('follows the order the user chose', () => {
    const cols = orderedColumns(definition, state({ visibleColumns: ['total', 'branch', 'id'] }));
    expect(cols.map(c => c.key)).toEqual(['total', 'branch', 'id']);
  });

  it('ignores a key that no longer exists', () => {
    const cols = orderedColumns(definition, state({ visibleColumns: ['id', 'gone'] }));
    expect(cols.map(c => c.key)).toEqual(['id']);
  });
});
