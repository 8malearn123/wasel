/**
 * Thermal Printer Service
 * Supports direct IP printing via:
 * - Epson ePOS (HTTP XML API)
 * - Star WebPRNT (HTTP API)
 * - System printer (window.print fallback)
 */

export type PrinterType = 'system' | 'epson' | 'star';
export type PaperWidth = '58mm' | '80mm';

export interface PrinterConfig {
  type: PrinterType;
  ip: string;
  port: number;
  paperWidth: PaperWidth;
  autoPrint: boolean;
  vatNumber: string;
  deviceId: string; // Epson device ID (default: local_printer)
}

const DEFAULT_CONFIG: PrinterConfig = {
  type: 'system',
  ip: '',
  port: 8008,
  paperWidth: '80mm',
  autoPrint: false,
  vatNumber: '',
  deviceId: 'local_printer',
};

export function getPrinterConfig(): PrinterConfig {
  try {
    const saved = localStorage.getItem('pos_printer_config');
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function savePrinterConfig(config: PrinterConfig) {
  localStorage.setItem('pos_printer_config', JSON.stringify(config));
  // Also keep legacy prefs for backward compat
  localStorage.setItem('pos_printer_prefs', JSON.stringify({
    paperWidth: config.paperWidth,
    autoPrint: config.autoPrint,
    vatNumber: config.vatNumber,
  }));
}

// ============= ESC/POS Command Builders =============

function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

// ESC/POS commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const ESCPOS = {
  INIT: [ESC, 0x40], // Initialize printer
  CENTER: [ESC, 0x61, 0x01], // Center align
  LEFT: [ESC, 0x61, 0x00], // Left align
  RIGHT: [ESC, 0x61, 0x02], // Right align
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_ON: [GS, 0x21, 0x11], // Double width+height
  DOUBLE_OFF: [GS, 0x21, 0x00],
  CUT: [GS, 0x56, 0x00], // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01],
  FEED: [ESC, 0x64, 0x04], // Feed 4 lines
  SEPARATOR: textToBytes('--------------------------------'),
  SEPARATOR_DOUBLE: textToBytes('================================'),
};

export interface ReceiptData {
  merchantName: string;
  branchName: string;
  vatNumber: string;
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    identifier: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  qrData?: string;
}

function buildESCPOSReceipt(data: ReceiptData, paperWidth: PaperWidth): number[] {
  const lineWidth = paperWidth === '58mm' ? 32 : 48;
  const bytes: number[] = [];

  const add = (...b: number[]) => bytes.push(...b);
  const addText = (t: string) => bytes.push(...textToBytes(t), LF);
  const addLine = () => { add(...textToBytes('-'.repeat(lineWidth)), LF); };

  const padLine = (left: string, right: string) => {
    const space = lineWidth - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right;
  };

  // Initialize
  add(...ESCPOS.INIT);

  // Header - centered
  add(...ESCPOS.CENTER);
  add(...ESCPOS.BOLD_ON);
  add(...ESCPOS.DOUBLE_ON);
  addText(data.merchantName);
  add(...ESCPOS.DOUBLE_OFF);
  add(...ESCPOS.BOLD_OFF);
  addText(data.branchName);
  if (data.vatNumber) {
    addText(`Tax: ${data.vatNumber}`);
  }
  add(LF);
  add(...ESCPOS.BOLD_ON);
  addText('فاتورة ضريبية مبسطة');
  add(...ESCPOS.BOLD_OFF);
  addText(data.invoiceNumber);
  addText(data.date);

  addLine();

  // Customer info
  add(...ESCPOS.RIGHT);
  if (data.customerName) addText(`العميل: ${data.customerName}`);
  if (data.customerPhone) addText(`الهاتف: ${data.customerPhone}`);
  if (data.customerName || data.customerPhone) addLine();

  // Items header
  add(...ESCPOS.BOLD_ON);
  addText(padLine('الصنف', 'المبلغ'));
  add(...ESCPOS.BOLD_OFF);
  addLine();

  // Items
  for (const item of data.items) {
    addText(item.name);
    const qtyPrice = `${item.quantity} x ${item.price.toFixed(2)}`;
    const total = (item.quantity * item.price).toFixed(2);
    addText(padLine(qtyPrice, `${total} ر.س`));
    if (item.identifier) {
      addText(`  ${item.identifier}`);
    }
  }

  addLine();

  // Totals
  addText(padLine('المجموع', `${data.subtotal.toFixed(2)} ر.س`));
  addText(padLine('ضريبة 15%', `${data.tax.toFixed(2)} ر.س`));
  if (data.discount > 0) {
    addText(padLine('خصم', `-${data.discount.toFixed(2)} ر.س`));
  }

  add(...ESCPOS.BOLD_ON);
  add(...ESCPOS.DOUBLE_ON);
  addText(padLine('الإجمالي', `${data.total.toFixed(2)}`));
  add(...ESCPOS.DOUBLE_OFF);
  add(...ESCPOS.BOLD_OFF);

  addLine();
  addText(padLine('الدفع:', data.paymentMethod));

  // Footer
  add(LF);
  add(...ESCPOS.CENTER);
  addText('شكراً لزيارتكم!');
  addText('Thank you!');

  // Feed and cut
  add(...ESCPOS.FEED);
  add(...ESCPOS.PARTIAL_CUT);

  return bytes;
}

// ============= Epson ePOS Printing =============

function buildEpsonXML(data: ReceiptData, paperWidth: PaperWidth): string {
  const items = data.items.map(item => {
    const total = (item.quantity * item.price).toFixed(2);
    return `
      <text lang=\\\"ar\\\">${item.name}&#10;</text>
      <text>  ${item.quantity} x ${item.price.toFixed(2)} = ${total}&#10;</text>
      ${item.identifier ? `<text>  ${item.identifier}&#10;</text>` : ''}
    `;
  }).join('');

  return `<?xml version=\\\"1.0\\\" encoding=\\\"utf-8\\\"?>
<s:Envelope xmlns:s=\\\"http://schemas.xmlsoap.org/soap/envelope/\\\">
  <s:Body>
    <epos-print xmlns=\\\"http://www.epson-pos.com/schemas/2011/03/epos-print\\\">
      <text align=\\\"center\\\" lang=\\\"ar\\\"/>
      <text dw=\\\"true\\\" dh=\\\"true\\\" em=\\\"true\\\">${data.merchantName}&#10;</text>
      <text dw=\\\"false\\\" dh=\\\"false\\\" em=\\\"false\\\">${data.branchName}&#10;</text>
      ${data.vatNumber ? `<text>الرقم الضريبي: ${data.vatNumber}&#10;</text>` : ''}
      <text>&#10;</text>
      <text em=\\\"true\\\">فاتورة ضريبية مبسطة&#10;</text>
      <text em=\\\"false\\\">${data.invoiceNumber}&#10;</text>
      <text>${data.date}&#10;</text>
      <text>--------------------------------&#10;</text>
      
      <text align=\\\"right\\\"/>
      ${data.customerName ? `<text>العميل: ${data.customerName}&#10;</text>` : ''}
      ${data.customerPhone ? `<text>الهاتف: ${data.customerPhone}&#10;</text>` : ''}
      ${(data.customerName || data.customerPhone) ? '<text>--------------------------------&#10;</text>' : ''}
      
      ${items}
      
      <text>--------------------------------&#10;</text>
      <text>المجموع: ${data.subtotal.toFixed(2)} ر.س&#10;</text>
      <text>ضريبة 15%: ${data.tax.toFixed(2)} ر.س&#10;</text>
      ${data.discount > 0 ? `<text>خصم: -${data.discount.toFixed(2)} ر.س&#10;</text>` : ''}
      <text em=\\\"true\\\" dw=\\\"true\\\">الإجمالي: ${data.total.toFixed(2)} ر.س&#10;</text>
      <text em=\\\"false\\\" dw=\\\"false\\\">--------------------------------&#10;</text>
      <text>الدفع: ${data.paymentMethod}&#10;</text>
      
      <text align=\\\"center\\\"/>
      <text>&#10;</text>
      ${data.qrData ? `<symbol type=\\\"qrcode_model_2\\\" level=\\\"default\\\" width=\\\"4\\\" height=\\\"0\\\" size=\\\"0\\\">${data.qrData}</symbol>` : ''}
      <text>&#10;</text>
      <text>شكراً لزيارتكم!&#10;</text>
      <text>Thank you!&#10;</text>
      
      <feed unit=\\\"24\\\" line=\\\"4\\\"/>
      <cut type=\\\"feed\\\"/>
    </epos-print>
  </s:Body>
</s:Envelope>`;
}

async function printEpson(config: PrinterConfig, data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  const url = `http://${config.ip}:${config.port}/cgi-bin/epos/service.cgi?devid=${config.deviceId}&timeout=10000`;

  try {
    const xml = buildEpsonXML(data, config.paperWidth);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    if (text.includes('success=\\\"true\\\"') || text.includes('code=\\\"SUCCESS\\\"')) {
      return { success: true };
    }
    return { success: false, error: 'Printer returned error response' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' };
  }
}

// ============= Star WebPRNT Printing =============

function buildStarXML(data: ReceiptData, paperWidth: PaperWidth): string {
  const items = data.items.map(item => {
    const total = (item.quantity * item.price).toFixed(2);
    return `<text>${item.name}\\\\n  ${item.quantity} x ${item.price.toFixed(2)} = ${total}\\\\n${item.identifier ? `  ${item.identifier}\\\\n` : ''}</text>`;
  }).join('');

  return `<?xml version=\\\"1.0\\\" encoding=\\\"UTF-8\\\"?>
<StarWebPrint xmlns=\\\"http://www.star-m.jp\\\" xmlns:i=\\\"http://www.star-m.jp/StarWebPRNT\\\">
  <PrintReceipt>
    <ActionPrintText>
      <TextData alignment=\\\"Center\\\" characterSpace=\\\"0\\\" bold=\\\"true\\\" width=\\\"2\\\" height=\\\"2\\\">${data.merchantName}\\\\n</TextData>
      <TextData alignment=\\\"Center\\\" bold=\\\"false\\\" width=\\\"1\\\" height=\\\"1\\\">${data.branchName}\\\\n</TextData>
      ${data.vatNumber ? `<TextData alignment=\\\"Center\\\">الرقم الضريبي: ${data.vatNumber}\\\\n</TextData>` : ''}
      <TextData alignment=\\\"Center\\\">\\\\n</TextData>
      <TextData alignment=\\\"Center\\\" bold=\\\"true\\\">فاتورة ضريبية مبسطة\\\\n</TextData>
      <TextData alignment=\\\"Center\\\">${data.invoiceNumber}\\\\n</TextData>
      <TextData alignment=\\\"Center\\\">${data.date}\\\\n</TextData>
      <TextData>--------------------------------\\\\n</TextData>
      
      ${data.customerName ? `<TextData>العميل: ${data.customerName}\\\\n</TextData>` : ''}
      ${data.customerPhone ? `<TextData>الهاتف: ${data.customerPhone}\\\\n</TextData>` : ''}
      
      ${items}
      
      <TextData>--------------------------------\\\\n</TextData>
      <TextData>المجموع: ${data.subtotal.toFixed(2)} ر.س\\\\n</TextData>
      <TextData>ضريبة 15%: ${data.tax.toFixed(2)} ر.س\\\\n</TextData>
      ${data.discount > 0 ? `<TextData>خصم: -${data.discount.toFixed(2)} ر.س\\\\n</TextData>` : ''}
      <TextData bold=\\\"true\\\" width=\\\"2\\\">الإجمالي: ${data.total.toFixed(2)} ر.س\\\\n</TextData>
      <TextData>--------------------------------\\\\n</TextData>
      <TextData>الدفع: ${data.paymentMethod}\\\\n</TextData>
      
      <TextData alignment=\\\"Center\\\">\\\\n</TextData>
      <TextData alignment=\\\"Center\\\">شكراً لزيارتكم!\\\\n</TextData>
      <TextData alignment=\\\"Center\\\">Thank you!\\\\n</TextData>
    </ActionPrintText>
    <ActionFeedToCutter/>
  </PrintReceipt>
</StarWebPrint>`;
}

async function printStar(config: PrinterConfig, data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  const url = `http://${config.ip}:${config.port}/StarWebPRNT/SendMessage`;

  try {
    const xml = buildStarXML(data, config.paperWidth);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' };
  }
}

// ============= Test Connection =============

export async function testPrinterConnection(config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
  if (config.type === 'system') {
    return { success: true };
  }

  if (!config.ip) {
    return { success: false, error: 'IP address is required' };
  }

  try {
    if (config.type === 'epson') {
      const url = `http://${config.ip}:${config.port}/cgi-bin/epos/service.cgi?devid=${config.deviceId}&timeout=5000`;
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      return { success: true };
    } else if (config.type === 'star') {
      const url = `http://${config.ip}:${config.port}/StarWebPRNT/StatusMessage`;
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: `لا يمكن الاتصال بالطابعة على ${config.ip}:${config.port}` };
  }

  return { success: false, error: 'Unknown printer type' };
}

// ============= Main Print Function =============

export async function printReceipt(
  config: PrinterConfig,
  data: ReceiptData
): Promise<{ success: boolean; error?: string }> {
  if (config.type === 'epson') {
    return printEpson(config, data);
  } else if (config.type === 'star') {
    return printStar(config, data);
  }

  // System printer fallback - handled by InvoiceDialog
  return { success: false, error: 'USE_SYSTEM_PRINT' };
}

// Payment method labels
export const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة / مدى',
  bank_transfer: 'تحويل بنكي',
  mixed: 'مختلط',
};
