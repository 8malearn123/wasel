import { describe, it, expect } from 'vitest';
import {
  runReport, initialState, orderedColumns, filterOptions, activeFilters,
  type ReportDefinition,
} from './reportEngine';

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

describe('column filters', () => {
  const filterable: ReportDefinition<Sale> = {
    ...definition,
    columns: definition.columns.map(c =>
      c.key === 'branch' ? { ...c, filterable: true, defaultHidden: false } : c),
  };

  it('lists the distinct values the rows actually hold', () => {
    const column = filterable.columns.find(c => c.key === 'branch')!;
    expect(filterOptions(column, sales)).toEqual(['الرئيسي', 'الفرع الثاني']);
  });

  it('leaves out blanks, so no filter offers an empty option', () => {
    const column = filterable.columns.find(c => c.key === 'branch')!;
    const withBlank = [...sales, { ...sales[0], id: 'INV-5', branch: '' }];
    expect(filterOptions(column, withBlank)).toEqual(['الرئيسي', 'الفرع الثاني']);
  });

  it('keeps only the rows matching the chosen value', () => {
    const r = runReport(filterable, sales, state({ filters: { branch: 'الرئيسي' } }));
    expect(r.total).toBe(3);
    expect(r.allMatching.every(row => row.branch === 'الرئيسي')).toBe(true);
  });

  it('combines with the search and the period', () => {
    const r = runReport(filterable, sales, state({
      filters: { branch: 'الرئيسي' }, search: 'أحمد', from: '2026-03-01',
    }));
    expect(r.total).toBe(1);
    expect(r.rows[0].id).toBe('INV-4');
  });

  it('ignores an empty value, so clearing a filter restores the rows', () => {
    expect(runReport(filterable, sales, state({ filters: { branch: '' } })).total).toBe(4);
  });

  it('ignores a filter on a column the definition no longer has', () => {
    expect(runReport(filterable, sales, state({ filters: { gone: 'x' } })).total).toBe(4);
  });
});

describe('date range validation', () => {
  it('flags a reversed range instead of silently matching nothing', () => {
    const r = runReport(definition, sales, state({ from: '2026-03-01', to: '2026-01-01' }));
    expect(r.invalidRange).toBe(true);
    expect(r.total).toBe(0);
    // and the export must not quietly carry rows the table is not showing
    expect(r.allMatching).toHaveLength(0);
  });

  it('does not flag a single-day range', () => {
    const r = runReport(definition, sales, state({ from: '2026-03-05', to: '2026-03-05' }));
    expect(r.invalidRange).toBe(false);
    expect(r.total).toBe(1);
  });

  it('does not flag an open-ended range', () => {
    expect(runReport(definition, sales, state({ from: '2026-02-01' })).invalidRange).toBe(false);
    expect(runReport(definition, sales, state({ to: '2026-02-01' })).invalidRange).toBe(false);
  });
});

describe('stats', () => {
  const withStats: ReportDefinition<Sale> = {
    ...definition,
    stats: rows => [
      { key: 'count', label: 'عدد', value: String(rows.length) },
      { key: 'total', label: 'إجمالي', value: String(rows.reduce((t, r) => t + r.total, 0)) },
    ],
  };

  it('counts every matching row, not the page on screen', () => {
    const r = runReport(withStats, sales, state({ pageSize: 1 }));
    expect(r.rows).toHaveLength(1);
    expect(r.stats.find(s => s.key === 'count')!.value).toBe('4');
    expect(r.stats.find(s => s.key === 'total')!.value).toBe('3150');
  });

  it('answers for the filtered rows, so the figures match the table', () => {
    const r = runReport(withStats, sales, state({ search: 'أحمد' }));
    expect(r.stats.find(s => s.key === 'count')!.value).toBe('2');
    expect(r.stats.find(s => s.key === 'total')!.value).toBe('1400');
  });

  it('reports nothing for a reversed range rather than a stale total', () => {
    const r = runReport(withStats, sales, state({ from: '2026-03-01', to: '2026-01-01' }));
    expect(r.stats).toEqual([]);
  });

  it('is empty for a report that defines none', () => {
    expect(runReport(definition, sales, state()).stats).toEqual([]);
  });
});

describe('activeFilters', () => {
  const labels = { search: 'بحث', from: 'من', to: 'إلى' };
  const filterable: ReportDefinition<Sale> = {
    ...definition,
    columns: definition.columns.map(c => (c.key === 'branch' ? { ...c, filterable: true } : c)),
  };

  it('is empty when nothing is set', () => {
    expect(activeFilters(filterable, state(), labels)).toEqual([]);
  });

  it('names every filter the user set, so each can be undone on its own', () => {
    const chips = activeFilters(filterable, state({
      search: 'أحمد', from: '2026-01-01', to: '2026-12-31', filters: { branch: 'الرئيسي' },
    }), labels);
    expect(chips.map(c => c.kind)).toEqual(['search', 'from', 'to', 'column']);
    expect(chips.find(c => c.kind === 'column')).toMatchObject({
      key: 'branch', label: 'الفرع', value: 'الرئيسي',
    });
  });

  it('ignores whitespace-only search and cleared dropdowns', () => {
    expect(activeFilters(filterable, state({ search: '   ', filters: { branch: '' } }), labels)).toEqual([]);
  });

  it('prefers a column filterLabel over its header', () => {
    const labelled: ReportDefinition<Sale> = {
      ...filterable,
      columns: filterable.columns.map(c =>
        c.key === 'branch' ? { ...c, filterLabel: 'موقع البيع' } : c),
    };
    const chips = activeFilters(labelled, state({ filters: { branch: 'الرئيسي' } }), labels);
    expect(chips[0].label).toBe('موقع البيع');
  });
});
