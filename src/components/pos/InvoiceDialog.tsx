import { useRef, useState, useEffect } from "react";
import { X, Printer, Settings2, Wifi, WifiOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { POSCartItem } from "./CartPanel";
import type { PaymentMethod } from "@/types/database";
import {
  getPrinterConfig,
  savePrinterConfig,
  printReceipt,
  testPrinterConnection,
  paymentMethodLabels,
  type PrinterConfig,
  type PrinterType,
  type PaperWidth,
  type ReceiptData,
} from "@/services/thermalPrinter";

interface InvoiceData {
  invoiceNumber: string;
  items: POSCartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  merchantName: string;
  branchName: string;
  date: string;
}

interface InvoiceDialogProps {
  data: InvoiceData;
  onClose: () => void;
  onPrinted?: () => void;
}

// ZATCA TLV QR Code generation
function generateZATCABase64(
  sellerName: string, vatNumber: string, timestamp: string, totalWithVat: string, vatAmount: string
): string {
  const encoder = new TextEncoder();
  const tlvParts: Uint8Array[] = [];
  const addTLV = (tag: number, value: string) => {
    const encoded = encoder.encode(value);
    const tlv = new Uint8Array(2 + encoded.length);
    tlv[0] = tag;
    tlv[1] = encoded.length;
    tlv.set(encoded, 2);
    tlvParts.push(tlv);
  };
  addTLV(1, sellerName);
  addTLV(2, vatNumber);
  addTLV(3, timestamp);
  addTLV(4, totalWithVat);
  addTLV(5, vatAmount);
  const totalLength = tlvParts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of tlvParts) { result.set(part, offset); offset += part.length; }
  return btoa(String.fromCharCode(...result));
}

function getQRCodeURL(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
}

