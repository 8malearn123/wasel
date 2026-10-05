import { zipSync, strToU8 } from 'fflate';

/**
 * A real .xlsx writer — not a CSV with the wrong extension.
 *
 * An xlsx file is a zip of XML parts. Only four are needed for a plain sheet of
 * values, so this writes them directly rather than pulling in a spreadsheet
 * library: fflate does the zipping and is the only dependency.
 *
 * Why it matters here: Excel reads a CSV in the system's legacy encoding, so an
 * Arabic export opens as mojibake unless the user walks the import wizard. The
 * strings inside an xlsx are UTF-8 by definition, so Arabic simply works.
 */

export type CellValue = string | number | boolean | Date | null | undefined;

export interface SheetColumn<Row> {
  key: string;
  header: string;
  /** How wide the column opens, in characters */
  width?: number;
  value: (row: Row) => CellValue;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // XML 1.0 forbids most control characters; a stray one makes Excel refuse
    // to open the file at all
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** Excel counts days from 1900-01-01, with a deliberate bug: it thinks 1900 was a leap year. */
const toExcelSerial = (date: Date) => {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
                       date.getHours(), date.getMinutes(), date.getSeconds());
  return utc / 86400000 + 25569;
};

const columnName = (index: number) => {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
};

function cellXml(ref: string, value: CellValue, styleIndex?: number): string {
  const style = styleIndex !== undefined ? ` s="${styleIndex}"` : '';

  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"${style}/>`;
  }
  if (value instanceof Date) {
    return `<c r="${ref}" s="2"><v>${toExcelSerial(value)}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  // inlineStr avoids a shared-strings part, at the cost of a slightly larger
  // file — worth it for the simplicity, and these are report-sized exports
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

export interface SheetSpec<Row> {
  name: string;
  columns: SheetColumn<Row>[];
  rows: Row[];
  /** Written right-to-left, as an Arabic report should open */
  rightToLeft?: boolean;
}

function sheetXml<Row>(sheet: SheetSpec<Row>): string {
  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 18}" customWidth="1"/>`)
    .join('');

  const header = sheet.columns
    .map((c, i) => cellXml(`${columnName(i)}1`, c.header, 1))
    .join('');

  const body = sheet.rows
    .map((row, r) => {
      const cells = sheet.columns
        .map((c, i) => cellXml(`${columnName(i)}${r + 2}`, c.value(row)))
        .join('');
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join('');

  const lastCol = columnName(Math.max(0, sheet.columns.length - 1));
  const lastRow = sheet.rows.length + 1;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr/><dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"${sheet.rightToLeft ? ' rightToLeft="1"' : ''}>
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData><row r="1">${header}</row>${body}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
}

// Three styles: plain, bold header, and a date format.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Build the .xlsx bytes for one or more sheets. */
export function buildXlsx(sheets: SheetSpec<never>[]): Uint8Array;
export function buildXlsx<Row>(sheets: SheetSpec<Row>[]): Uint8Array;
export function buildXlsx(sheets: SheetSpec<any>[]): Uint8Array {
  if (sheets.length === 0) throw new Error('a workbook needs at least one sheet');

  // Excel rejects a sheet name over 31 characters or containing : \ / ? * [ ]
  const safeName = (name: string, index: number) =>
    (name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim()) || `Sheet${index + 1}`;

  const sheetEntries = sheets.map((s, i) => ({ spec: s, id: i + 1, name: safeName(s.name, i) }));

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetEntries.map(s => `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`),

    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),

    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEntries.map(s => `<sheet name="${escapeXml(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets>
</workbook>`),

    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetEntries.map(s => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.id}.xml"/>`).join('\n')}
<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),

    'xl/styles.xml': strToU8(STYLES_XML),
  };

  for (const s of sheetEntries) {
    files[`xl/worksheets/sheet${s.id}.xml`] = strToU8(sheetXml(s.spec));
  }

  return zipSync(files, { level: 6 });
}

/** Build and hand the file to the browser. */
export function downloadXlsx<Row>(filename: string, sheets: SheetSpec<Row>[]) {
  const bytes = buildXlsx(sheets);
  // copy into a fresh buffer: the typed array fflate returns may be a view
  // over a larger pool, and Blob would then include the neighbours
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** CSV, for whoever wants to pipe it somewhere. The BOM is what makes Excel read it as UTF-8. */
export function downloadCsv<Row>(filename: string, columns: SheetColumn<Row>[], rows: Row[]) {
  const cell = (value: CellValue) => {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const body = [
    columns.map(c => cell(c.header)).join(','),
    ...rows.map(row => columns.map(c => cell(c.value(row))).join(',')),
  ].join('\r\n');

  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
