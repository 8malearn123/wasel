import { describe, it, expect } from 'vitest';
import { weeklyRevenue, forecastNextWeek, pctChange, topItems, matchQuestion, type AssistantSale } from './assistantMath';

const NOW = new Date('2026-11-10T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString();

describe('assistantMath', () => {
  const sales: AssistantSale[] = [
    { sale_date: daysAgo(1), total_amount: 100, items: [{ quantity: 2, unit_price: 50, accessory: { name: 'Cable' } }] },
    { sale_date: daysAgo(3), total_amount: 200, items: [{ quantity: 1, unit_price: 200, device: { brand: 'Apple', model: 'iPhone 15' } }] },
    { sale_date: daysAgo(8), total_amount: 50, items: [{ quantity: 1, unit_price: 50, accessory: { name: 'Cable' } }] },
    { sale_date: daysAgo(60), total_amount: 999 },
  ];

  it('puts each sale in its rolling 7-day window, oldest first', () => {
    const w = weeklyRevenue(sales, NOW, 6);
    expect(w).toHaveLength(6);
    expect(w[5].revenue).toBe(300);
    expect(w[5].count).toBe(2);
    expect(w[4].revenue).toBe(50);
    expect(w.slice(0, 4).every(x => x.revenue === 0)).toBe(true);
  });

  it('averages the last four weeks that had sales, and returns null with none', () => {
    expect(forecastNextWeek([{ revenue: 0 }, { revenue: 100 }, { revenue: 300 }])).toEqual({ value: 200, basisWeeks: 2 });
    expect(forecastNextWeek([{ revenue: 0 }, { revenue: 0 }])).toBeNull();
  });

  it('has no change figure without a base', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(150, 0)).toBeNull();
  });

  it('ranks items by units across devices and accessories', () => {
    expect(topItems(sales)).toEqual([
      { name: 'Cable', units: 3, revenue: 150 },
      { name: 'Apple iPhone 15', units: 1, revenue: 200 },
    ]);
  });

  it('maps a typed question onto a ready one, or none', () => {
    expect(matchQuestion('توقع مبيعات الأسبوع القادم')).toBe('forecast');
    expect(matchQuestion('وش المنتجات اللي تحتاج إعادة طلب')).toBe('reorder');
    expect(matchQuestion('ما الأكثر مبيعاً؟')).toBe('top');
    expect(matchQuestion('كيف أداء المبيعات')).toBe('summary');
    expect(matchQuestion('اكتب لي قصيدة')).toBeNull();
  });
});
