import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildXlsx, type SheetColumn } from './xlsx';

interface Row { name: string; qty: number; price: number; when: Date; ok: boolean }

const columns: SheetColumn<Row>[] = [
  { key: 'name', header: 'المنتج', value: r => r.name },
  { key: 'qty', header: 'الكمية', value: r => r.qty },
  { key: 'price', header: 'السعر', value: r => r.price },
  { key: 'when', header: 'التاريخ', value: r => r.when },
  { key: 'ok', header: 'متاح', value: r => r.ok },
];

const rows: Row[] = [
  { name: 'كفر جلد', qty: 3, price: 79.5, when: new Date('2026-10-05T10:30:00Z'), ok: true },
  { name: 'iPhone 15 <Pro> & "Max"', qty: 1, price: 4999, when: new Date('2026-01-01T00:00:00Z'), ok: false },
];

const read = (bytes: Uint8Array) => {
  const files = unzipSync(bytes);
  return { files, sheet: strFromU8(files['xl/worksheets/sheet1.xml']) };
};

describe('buildXlsx', () => {
  it('produces a zip with the parts Excel requires', () => {
    const { files } = read(buildXlsx([{ name: 'تقرير', columns, rows }]));
    for (const part of [
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
    ]) {
      expect(Object.keys(files)).toContain(part);
    }
  });

  it('starts with the zip signature, so the browser sees a real xlsx', () => {
    const bytes = buildXlsx([{ name: 'a', columns, rows }]);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
  });

  // The reason for not shipping a CSV: Excel would mangle this.
  it('keeps Arabic intact', () => {
    const { sheet } = read(buildXlsx([{ name: 'تقرير', columns, rows }]));
    expect(sheet).toContain('كفر جلد');
    expect(sheet).toContain('المنتج');
  });

  it('escapes what would otherwise break the XML', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows }]));
    expect(sheet).toContain('iPhone 15 &lt;Pro&gt; &amp; &quot;Max&quot;');
    expect(sheet).not.toContain('<Pro>');
  });

  it('writes numbers as numbers and text as text', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows }]));
    expect(sheet).toContain('<v>4999</v>');
    expect(sheet).toContain('<v>79.5</v>');
    expect(sheet).toContain('t="inlineStr"');
  });

  it('writes a date as an Excel serial with the date style', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows }]));
    expect(sheet).toMatch(/<c r="D2" s="2"><v>4[0-9.]+<\/v><\/c>/);
  });

  it('writes booleans as booleans', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows }]));
    expect(sheet).toContain('t="b"><v>1</v>');
    expect(sheet).toContain('t="b"><v>0</v>');
  });

  it('freezes the header and adds the filter row', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows }]));
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<autoFilter ref="A1:E3"/>');
  });

  it('can open right to left', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows, rightToLeft: true }]));
    expect(sheet).toContain('rightToLeft="1"');
  });

  // Excel refuses to open a file whose sheet name is too long or has : \ / ? * [ ]
  it('makes the sheet name safe', () => {
    const { files } = read(buildXlsx([{ name: 'a/b:c[d]*e?f\\g'.repeat(5), columns, rows }]));
    const workbook = strFromU8(files['xl/workbook.xml']);
    const name = workbook.match(/name="([^"]*)"/)?.[1] ?? '';
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[:\\/?*[\]]/);
  });

  it('handles an empty result set', () => {
    const { sheet } = read(buildXlsx([{ name: 'a', columns, rows: [] }]));
    expect(sheet).toContain('<sheetData><row r="1">');
    expect(sheet).toContain('المنتج');
  });

  it('writes every sheet it is given', () => {
    const { files } = read(buildXlsx([
      { name: 'one', columns, rows },
      { name: 'two', columns, rows: [] },
    ]));
    expect(files['xl/worksheets/sheet2.xml']).toBeDefined();
  });

  it('refuses a workbook with no sheets', () => {
    expect(() => buildXlsx([])).toThrow();
  });
});
