import { useRef, useState, useEffect } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RepairOrder } from "@/hooks/useRepairs";
import type { RepairOrderPart } from "@/hooks/useRepairParts";
import {
  getPrinterConfig,
  type PrinterConfig,
  type PaperWidth,
} from "@/services/thermalPrinter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface RepairInvoiceDialogProps {
  repair: RepairOrder;
  usedParts: RepairOrderPart[];
  merchantName: string;
  branchName: string;
  vatNumber?: string;
  onClose: () => void;
}

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
    .info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: ${fontSize}; }
    @media print { body { width: 100%; } }
  `;
}

export function RepairInvoiceDialog({ repair, usedParts, merchantName, branchName, vatNumber: propVatNumber, onClose }: RepairInvoiceDialogProps) {
  const [config] = useState<PrinterConfig>(getPrinterConfig());
  const [isPrinting, setIsPrinting] = useState(false);

  const vatNumber = propVatNumber || config.vatNumber || "";
  const partsCostTotal = usedParts.reduce((s, p) => s + p.unit_cost * p.quantity, 0);
  const laborCost = repair.actual_cost || repair.estimated_cost || 0;
  const totalBeforeVAT = laborCost + partsCostTotal;
  const total = totalBeforeVAT; // السعر شامل الضريبة
  const tax = total - (total / 1.15);
  const subtotal = total - tax;

  const zatcaBase64 = generateZATCABase64(merchantName, vatNumber || "000000000000000", new Date().toISOString(), total.toFixed(2), tax.toFixed(2));
  const qrUrl = getQRCodeURL(zatcaBase64);

  const handlePrint = () => {
    setIsPrinting(true);

    const partsRows = usedParts.map(p => `
      <tr>
        <td>${(p.repair_part as any)?.name || 'قطعة'}</td>
        <td class="center">${p.quantity}</td>
        <td class="left">${(p.unit_cost * p.quantity).toLocaleString()}</td>
      </tr>
    `).join("");

    const html = `
      <div class="header">
        <h1>${merchantName}</h1>
        <p>${branchName}</p>
        ${vatNumber ? `<p>الرقم الضريبي: ${vatNumber}</p>` : ''}
        <p style="margin-top:4px;font-weight:600">فاتورة صيانة</p>
        <p style="font-weight:600">${repair.repair_number}</p>
        <p>${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
      </div>

      <div style="margin-bottom:6px">
        <p>العميل: ${repair.customer_name}</p>
        ${repair.customer_phone ? `<p>الهاتف: ${repair.customer_phone}</p>` : ''}
      </div>
      <hr class="separator"/>

      <div style="margin-bottom:6px">
        <div class="info-row"><span>الجهاز:</span><span>${repair.device_brand || ''} ${repair.device_model || repair.device_type}</span></div>
        ${repair.device_imei ? `<div class="info-row"><span>IMEI:</span><span style="font-family:monospace">${repair.device_imei}</span></div>` : ''}
        ${repair.device_color ? `<div class="info-row"><span>اللون:</span><span>${repair.device_color}</span></div>` : ''}
      </div>
      <hr class="separator"/>

      <div style="margin-bottom:6px">
        <p style="font-weight:600;margin-bottom:4px">العطل:</p>
        <p>${repair.issue_description}</p>
        ${repair.diagnosis_notes ? `<p style="margin-top:4px;font-weight:600">التشخيص:</p><p>${repair.diagnosis_notes}</p>` : ''}
      </div>
      <hr class="separator"/>

      ${usedParts.length > 0 ? `
        <p style="font-weight:600;margin-bottom:4px">القطع المستخدمة:</p>
        <table>
          <thead><tr><th>القطعة</th><th class="center">الكمية</th><th class="left">المبلغ</th></tr></thead>
          <tbody>${partsRows}</tbody>
        </table>
        <hr class="separator"/>
      ` : ''}

      <div class="totals">
        ${usedParts.length > 0 ? `<div class="row"><span>تكلفة القطع</span><span>${partsCostTotal.toLocaleString()} ر.س</span></div>` : ''}
        <div class="row"><span>أجرة الإصلاح</span><span>${(laborCost - partsCostTotal).toLocaleString()} ر.س</span></div>
        <div class="row"><span>المجموع قبل الضريبة</span><span>${subtotal.toFixed(2)} ر.س</span></div>
        <div class="row"><span>ضريبة 15%</span><span>${tax.toFixed(2)} ر.س</span></div>
        <div class="row total-row"><span>الإجمالي</span><span>${total.toFixed(2)} ر.س</span></div>
      </div>
      <hr class="separator"/>

      <div style="margin:4px 0">
        <div class="info-row"><span>حالة الدفع:</span><span>${repair.payment_status === 'paid' ? 'مدفوع' : repair.payment_status === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'}</span></div>
        ${repair.paid_amount > 0 ? `<div class="info-row"><span>المبلغ المدفوع:</span><span>${repair.paid_amount.toLocaleString()} ر.س</span></div>` : ''}
      </div>

      ${repair.warranty_days > 0 ? `
        <hr class="separator"/>
        <div style="text-align:center;margin:4px 0">
          <p style="font-weight:600">ضمان ${repair.warranty_days} يوم</p>
          ${repair.warranty_ends_at ? `<p style="font-size:10px">ينتهي: ${format(new Date(repair.warranty_ends_at), 'dd/MM/yyyy')}</p>` : '<p style="font-size:10px">يبدأ من تاريخ التسليم</p>'}
        </div>
      ` : ''}

      <div class="qr-section"><img src="${qrUrl}" alt="QR"/></div>
      <div class="footer"><p>شكراً لثقتكم!</p></div>
    `;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      setIsPrinting(false);
      toast.error("تعذر فتح نافذة الطباعة");
      return;
    }
    printWindow.document.write(`
      <html dir="rtl" lang="ar"><head><title>فاتورة صيانة ${repair.repair_number}</title><style>${getThermalStyles(config.paperWidth)}</style></head>
      <body>${html}<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()};},500)};</script></body></html>
    `);
    printWindow.document.close();
    setIsPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">فاتورة صيانة</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Printer className="w-4 h-4 ml-2" />}
              طباعة
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Receipt Preview */}
        <div className="p-6 font-mono text-sm" dir="rtl">
          <div className="text-center mb-3 pb-3 border-b border-dashed border-muted-foreground/30">
            <h1 className="text-lg font-bold text-foreground">{merchantName}</h1>
            <p className="text-xs text-muted-foreground">{branchName}</p>
            {vatNumber && <p className="text-xs text-muted-foreground mt-1">الرقم الضريبي: {vatNumber}</p>}
            <p className="text-sm mt-2 font-semibold text-primary">فاتورة صيانة</p>
            <p className="text-sm font-semibold text-foreground">{repair.repair_number}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
          </div>

          {/* Customer */}
          <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 text-sm">
            <p><span className="font-semibold">العميل:</span> {repair.customer_name}</p>
            {repair.customer_phone && <p><span className="font-semibold">الهاتف:</span> {repair.customer_phone}</p>}
          </div>

          {/* Device */}
          <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الجهاز</span>
              <span className="font-medium text-foreground">{repair.device_brand} {repair.device_model || repair.device_type}</span>
            </div>
            {repair.device_imei && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IMEI</span>
                <span className="font-medium text-foreground">{repair.device_imei}</span>
              </div>
            )}
            {repair.device_color && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">اللون</span>
                <span className="font-medium text-foreground">{repair.device_color}</span>
              </div>
            )}
          </div>

          {/* Issue */}
          <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 text-sm">
            <p className="font-semibold mb-1">العطل:</p>
            <p className="text-foreground">{repair.issue_description}</p>
            {repair.diagnosis_notes && (
              <>
                <p className="font-semibold mb-1 mt-2">التشخيص:</p>
                <p className="text-foreground">{repair.diagnosis_notes}</p>
              </>
            )}
          </div>

          {/* Parts */}
          {usedParts.length > 0 && (
            <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30">
              <p className="font-semibold text-sm mb-2">القطع المستخدمة:</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashed border-muted-foreground/30">
                    <th className="text-right py-1 text-xs font-semibold text-muted-foreground">القطعة</th>
                    <th className="text-center py-1 text-xs font-semibold text-muted-foreground">الكمية</th>
                    <th className="text-left py-1 text-xs font-semibold text-muted-foreground">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {usedParts.map((p) => (
                    <tr key={p.id} className="border-b border-dotted border-muted-foreground/10">
                      <td className="py-1 text-foreground">{(p.repair_part as any)?.name || 'قطعة'}</td>
                      <td className="text-center py-1 text-foreground">{p.quantity}</td>
                      <td className="text-left py-1 text-foreground">{(p.unit_cost * p.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 space-y-1 text-sm">
            {usedParts.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">تكلفة القطع</span>
                <span className="text-foreground">{partsCostTotal.toLocaleString()} ر.س</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">أجرة الإصلاح</span>
              <span className="text-foreground">{(laborCost - partsCostTotal).toLocaleString()} ر.س</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع قبل الضريبة</span>
              <span className="text-foreground">{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ضريبة 15%</span>
              <span className="text-foreground">{tax.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-bold text-base">
              <span>الإجمالي</span>
              <span className="text-primary">{total.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="mb-3 pb-3 border-b border-dashed border-muted-foreground/30 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">حالة الدفع</span>
              <span className="font-medium text-foreground">
                {repair.payment_status === 'paid' ? 'مدفوع' : repair.payment_status === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'}
              </span>
            </div>
            {repair.paid_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">المبلغ المدفوع</span>
                <span className="font-medium text-foreground">{repair.paid_amount.toLocaleString()} ر.س</span>
              </div>
            )}
          </div>

          {/* Warranty */}
          {repair.warranty_days > 0 && (
            <div className="text-center mb-3 pb-3 border-b border-dashed border-muted-foreground/30">
              <p className="font-semibold text-sm">ضمان {repair.warranty_days} يوم</p>
              {repair.warranty_ends_at ? (
                <p className="text-xs text-muted-foreground">ينتهي: {format(new Date(repair.warranty_ends_at), 'dd/MM/yyyy')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">يبدأ من تاريخ التسليم</p>
              )}
            </div>
          )}

          {/* QR */}
          <div className="text-center mb-3">
            <img src={qrUrl} alt="QR" className="w-24 h-24 mx-auto" />
          </div>

          <div className="text-center text-xs text-muted-foreground pt-3 border-t border-dashed border-muted-foreground/30">
            <p>شكراً لثقتكم!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