function getThermalStyles(width: PaperWidth): string {
  const bodyWidth = width === "58mm" ? "48mm" : "72mm";
  const fontSize = width === "58mm" ? "10px" : "12px";
  const titleSize = width === "58mm" ? "14px" : "16px";
  const totalSize = width === "58mm" ? "14px" : "18px";
  const qrSize = width === "58mm" ? "80px" : "120px";

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 2mm; size: ${width} auto; }
    body { font-family: 'Courier New', monospace; font-size: ${fontSize}; width: ${bodyWidth}; margin: 0 auto; padding: 2mm; direction: rtl; text-align: right; }
    .header { text-align: center; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #000; }
    .header h1 { font-size: ${titleSize}; font-weight: bold; margin-bottom: 2px; }
    .header p { font-size: ${fontSize}; }
    .separator { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { border-bottom: 1px dashed #000; text-align: right; padding: 2px 0; font-size: ${fontSize}; }
    td { padding: 2px 0; font-size: ${fontSize}; vertical-align: top; }
    .left { text-align: left; } .center { text-align: center; }
    .totals .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .totals .total-row { font-size: ${totalSize}; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
    .footer { text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; }
    .qr-section { text-align: center; margin-top: 6px; }
    .qr-section img { width: ${qrSize}; height: ${qrSize}; margin: 4px auto; }
    @media print { body { width: 100%; } }
  `;
}

function buildReceiptHTML(data: InvoiceData, vatNumber: string): string {
  const itemsRows = data.items.map(item => `
    <tr>
      <td style="max-width:60%">${item.name}<br/><span style="font-size:9px;color:#555">${item.identifier}</span></td>
      <td class="center">${item.quantity}</td>
      <td class="left">${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`).join("");

  const zatcaBase64 = generateZATCABase64(data.merchantName, vatNumber || "000000000000000", new Date().toISOString(), data.total.toFixed(2), data.tax.toFixed(2));
  const qrUrl = getQRCodeURL(zatcaBase64);

  return `
    <div class="header">
      <h1>${data.merchantName}</h1>
      <p>${data.branchName}</p>
      ${vatNumber ? `<p>الرقم الضريبي: ${vatNumber}</p>` : ''}
      <p style="margin-top:4px;font-weight:600">فاتورة ضريبية مبسطة</p>
      <p style="font-weight:600">${data.invoiceNumber}</p>
      <p>${data.date}</p>
    </div>
    ${data.customerName || data.customerPhone ? `<div style="margin-bottom:6px">${data.customerName ? `<p>العميل: ${data.customerName}</p>` : ''}${data.customerPhone ? `<p>الهاتف: ${data.customerPhone}</p>` : ''}</div><hr class="separator"/>` : ''}
    <table><thead><tr><th>الصنف</th><th class="center">الكمية</th><th class="left">المبلغ</th></tr></thead><tbody>${itemsRows}</tbody></table>
    <hr class="separator"/>
    <div class="totals">
      <div class="row"><span>المجموع</span><span>${data.subtotal.toLocaleString()} ر.س</span></div>
      <div class="row"><span>ضريبة 15%</span><span>${data.tax.toFixed(2)} ر.س</span></div>
      ${data.discount > 0 ? `<div class="row"><span>خصم</span><span>-${data.discount.toFixed(2)}</span></div>` : ''}
      <div class="row total-row"><span>الإجمالي</span><span>${data.total.toFixed(2)} ر.س</span></div>
    </div>
    <hr class="separator"/>
    <p>الدفع: ${paymentMethodLabels[data.paymentMethod]}</p>
    <div class="qr-section"><img src="${qrUrl}" alt="QR"/></div>
    <div class="footer"><p>شكراً لزيارتكم!</p></div>
  `;
}

export function InvoiceDialog({ data, onClose, onPrinted }: InvoiceDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<PrinterConfig>(getPrinterConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const zatcaBase64 = generateZATCABase64(data.merchantName, config.vatNumber || "000000000000000", new Date().toISOString(), data.total.toFixed(2), data.tax.toFixed(2));
  const qrUrl = getQRCodeURL(zatcaBase64);

  const updateConfig = (partial: Partial<PrinterConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    savePrinterConfig(newConfig);
  };

  const handleSystemPrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar"><head><title>فاتورة ${data.invoiceNumber}</title><style>${getThermalStyles(config.paperWidth)}</style></head>
      <body>${buildReceiptHTML(data, config.vatNumber)}<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()};},500)};</script></body></html>
    `);
    printWindow.document.close();
    onPrinted?.();
  };

  const handlePrint = async () => {
    if (config.type === 'system') {
      handleSystemPrint();
      return;
    }

    setIsPrinting(true);
    const receiptData: ReceiptData = {
      merchantName: data.merchantName,
      branchName: data.branchName,
      vatNumber: config.vatNumber,
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      items: data.items.map(i => ({ name: i.name, identifier: i.identifier, quantity: i.quantity, price: i.price })),
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount,
      total: data.total,
      paymentMethod: paymentMethodLabels[data.paymentMethod] || data.paymentMethod,
      qrData: zatcaBase64,
    };

    const result = await printReceipt(config, receiptData);
    setIsPrinting(false);

    if (result.success) {
      toast.success('تمت الطباعة بنجاح');
      onPrinted?.();
    } else if (result.error === 'USE_SYSTEM_PRINT') {
      handleSystemPrint();
    } else {
      toast.error(`فشلت الطباعة: ${result.error}`);
      // Fallback to system print
      handleSystemPrint();
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    const result = await testPrinterConnection(config);
    setIsTesting(false);
    setConnectionStatus(result.success ? 'success' : 'error');
    if (result.success) {
      toast.success('تم الاتصال بالطابعة بنجاح!');
    } else {
      toast.error(result.error || 'فشل الاتصال');
    }
  };

  // Auto-print
  useEffect(() => {
    if (config.autoPrint) {
      const timer = setTimeout(handlePrint, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">الفاتورة</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)}>
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} data-auto-print>
              {isPrinting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Printer className="w-4 h-4 ml-2" />}
              طباعة
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Printer Settings */}
        {showSettings && (
          <div className="p-4 border-b border-border bg-muted/30 space-y-4">
            <p className="text-sm font-semibold text-foreground">إعدادات الطابعة</p>

            {/* Connection Type */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">نوع الاتصال</Label>
              <Select value={config.type} onValueChange={(v) => { updateConfig({ type: v as PrinterType }); setConnectionStatus('idle'); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">طابعة النظام (window.print)</SelectItem>
                  <SelectItem value="epson">Epson (ePOS - شبكة)</SelectItem>
                  <SelectItem value="star">Star (WebPRNT - شبكة)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* IP Settings - only for network printers */}
            {config.type !== 'system' && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-background">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">عنوان IP الطابعة</Label>
                    <Input
                      value={config.ip}
                      onChange={(e) => { updateConfig({ ip: e.target.value }); setConnectionStatus('idle'); }}
                      placeholder="192.168.1.100"
                      className="h-9 text-sm font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">المنفذ (Port)</Label>
                    <Input
                      type="number"
                      value={config.port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 8008 })}
                      placeholder="8008"
                      className="h-9 text-sm font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                {config.type === 'epson' && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Device ID</Label>
                    <Input
                      value={config.deviceId}
                      onChange={(e) => updateConfig({ deviceId: e.target.value })}
                      placeholder="local_printer"
                      className="h-9 text-sm font-mono"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Test Connection */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleTestConnection}
                  disabled={isTesting || !config.ip}
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : connectionStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 ml-2 text-green-500" />
                  ) : connectionStatus === 'error' ? (
                    <WifiOff className="w-4 h-4 ml-2 text-destructive" />
                  ) : (
                    <Wifi className="w-4 h-4 ml-2" />
                  )}
                  {isTesting ? 'جاري الاختبار...' : 'اختبار الاتصال'}
                </Button>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {config.type === 'epson' 
                    ? '💡 يدعم طابعات Epson TM-T20/T82/T88 المتصلة بالشبكة. تأكد من تفعيل ePOS على الطابعة.'
                    : '💡 يدعم طابعات Star TSP100/TSP650 المتصلة بالشبكة. تأكد من تفعيل WebPRNT.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">عرض الورق</Label>
                <Select value={config.paperWidth} onValueChange={(v) => updateConfig({ paperWidth: v as PaperWidth })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (صغير)</SelectItem>
                    <SelectItem value="80mm">80mm (قياسي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الرقم الضريبي (VAT)</Label>
                <Input
                  value={config.vatNumber}
                  onChange={(e) => updateConfig({ vatNumber: e.target.value })}
                  placeholder="300000000000003"
                  className="h-9 text-sm font-mono"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="auto-print" checked={config.autoPrint} onCheckedChange={(v) => updateConfig({ autoPrint: v })} />
              <Label htmlFor="auto-print" className="text-sm">طباعة تلقائية بعد كل عملية بيع</Label>
            </div>
          </div>
        )}

        {/* Receipt Preview */}
        <div ref={printRef} className="p-6 font-mono text-sm" dir="rtl">
          <div className="text-center mb-3 pb-3 border-b border-dashed border-muted-foreground/30">
            <h1 className="text-lg font-bold text-foreground">{data.merchantName}</h1>
            <p className="text-xs text-muted-foreground">{data.branchName}</p>
            {config.vatNumber && <p className="text-xs text-muted-foreground mt-1">الرقم الضريبي: {config.vatNumber}</p>}
            <p className="text-sm mt-2 font-semibold text-primary">فاتورة ضريبية مبسطة</p>
            <p className="text-sm font-semibold text-foreground">{data.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">{data.date}</p>
          </div>

          {(data.customerName || data.customerPhone) && (
            <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 text-sm">
              {data.customerName && <p><span className="font-semibold">العميل:</span> {data.customerName}</p>}
              {data.customerPhone && <p><span className="font-semibold">الهاتف:</span> {data.customerPhone}</p>}
            </div>
          )}

          <table className="w-full mb-3">
            <thead>
              <tr className="border-b border-dashed border-muted-foreground/30">
                <th className="text-right py-1 text-xs font-semibold text-muted-foreground">الصنف</th>
                <th className="text-center py-1 text-xs font-semibold text-muted-foreground">الكمية</th>
                <th className="text-left py-1 text-xs font-semibold text-muted-foreground">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-dotted border-muted-foreground/10">
                  <td className="py-1 text-xs">
                    <span className="text-foreground">{item.name}</span><br />
                    <span className="text-[10px] text-muted-foreground">{item.identifier}</span>
                  </td>
                  <td className="text-center py-1 text-xs text-foreground">{item.quantity}</td>
                  <td className="text-left py-1 text-xs text-foreground">{(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-muted-foreground/30 pt-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">المجموع</span><span className="text-foreground">{data.subtotal.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ضريبة 15%</span><span className="text-foreground">{data.tax.toFixed(2)} ر.س</span></div>
            {data.discount > 0 && (
              <div className="flex justify-between text-primary"><span>خصم</span><span>-{data.discount.toFixed(2)} ر.س</span></div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-foreground/20 pt-2 mt-2">
              <span className="text-foreground">الإجمالي</span>
              <span className="text-foreground">{data.total.toFixed(2)} ر.س</span>
            </div>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">الدفع:</span> {paymentMethodLabels[data.paymentMethod]}</p>
          </div>

          <div className="flex flex-col items-center mt-4 pt-3 border-t border-dashed border-muted-foreground/30">
            <img src={qrUrl} alt="ZATCA QR" className="w-24 h-24" />
            <p className="text-[9px] text-muted-foreground mt-1">رمز هيئة الزكاة والضريبة</p>
          </div>

          <div className="text-center mt-3 pt-2 border-t border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
            <p>شكراً لزيارتكم!</p>
          </div>
        </div>

        {/* Connection indicator */}
        {config.type !== 'system' && (
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              {config.type === 'epson' ? 'Epson ePOS' : 'Star WebPRNT'}
              <span className="font-mono">{config.ip}:{config.port}</span>
            </div>
            <div className={`flex items-center gap-1 ${connectionStatus === 'success' ? 'text-green-500' : connectionStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {connectionStatus === 'success' ? <Wifi className="w-3 h-3" /> : connectionStatus === 'error' ? <WifiOff className="w-3 h-3" /> : null}
              {connectionStatus === 'success' ? 'متصل' : connectionStatus === 'error' ? 'غير متصل' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
