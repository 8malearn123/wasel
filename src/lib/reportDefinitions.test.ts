import { describe, it, expect } from 'vitest';
import { runReport, initialState, type ReportColumn, type ReportDefinition } from './reportEngine';
import {
  accessoriesReport, customersReport, devicesReport, salesReport, suppliersReport,
} from './reportDefinitions';

const column = <Row,>(def: ReportDefinition<Row>, key: string): ReportColumn<Row> =>
  def.columns.find(c => c.key === key)!;

const statOf = <Row,>(def: ReportDefinition<Row>, rows: Row[], key: string) =>
  runReport(def, rows, initialState(def)).stats.find(s => s.key === key);

/**
 * Run an assertion against every report.
 *
 * A plain array of the five would widen to a union of ReportDefinition<Sale> |
 * ReportDefinition<Device> | … , which nothing generic will accept. A generic
 * callback keeps each one's row type intact instead of casting it away.
 */
function eachReport(assert: <Row>(def: ReportDefinition<Row>) => void) {
  assert(salesReport);
  assert(devicesReport);
  assert(accessoriesReport);
  assert(customersReport);
  assert(suppliersReport);
}

const accessories = [
  { id: 'a1', sku: 'CASE-1', name: 'كفر جلد', category: 'كفرات', quantity: 10, min_quantity: 2, cost: 15, price: 40, created_at: '2026-01-01' },
  { id: 'a2', sku: 'CHRG-1', name: 'شاحن سريع', category: 'شواحن', quantity: 4, min_quantity: 5, cost: 30, price: 75, created_at: '2026-02-01' },
] as never[];

describe('accessories report', () => {
  // The column header says "(تكلفة)" because the figure is cost × quantity.
  // Calling it plain "قيمة المخزون" invited reading it as a retail figure, and
  // the two differ by the whole margin: 150+120 at cost vs 400+300 at retail.
  it('values stock at cost, and says so in the header', () => {
    const stock = column(accessoriesReport, 'stock_value');
    expect(stock.header).toContain('تكلفة');
    expect(stock.value(accessories[0])).toBe(150);
    expect(stock.value(accessories[1])).toBe(120);
  });

  it('keeps the retail estimate a separate column, not a relabelled cost', () => {
    const retail = column(accessoriesReport, 'retail_value');
    expect(retail.value(accessories[0])).toBe(400);
    expect(retail.value(accessories[1])).toBe(300);
  });

  it('reports the four figures the stock answer needs', () => {
    expect(statOf(accessoriesReport, accessories, 'count')!.value).toBe('2');
    expect(statOf(accessoriesReport, accessories, 'quantity')!.value).toBe('14');
    expect(statOf(accessoriesReport, accessories, 'cost')!.value).toContain('270');
    expect(statOf(accessoriesReport, accessories, 'retail')!.value).toContain('700');
  });

  it('counts only the rows the filters left', () => {
    const state = { ...initialState(accessoriesReport), filters: { category: 'كفرات' } };
    const result = runReport(accessoriesReport, accessories, state);
    expect(result.total).toBe(1);
    expect(result.stats.find(s => s.key === 'cost')!.value).toContain('150');
  });

  it('offers a category filter, since the data has one', () => {
    expect(column(accessoriesReport, 'category')).toMatchObject({ filterable: true });
  });
});

const sales = [
  { id: 's1', invoice_number: 'INV-1', sale_date: '2026-01-05', customer_name: 'أحمد', total_amount: 1000, discount_amount: 0, subtotal: 870, tax_amount: 130, payment_method: 'cash', payment_status: 'paid' },
  { id: 's2', invoice_number: 'INV-2', sale_date: '2026-01-06', customer_name: 'سارة', total_amount: 500, discount_amount: 50, subtotal: 435, tax_amount: 65, payment_method: 'card', payment_status: 'paid' },
] as never[];

describe('sales report', () => {
  it('reports the total, the count and the average of what is shown', () => {
    expect(statOf(salesReport, sales, 'total')!.value).toContain('1,500');
    expect(statOf(salesReport, sales, 'count')!.value).toBe('2');
    expect(statOf(salesReport, sales, 'average')!.value).toContain('750');
  });

  it('reports discounts only when some sale carried one', () => {
    expect(statOf(salesReport, sales, 'discounts')!.value).toContain('50');
    const noDiscount = sales.map(s => ({ ...(s as object), discount_amount: 0 })) as never[];
    // A flat zero would read as a fact about the period rather than an absence
    expect(statOf(salesReport, noDiscount, 'discounts')).toBeUndefined();
  });

  it('leaves the average out when there is nothing to average', () => {
    expect(statOf(salesReport, [], 'average')!.value).toBe('—');
  });

  it('translates the payment method and status, and filters on them', () => {
    expect(column(salesReport, 'payment_method').value(sales[0])).toBe('نقدي');
    expect(column(salesReport, 'payment_status').value(sales[1])).toBe('مدفوع');
    expect(column(salesReport, 'payment_method')).toMatchObject({ filterable: true });
  });
});

