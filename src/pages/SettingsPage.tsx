import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Building2, Key, CreditCard, Loader2, AlertTriangle, Printer,
  Receipt, DollarSign, Globe, Shield, Save, Percent, Code2, Copy, Check, ExternalLink
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreSettings {
  taxRate: number;
  taxEnabled: boolean;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  invoiceFooter: string;
  showLogo: boolean;
  showTaxDetails: boolean;
  defaultPaymentMethod: string;
  printerWidth: string;
  autoPrint: boolean;
  printerIP: string;
  lowStockAlert: boolean;
  lowStockThreshold: number;
}

const DEFAULT_SETTINGS: StoreSettings = {
  taxRate: 15,
  taxEnabled: true,
  currency: 'SAR',
  currencySymbol: 'ر.س',
  invoicePrefix: 'INV',
  invoiceFooter: '',
  showLogo: true,
  showTaxDetails: true,
  defaultPaymentMethod: 'cash',
  printerWidth: '80',
  autoPrint: false,
  printerIP: '',
  lowStockAlert: true,
  lowStockThreshold: 5,
};

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const { merchant, subscription, refreshMerchantData } = useAuth();
  const { daysRemaining, activateWithCode, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [activationCode, setActivationCode] = useState('');

  // Business settings
  const [businessName, setBusinessName] = useState(merchant?.name || '');
  const [businessEmail, setBusinessEmail] = useState(merchant?.email || '');
  const [businessPhone, setBusinessPhone] = useState(merchant?.phone || '');
  const [businessAddress, setBusinessAddress] = useState(merchant?.address || '');
  const [crNumber, setCrNumber] = useState((merchant as any)?.cr_number || '');
  const [vatNumber, setVatNumber] = useState((merchant as any)?.vat_number || '');
  const [vatEnabled, setVatEnabled] = useState((merchant as any)?.vat_enabled ?? true);
  const [autoPrintClosing, setAutoPrintClosing] = useState((merchant as any)?.auto_print_closing ?? false);

  // Store settings from localStorage
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem('store_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSetting = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setStoreSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('store_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveBusiness = async () => {
    if (!merchant) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('merchants')
      .update({
        name: businessName,
        email: businessEmail || null,
        phone: businessPhone || null,
        address: businessAddress || null,
        cr_number: crNumber || null,
        vat_number: vatNumber || null,
        vat_enabled: vatEnabled,
        auto_print_closing: autoPrintClosing,
      } as any)
      .eq('id', merchant.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
      await refreshMerchantData();
    }
    
    setLoading(false);
  };

  const handleActivate = async () => {
    if (activationCode.trim()) {
      await activateWithCode(activationCode.trim());
      setActivationCode('');
    }
  };

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  return (
    <AppLayout title={isRTL ? "الإعدادات" : "Settings"} subtitle={isRTL ? "تكوين النظام والتفضيلات" : "System configuration & preferences"}>
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="w-4 h-4" />
            {isRTL ? "المتجر" : "Business"}
          </TabsTrigger>
          <TabsTrigger value="tax-invoice" className="gap-2">
            <Receipt className="w-4 h-4" />
            {isRTL ? "الضريبة والفاتورة" : "Tax & Invoice"}
          </TabsTrigger>
          <TabsTrigger value="printer" className="gap-2">
            <Printer className="w-4 h-4" />
            {isRTL ? "الطابعة" : "Printer"}
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="w-4 h-4" />
            {isRTL ? "الاشتراك" : "Subscription"}
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Code2 className="w-4 h-4" />
            {isRTL ? "API المحاسبي" : "Accounting API"}
          </TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-6 shadow-md">
            <h3 className="font-semibold text-foreground mb-6">
              {isRTL ? "معلومات المتجر" : "Business Information"}
            </h3>
            
            <div className="grid gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>{isRTL ? "اسم المتجر" : "Business Name"}</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "البريد الإلكتروني" : "Email"}</Label>
                <Input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الهاتف" : "Phone"}</Label>
                <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "العنوان" : "Address"}</Label>
                <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "رقم السجل التجاري" : "CR Number"}</Label>
                <Input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} dir="ltr" placeholder="1010XXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الرقم الضريبي (VAT)" : "VAT Number"}</Label>
                <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} dir="ltr" placeholder="3XXXXXXXXX00003" />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">{isRTL ? "تفعيل ضريبة القيمة المضافة 15%" : "Enable VAT 15%"}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "تطبيق الضريبة على الفواتير وعرض حالة الضريبة" : "Apply VAT to invoices"}</p>
                </div>
                <Switch checked={vatEnabled} onCheckedChange={setVatEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">{isRTL ? "طباعة إيصال الإغلاق تلقائياً" : "Auto-print closing receipt"}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "طباعة إيصال منسق فور اعتماد الإغلاق اليومي" : "Print receipt automatically after daily closing approval"}</p>
                </div>
                <Switch checked={autoPrintClosing} onCheckedChange={setAutoPrintClosing} />
              </div>
              <Button onClick={handleSaveBusiness} disabled={loading} className="w-fit gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isRTL ? "حفظ التغييرات" : "Save Changes"}
              </Button>
            </div>
          </motion.div>

          {/* Currency Settings */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-md mt-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">{isRTL ? "العملة" : "Currency"}</h3>
            </div>
            <div className="max-w-lg space-y-1">
              <SettingRow label={isRTL ? "العملة" : "Currency"} desc={isRTL ? "العملة المستخدمة في الفواتير" : "Currency used in invoices"}>
                <Select value={storeSettings.currency} onValueChange={(v) => {
                  updateSetting('currency', v);
                  updateSetting('currencySymbol', v === 'SAR' ? 'ر.س' : v === 'USD' ? '$' : v === 'EUR' ? '€' : v === 'AED' ? 'د.إ' : v === 'KWD' ? 'د.ك' : v);
                }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">SAR - ر.س</SelectItem>
                    <SelectItem value="AED">AED - د.إ</SelectItem>
                    <SelectItem value="KWD">KWD - د.ك</SelectItem>
                    <SelectItem value="USD">USD - $</SelectItem>
                    <SelectItem value="EUR">EUR - €</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </div>
          </motion.div>
        </TabsContent>

        {/* Tax & Invoice Settings */}
        <TabsContent value="tax-invoice">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{isRTL ? "إعدادات الضريبة" : "Tax Settings"}</h3>
              </div>
              <div className="space-y-1">
                <SettingRow label={isRTL ? "تفعيل الضريبة" : "Enable Tax"} desc={isRTL ? "احتساب الضريبة تلقائياً" : "Auto-calculate tax on sales"}>
                  <Switch checked={storeSettings.taxEnabled} onCheckedChange={(v) => updateSetting('taxEnabled', v)} />
                </SettingRow>
                <SettingRow label={isRTL ? "نسبة الضريبة %" : "Tax Rate %"} desc={isRTL ? "نسبة ضريبة القيمة المضافة" : "VAT percentage rate"}>
                  <Input type="number" className="w-20 h-8 text-center" min={0} max={100}
                    value={storeSettings.taxRate} onChange={(e) => updateSetting('taxRate', Number(e.target.value))} />
                </SettingRow>
                <SettingRow label={isRTL ? "عرض تفاصيل الضريبة" : "Show Tax Details"} desc={isRTL ? "إظهار مبلغ الضريبة في الفاتورة" : "Display tax amount on invoice"}>
                  <Switch checked={storeSettings.showTaxDetails} onCheckedChange={(v) => updateSetting('showTaxDetails', v)} />
                </SettingRow>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-xl border border-border p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{isRTL ? "إعدادات الفاتورة" : "Invoice Settings"}</h3>
              </div>
              <div className="space-y-1">
                <SettingRow label={isRTL ? "بادئة رقم الفاتورة" : "Invoice Prefix"}>
                  <Input className="w-24 h-8 text-center font-mono" value={storeSettings.invoicePrefix}
                    onChange={(e) => updateSetting('invoicePrefix', e.target.value)} />
                </SettingRow>
                <SettingRow label={isRTL ? "إظهار الشعار" : "Show Logo"} desc={isRTL ? "عرض شعار المتجر في الفاتورة" : "Display store logo on receipt"}>
                  <Switch checked={storeSettings.showLogo} onCheckedChange={(v) => updateSetting('showLogo', v)} />
                </SettingRow>
                <SettingRow label={isRTL ? "طريقة الدفع الافتراضية" : "Default Payment"}>
                  <Select value={storeSettings.defaultPaymentMethod} onValueChange={(v) => updateSetting('defaultPaymentMethod', v)}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{isRTL ? "نقد" : "Cash"}</SelectItem>
                      <SelectItem value="card">{isRTL ? "بطاقة" : "Card"}</SelectItem>
                      <SelectItem value="bank_transfer">{isRTL ? "تحويل" : "Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
              <div className="mt-4 space-y-2">
                <Label>{isRTL ? "تذييل الفاتورة" : "Invoice Footer"}</Label>
                <Textarea className="h-20 text-sm" placeholder={isRTL ? "شكراً لتسوقكم..." : "Thank you for shopping..."}
                  value={storeSettings.invoiceFooter} onChange={(e) => updateSetting('invoiceFooter', e.target.value)} />
              </div>
            </motion.div>
          </div>
        </TabsContent>

        {/* Printer Settings */}
        <TabsContent value="printer">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-6 shadow-md max-w-lg">
            <div className="flex items-center gap-2 mb-4">
              <Printer className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">{isRTL ? "إعدادات الطابعة" : "Printer Settings"}</h3>
            </div>
            <div className="space-y-1">
              <SettingRow label={isRTL ? "عرض الورق" : "Paper Width"}>
                <Select value={storeSettings.printerWidth} onValueChange={(v) => updateSetting('printerWidth', v)}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label={isRTL ? "طباعة تلقائية" : "Auto Print"} desc={isRTL ? "طباعة الفاتورة تلقائياً بعد البيع" : "Print receipt automatically after sale"}>
                <Switch checked={storeSettings.autoPrint} onCheckedChange={(v) => {
                  updateSetting('autoPrint', v);
                  localStorage.setItem('pos_printer_prefs', JSON.stringify({ autoPrint: v }));
                }} />
              </SettingRow>
              <SettingRow label={isRTL ? "عنوان IP الطابعة" : "Printer IP"} desc={isRTL ? "للطباعة المباشرة عبر الشبكة" : "For direct network printing"}>
                <Input className="w-40 h-8 text-sm font-mono" placeholder="192.168.1.100"
                  value={storeSettings.printerIP} onChange={(e) => updateSetting('printerIP', e.target.value)} />
              </SettingRow>
            </div>

            <div className="mt-6 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{isRTL ? "تنبيهات المخزون" : "Stock Alerts"}</h3>
              </div>
              <SettingRow label={isRTL ? "تفعيل التنبيهات" : "Enable Alerts"} desc={isRTL ? "تنبيه عند انخفاض المخزون" : "Alert when stock is low"}>
                <Switch checked={storeSettings.lowStockAlert} onCheckedChange={(v) => updateSetting('lowStockAlert', v)} />
              </SettingRow>
              <SettingRow label={isRTL ? "حد التنبيه" : "Alert Threshold"} desc={isRTL ? "الحد الأدنى للتنبيه" : "Minimum qty to trigger alert"}>
                <Input type="number" className="w-20 h-8 text-center" min={1}
                  value={storeSettings.lowStockThreshold} onChange={(e) => updateSetting('lowStockThreshold', Number(e.target.value))} />
              </SettingRow>
            </div>
          </motion.div>
        </TabsContent>

        {/* Subscription Settings */}
        <TabsContent value="subscription">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 shadow-md">
              <h3 className="font-semibold text-foreground mb-6">{isRTL ? "الخطة الحالية" : "Current Plan"}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="font-semibold text-foreground capitalize">{subscription?.plan || 'Free'}</p>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? "الحالة: " : "Status: "}
                      <span className={cn("font-medium",
                        subscription?.status === 'active' ? 'text-green-600' :
                        subscription?.status === 'trial' ? 'text-yellow-600' : 'text-destructive'
                      )}>{subscription?.status?.toUpperCase()}</span>
                    </p>
                  </div>
                  {subscription?.status === 'trial' && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-600">{daysRemaining}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? "يوم متبقي" : "days left"}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? "أقصى عدد فروع" : "Max Branches"}</span>
                    <span className="font-medium">{subscription?.max_branches || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? "أقصى عدد مستخدمين" : "Max Users"}</span>
                    <span className="font-medium">{subscription?.max_users || 3}</span>
                  </div>
                  {subscription?.trial_ends_at && subscription.status === 'trial' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isRTL ? "ينتهي في" : "Trial Ends"}</span>
                      <span className="font-medium">{new Date(subscription.trial_ends_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-xl border border-border p-6 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <Key className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{isRTL ? "رمز التفعيل" : "Activation Code"}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {isRTL ? "أدخل رمز التفعيل لتمديد الاشتراك." : "Enter an activation code to extend your subscription."}
              </p>
              <div className="space-y-4">
                <Input value={activationCode} onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  placeholder="ACTIVATE-30" className="font-mono" />
                <Button onClick={handleActivate} disabled={subLoading || !activationCode.trim()} className="w-full">
                  {subLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isRTL ? "تفعيل الرمز" : "Activate Code"}
                </Button>
              </div>
            </motion.div>
          </div>

          {subscription?.status === 'trial' && daysRemaining <= 3 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{isRTL ? "الاشتراك التجريبي ينتهي قريباً" : "Trial Ending Soon"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRTL 
                    ? `ينتهي اشتراكك التجريبي خلال ${daysRemaining} يوم. أدخل رمز التفعيل للاستمرار.`
                    : `Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Enter an activation code to continue.`}
                </p>
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* Accounting API */}
        <TabsContent value="api">
          <AccountingAPISection isRTL={isRTL} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function AccountingAPISection({ isRTL }: { isRTL: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounting-api`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(isRTL ? 'تم النسخ' : 'Copied!');
  };

  const endpoints = [
    { method: 'GET', path: '/sales', desc: isRTL ? 'قائمة المبيعات مع التفاصيل' : 'List sales with items' },
    { method: 'GET', path: '/sales/summary', desc: isRTL ? 'ملخص المبيعات (إجمالي، ضريبة، خصم)' : 'Sales summary (totals, tax, discount)' },
    { method: 'GET', path: '/inventory/devices', desc: isRTL ? 'قائمة الأجهزة' : 'List devices' },
    { method: 'GET', path: '/inventory/accessories', desc: isRTL ? 'قائمة الإكسسوارات' : 'List accessories' },
    { method: 'GET', path: '/daily-closings', desc: isRTL ? 'تقارير الإغلاق اليومي' : 'Daily closing reports' },
    { method: 'GET', path: '/suppliers', desc: isRTL ? 'قائمة الموردين' : 'List suppliers' },
    { method: 'GET', path: '/purchases', desc: isRTL ? 'أوامر الشراء' : 'Purchase orders' },
  ];

  const exampleCurl = `curl -X GET "${baseUrl}/sales/summary?from=2025-01-01&to=2025-12-31" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isRTL ? "API للربط مع الأنظمة المحاسبية" : "Accounting Integration API"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {isRTL 
            ? "استخدم هذا الـ API لربط نظامك المحاسبي (قيود، دفترة، Xero، QuickBooks أو أي نظام آخر) للحصول على بيانات المبيعات والمخزون والمشتريات."
            : "Use this API to integrate with your accounting system (Qoyod, Daftra, Xero, QuickBooks, etc.) to fetch sales, inventory, and purchase data."}
        </p>

        {/* Base URL */}
        <div className="mb-6">
          <Label className="text-xs text-muted-foreground mb-1 block">
            {isRTL ? "رابط الـ API الأساسي" : "Base URL"}
          </Label>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 border border-border">
            <code className="text-sm font-mono text-foreground flex-1 break-all" dir="ltr">{baseUrl}</code>
            <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" 
              onClick={() => copyToClipboard(baseUrl, 'url')}>
              {copied === 'url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Auth Info */}
        <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-foreground">
              {isRTL ? "المصادقة" : "Authentication"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isRTL 
              ? "أرسل JWT token في الهيدر Authorization كالتالي: Bearer <token>. يجب أن يكون المستخدم بصلاحية owner أو admin."
              : "Send JWT token in Authorization header: Bearer <token>. User must have owner or admin role."}
          </p>
        </div>
      </motion.div>

      {/* Endpoints */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card rounded-xl border border-border p-6 shadow-md">
        <h3 className="font-semibold text-foreground mb-4">
          {isRTL ? "نقاط النهاية المتاحة" : "Available Endpoints"}
        </h3>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div key={ep.path} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 border border-border/50 transition-colors">
              <span className="text-xs font-mono font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded">{ep.method}</span>
              <code className="text-sm font-mono text-foreground flex-1" dir="ltr">{ep.path}</code>
              <span className="text-xs text-muted-foreground hidden sm:block">{ep.desc}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, ep.path)}>
                {copied === ep.path ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          ))}
        </div>

        {/* Query Params */}
        <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
          <h4 className="text-sm font-medium text-foreground mb-2">
            {isRTL ? "المعاملات المتاحة" : "Query Parameters"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div><code className="text-primary font-mono">from</code> — {isRTL ? "تاريخ البداية (ISO 8601)" : "Start date (ISO 8601)"}</div>
            <div><code className="text-primary font-mono">to</code> — {isRTL ? "تاريخ النهاية" : "End date"}</div>
            <div><code className="text-primary font-mono">limit</code> — {isRTL ? "عدد النتائج (حد أقصى 1000)" : "Max results (max 1000)"}</div>
            <div><code className="text-primary font-mono">offset</code> — {isRTL ? "ترقيم الصفحات" : "Pagination offset"}</div>
            <div><code className="text-primary font-mono">status</code> — {isRTL ? "فلترة بالحالة (الأجهزة فقط)" : "Filter by status (devices only)"}</div>
          </div>
        </div>
      </motion.div>

      {/* Example */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">
            {isRTL ? "مثال استخدام" : "Usage Example"}
          </h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => copyToClipboard(exampleCurl, 'curl')}>
            {copied === 'curl' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {isRTL ? "نسخ" : "Copy"}
          </Button>
        </div>
        <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground border border-border/50" dir="ltr">
          {exampleCurl}
        </pre>

        <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs text-muted-foreground">
            💡 {isRTL 
              ? "للحصول على JWT token، سجل دخول عبر التطبيق واستخدم supabase.auth.getSession() للحصول على access_token."
              : "To get a JWT token, sign in via the app and use supabase.auth.getSession() to get the access_token."}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