describe('devices report', () => {
  const devices = [
    { id: 'd1', imei: '350000000000001', brand: 'Apple', model: 'iPhone 15', cost: 2600, price: 3200, status: 'available', created_at: '2026-01-01' },
    { id: 'd2', imei: '350000000000002', brand: 'Apple', model: 'iPhone 14', cost: 2000, price: 2500, status: 'sold', created_at: '2026-01-02' },
  ] as never[];

  it('separates cost from the retail estimate', () => {
    expect(statOf(devicesReport, devices, 'cost')!.value).toContain('4,600');
    expect(statOf(devicesReport, devices, 'retail')!.value).toContain('5,700');
  });

  it('counts what is actually sellable, not every row', () => {
    expect(statOf(devicesReport, devices, 'count')!.value).toBe('2');
    expect(statOf(devicesReport, devices, 'available')!.value).toBe('1');
  });

  it('shows the expected profit per device, not a realised one', () => {
    expect(column(devicesReport, 'margin').header).toContain('المتوقع');
    expect(column(devicesReport, 'margin').value(devices[0])).toBe(600);
  });
});

describe('customers report', () => {
  const customers = [
    { id: 'c1', name: 'أحمد', phone: '0500000001', total_purchases: 3, total_spent: 900, loyalty_points: 90, created_at: '2026-01-01' },
    { id: 'c2', name: 'سارة', phone: '0500000002', total_purchases: 0, total_spent: 0, loyalty_points: 0, created_at: '2026-01-02' },
  ] as never[];

  it('averages over the customers who actually bought something', () => {
    expect(statOf(customersReport, customers, 'count')!.value).toBe('2');
    expect(statOf(customersReport, customers, 'buyers')!.value).toBe('1');
    // 900 / 1 buyer, not 900 / 2 registered
    expect(statOf(customersReport, customers, 'average')!.value).toContain('900');
  });
});

describe('suppliers report', () => {
  const suppliers = [
    { id: 'p1', name: 'مورد أ', balance: 1200, is_active: true, created_at: '2026-01-01' },
    { id: 'p2', name: 'مورد ب', balance: 0, is_active: false, created_at: '2026-01-02' },
  ] as never[];

  it('totals the debt and names who it is owed to', () => {
    expect(statOf(suppliersReport, suppliers, 'count')!.value).toBe('2');
    expect(statOf(suppliersReport, suppliers, 'active')!.value).toBe('1');
    expect(statOf(suppliersReport, suppliers, 'owed')!.value).toContain('1,200');
    expect(statOf(suppliersReport, suppliers, 'withDebt')!.value).toBe('1');
  });

  it('leaves the debt-holder count out when nobody is owed', () => {
    const settled = suppliers.map(s => ({ ...(s as object), balance: 0 })) as never[];
    expect(statOf(suppliersReport, settled, 'withDebt')).toBeUndefined();
    expect(statOf(suppliersReport, settled, 'owed')!.tone).toBe('default');
  });
});

describe('every report', () => {
  it('gives each row a stable key, so paging reuses the right rows', () => {
    eachReport(report => expect(report.rowKey, report.key).toBeTypeOf('function'));
  });

  it('leaves at least one column visible by default', () => {
    eachReport(report =>
      expect(initialState(report).visibleColumns.length, report.key).toBeGreaterThan(0));
  });

  it('has no duplicate column keys, which would break ordering and export', () => {
    eachReport(report => {
      const keys = report.columns.map(c => c.key);
      expect(new Set(keys).size, report.key).toBe(keys.length);
    });
  });

  it('counts zero honestly for an empty table', () => {
    eachReport(report => {
      const stats = runReport(report, [], initialState(report)).stats;
      // the shape is a report's own choice, but a count must never lie
      const count = stats.find(s => s.key === 'count');
      if (count) expect(count.value, report.key).toBe('0');
    });
  });

  it('names every filterable column it offers a dropdown for', () => {
    eachReport(report => {
      for (const col of report.columns.filter(c => c.filterable)) {
        expect(col.filterLabel ?? col.header, `${report.key}.${col.key}`).toBeTruthy();
      }
    });
  });
});
