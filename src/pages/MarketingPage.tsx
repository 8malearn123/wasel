import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/i18n";
import { useMarketing, Coupon, Campaign } from "@/hooks/useMarketing";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from '@/components/common/UrlTabs';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Ticket, Megaphone, Trash2, Pencil, Copy, Zap, Package, Tag, PercentIcon } from "lucide-react";
import { format } from "date-fns";

export default function MarketingPage() {
  const { t, language } = useLanguage();
  const mk = t.marketing;
  const { devices } = useDevices();
  const { accessories } = useAccessories();

  // Products from real inventory for campaign targeting
  const productOptions = useMemo(() => {
    const models = new Set<string>();
    for (const d of devices) {
      models.add(`${d.brand ? d.brand + ' ' : ''}${d.model}${d.storage ? ' ' + d.storage : ''}`.trim());
    }
    return [
      ...[...models].map(m => ({ value: `جهاز: ${m}`, label: `📱 ${m}` })),
      ...accessories.map(a => ({ value: `إكسسوار: ${a.name}`, label: `🎧 ${a.name}` })),
    ];
  }, [devices, accessories]);
  const {
    coupons, campaigns, loading,
    createCoupon, updateCoupon, deleteCoupon, toggleCoupon,
    createCampaign, updateCampaign, deleteCampaign, toggleCampaign,
  } = useMarketing();

  const [couponDialog, setCouponDialog] = useState(false);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: '', name: '', discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0, min_order_amount: 0, max_discount_amount: null as number | null,
    max_uses: null as number | null, is_active: true,
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: '' as string, applies_to: 'all' as 'all' | 'devices' | 'accessories',
  });

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: '', description: '',
    campaign_type: 'discount' as 'discount' | 'bundle' | 'flash_sale' | 'buy_x_get_y',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0, buy_quantity: null as number | null, get_quantity: null as number | null,
    is_active: false, starts_at: new Date().toISOString().slice(0, 16), ends_at: '' as string,
    apply_scope: 'all' as 'all' | 'product', product_main: '', product_x: '', product_y: '',
  });

  const resetCouponForm = () => {
    setCouponForm({
      code: '', name: '', discount_type: 'percentage', discount_value: 0,
      min_order_amount: 0, max_discount_amount: null, max_uses: null, is_active: true,
      starts_at: new Date().toISOString().slice(0, 16), expires_at: '', applies_to: 'all',
    });
    setEditingCoupon(null);
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: '', description: '', campaign_type: 'discount', discount_type: 'percentage',
      discount_value: 0, buy_quantity: null, get_quantity: null, is_active: false,
      starts_at: new Date().toISOString().slice(0, 16), ends_at: '',
      apply_scope: 'all', product_main: '', product_x: '', product_y: '',
    });
    setEditingCampaign(null);
  };

  const openEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code, name: c.name, discount_type: c.discount_type,
      discount_value: c.discount_value, min_order_amount: c.min_order_amount,
      max_discount_amount: c.max_discount_amount, max_uses: c.max_uses, is_active: c.is_active,
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
      applies_to: c.applies_to,
    });
    setCouponDialog(true);
  };

  const openEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name, description: c.description || '',
      campaign_type: c.campaign_type, discount_type: c.discount_type,
      discount_value: c.discount_value, buy_quantity: c.buy_quantity,
      get_quantity: c.get_quantity, is_active: c.is_active,
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : '',
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : '',
    });
    setCampaignDialog(true);
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.name) {
      toast({ title: mk.error, description: mk.fillRequired, variant: 'destructive' });
      return;
    }
    const payload = {
      ...couponForm,
      starts_at: couponForm.starts_at ? new Date(couponForm.starts_at).toISOString() : new Date().toISOString(),
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
    };
    let ok;
    if (editingCoupon) {
      ok = await updateCoupon(editingCoupon.id, payload);
    } else {
      ok = await createCoupon(payload);
    }
    if (ok) {
      toast({ title: mk.saved });
      setCouponDialog(false);
      resetCouponForm();
    }
  };

  const handleSaveCampaign = async () => {
    const f = campaignForm;
    if (!f.name) {
      toast({ title: mk.error, description: mk.fillRequired, variant: 'destructive' });
      return;
    }
    // Per-type required fields
    if (f.campaign_type === 'discount' && f.apply_scope === 'product' && !f.product_main) {
      toast({ title: mk.error, description: 'اختر المنتج الذي يطبق عليه الخصم', variant: 'destructive' }); return;
    }
    if (f.campaign_type === 'flash_sale' && !f.product_main) {
      toast({ title: mk.error, description: 'اختر منتج التخفيض السريع', variant: 'destructive' }); return;
    }
    if (f.campaign_type === 'bundle' && (!f.product_x || !f.product_y || !f.discount_value)) {
      toast({ title: mk.error, description: 'اختر منتجي الحزمة وحدد سعرها', variant: 'destructive' }); return;
    }
    if (f.campaign_type === 'buy_x_get_y' && (!f.product_x || !f.product_y)) {
      toast({ title: mk.error, description: 'اختر المنتج المطلوب شراؤه والمنتج الهدية', variant: 'destructive' }); return;
    }

    // Auto-describe the campaign from the picked products
    const autoParts: string[] = [];
    if (f.campaign_type === 'discount') {
      autoParts.push(f.apply_scope === 'product' ? `يطبق على: ${f.product_main}` : 'يطبق على: كل المنتجات');
    }
    if (f.campaign_type === 'flash_sale') autoParts.push(`تخفيض سريع على: ${f.product_main}`);
    if (f.campaign_type === 'bundle') autoParts.push(`الحزمة: ${f.product_x} + ${f.product_y} بسعر ${f.discount_value} ر.س`);
    if (f.campaign_type === 'buy_x_get_y') autoParts.push(`اشترِ ${f.buy_quantity || 1} × ${f.product_x} واحصل على ${f.get_quantity || 1} × ${f.product_y}`);
    const description = [autoParts.join(' — '), f.description].filter(Boolean).join(' | ');

    const payload = {
      name: f.name,
      description,
      campaign_type: f.campaign_type,
      discount_type: f.campaign_type === 'bundle' ? 'fixed' as const : f.discount_type,
      discount_value: f.discount_value,
      buy_quantity: f.buy_quantity,
      get_quantity: f.get_quantity,
      is_active: f.is_active,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : new Date().toISOString(),
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    };
    let ok;
    if (editingCampaign) {
      ok = await updateCampaign(editingCampaign.id, payload);
    } else {
      ok = await createCampaign(payload);
    }
    if (ok) {
      toast({ title: mk.saved });
      setCampaignDialog(false);
      resetCampaignForm();
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: mk.codeCopied });
  };

  const campaignTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      discount: mk.typeDiscount,
      bundle: mk.typeBundle,
      flash_sale: mk.typeFlashSale,
      buy_x_get_y: mk.typeBuyXGetY,
    };
    return map[type] || type;
  };

  const campaignTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      discount: PercentIcon,
      bundle: Package,
      flash_sale: Zap,
      buy_x_get_y: Tag,
    };
    const Icon = icons[type] || Tag;
    return <Icon className="h-4 w-4" />;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const activeCoupons = coupons.filter(c => c.is_active && !isExpired(c.expires_at));
  const activeCampaigns = campaigns.filter(c => c.is_active && !isExpired(c.ends_at));

  return (
    <AppLayout title={mk.title} subtitle={mk.subtitle}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mk.title}</h1>
            <p className="text-muted-foreground">{mk.subtitle}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{mk.totalCoupons}</p>
                  <p className="text-2xl font-bold">{coupons.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-accent-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{mk.activeCoupons}</p>
                  <p className="text-2xl font-bold">{activeCoupons.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{mk.totalCampaigns}</p>
                  <p className="text-2xl font-bold">{campaigns.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-accent-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{mk.activeCampaigns}</p>
                  <p className="text-2xl font-bold">{activeCampaigns.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <UrlTabs defaultTab="coupons">

          {/* COUPONS TAB */}
          <TabsContent value="coupons" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{mk.couponsTab}</h2>
              <Button onClick={() => { resetCouponForm(); setCouponDialog(true); }}>
                <Plus className="h-4 w-4 me-1" /> {mk.addCoupon}
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : coupons.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{mk.noCoupons}</p>
                  <Button className="mt-4" onClick={() => { resetCouponForm(); setCouponDialog(true); }}>
                    <Plus className="h-4 w-4 me-1" /> {mk.addCoupon}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{mk.couponCode}</TableHead>
                      <TableHead>{mk.couponName}</TableHead>
                      <TableHead>{mk.discount}</TableHead>
                      <TableHead>{mk.usageCount}</TableHead>
                      <TableHead>{mk.expiryDate}</TableHead>
                      <TableHead>{mk.status}</TableHead>
                      <TableHead>{mk.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{c.code}</code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCouponCode(c.code)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} SAR`}
                        </TableCell>
                        <TableCell>
                          {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                        </TableCell>
                        <TableCell>
                          {c.expires_at ? format(new Date(c.expires_at), 'yyyy-MM-dd') : mk.noExpiry}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={c.is_active}
                              onCheckedChange={(val) => toggleCoupon(c.id, val)}
                            />
                            {isExpired(c.expires_at) ? (
                              <Badge variant="destructive">{mk.expired}</Badge>
                            ) : c.is_active ? (
                              <Badge className="bg-primary text-primary-foreground">{mk.active}</Badge>
                            ) : (
                              <Badge variant="secondary">{mk.inactive}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditCoupon(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteCoupon(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* CAMPAIGNS TAB */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{mk.campaignsTab}</h2>
              <Button onClick={() => { resetCampaignForm(); setCampaignDialog(true); }}>
                <Plus className="h-4 w-4 me-1" /> {mk.addCampaign}
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{mk.noCampaigns}</p>
                  <Button className="mt-4" onClick={() => { resetCampaignForm(); setCampaignDialog(true); }}>
                    <Plus className="h-4 w-4 me-1" /> {mk.addCampaign}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {campaigns.map(c => (
                  <Card key={c.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {campaignTypeIcon(c.campaign_type)}
                          <CardTitle className="text-base">{c.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={c.is_active}
                            onCheckedChange={(val) => toggleCampaign(c.id, val)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Badge variant="outline">{campaignTypeLabel(c.campaign_type)}</Badge>
                      {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                      <div className="text-sm space-y-1">
                        {c.campaign_type === 'buy_x_get_y' ? (
                          <p>{mk.buy} {c.buy_quantity} {mk.get} {c.get_quantity}</p>
                        ) : (
                          <p>{mk.discount}: {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} SAR`}</p>
                        )}
                        <p className="text-muted-foreground">
                          {c.starts_at && format(new Date(c.starts_at), 'yyyy-MM-dd')}
                          {c.ends_at && ` → ${format(new Date(c.ends_at), 'yyyy-MM-dd')}`}
                        </p>
                      </div>
                      {isExpired(c.ends_at) && <Badge variant="destructive">{mk.expired}</Badge>}
                      <div className="flex gap-1 pt-2">
                        <Button variant="outline" size="sm" onClick={() => openEditCampaign(c)}>
                          <Pencil className="h-3 w-3 me-1" /> {mk.edit}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteCampaign(c.id)}>
                          <Trash2 className="h-3 w-3 me-1 text-destructive" /> {mk.delete}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </UrlTabs>

        {/* COUPON DIALOG */}
        <Dialog open={couponDialog} onOpenChange={(v) => { setCouponDialog(v); if (!v) resetCouponForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? mk.editCoupon : mk.addCoupon}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.couponCode} *</Label>
                  <Input value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="SAVE20" />
                </div>
                <div>
                  <Label>{mk.couponName} *</Label>
                  <Input value={couponForm.name} onChange={e => setCouponForm(p => ({ ...p, name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.discountType}</Label>
                  <Select value={couponForm.discount_type} onValueChange={v => setCouponForm(p => ({ ...p, discount_type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{mk.percentage}</SelectItem>
                      <SelectItem value="fixed">{mk.fixedAmount}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{mk.discountValue}</Label>
                  <Input type="number" value={couponForm.discount_value} onChange={e => setCouponForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.minOrder}</Label>
                  <Input type="number" value={couponForm.min_order_amount} onChange={e => setCouponForm(p => ({ ...p, min_order_amount: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>{mk.maxDiscount}</Label>
                  <Input type="number" value={couponForm.max_discount_amount ?? ''} onChange={e => setCouponForm(p => ({ ...p, max_discount_amount: e.target.value ? Number(e.target.value) : null }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.maxUses}</Label>
                  <Input type="number" value={couponForm.max_uses ?? ''} onChange={e => setCouponForm(p => ({ ...p, max_uses: e.target.value ? Number(e.target.value) : null }))} />
                </div>
                <div>
                  <Label>{mk.appliesTo}</Label>
                  <Select value={couponForm.applies_to} onValueChange={v => setCouponForm(p => ({ ...p, applies_to: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{mk.allProducts}</SelectItem>
                      <SelectItem value="devices">{mk.devicesOnly}</SelectItem>
                      <SelectItem value="accessories">{mk.accessoriesOnly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.startDate}</Label>
                  <Input type="datetime-local" value={couponForm.starts_at} onChange={e => setCouponForm(p => ({ ...p, starts_at: e.target.value }))} />
                </div>
                <div>
                  <Label>{mk.expiryDate}</Label>
                  <Input type="datetime-local" value={couponForm.expires_at} onChange={e => setCouponForm(p => ({ ...p, expires_at: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={couponForm.is_active} onCheckedChange={v => setCouponForm(p => ({ ...p, is_active: v }))} />
                <Label>{mk.active}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCouponDialog(false)}>{mk.cancel}</Button>
              <Button onClick={handleSaveCoupon}>{mk.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CAMPAIGN DIALOG */}
        <Dialog open={campaignDialog} onOpenChange={(v) => { setCampaignDialog(v); if (!v) resetCampaignForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? mk.editCampaign : mk.addCampaign}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{mk.campaignName} *</Label>
                <Input value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>{mk.campaignDescription}</Label>
                <Textarea value={campaignForm.description} onChange={e => setCampaignForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <Label>{mk.campaignType}</Label>
                <Select value={campaignForm.campaign_type} onValueChange={v => setCampaignForm(p => ({ ...p, campaign_type: v as any, apply_scope: 'all', product_main: '', product_x: '', product_y: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">{mk.typeDiscount}</SelectItem>
                    <SelectItem value="bundle">{mk.typeBundle}</SelectItem>
                    <SelectItem value="flash_sale">{mk.typeFlashSale}</SelectItem>
                    <SelectItem value="buy_x_get_y">{mk.typeBuyXGetY}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {campaignForm.campaign_type === 'discount' && 'خصم بنسبة أو مبلغ ثابت — على كل المنتجات أو منتج محدد'}
                  {campaignForm.campaign_type === 'bundle' && 'منتجان يُباعان معاً بسعر واحد مخفض'}
                  {campaignForm.campaign_type === 'flash_sale' && 'تخفيض قوي لفترة قصيرة على منتج محدد'}
                  {campaignForm.campaign_type === 'buy_x_get_y' && 'العميل يشتري منتجاً ويحصل على منتج آخر هدية'}
                </p>
              </div>

              {(() => {
                const ProductSelect = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {productOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );

                if (campaignForm.campaign_type === 'discount') return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{mk.discountType}</Label>
                        <Select value={campaignForm.discount_type} onValueChange={v => setCampaignForm(p => ({ ...p, discount_type: v as any }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{mk.percentage}</SelectItem>
                            <SelectItem value="fixed">{mk.fixedAmount}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{mk.discountValue}</Label>
                        <Input type="number" value={campaignForm.discount_value} onChange={e => setCampaignForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <Label>يطبق على</Label>
                      <Select value={campaignForm.apply_scope} onValueChange={v => setCampaignForm(p => ({ ...p, apply_scope: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المنتجات</SelectItem>
                          <SelectItem value="product">منتج محدد</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {campaignForm.apply_scope === 'product' && (
                      <div>
                        <Label>اختر المنتج من المخزون *</Label>
                        <ProductSelect value={campaignForm.product_main} onChange={v => setCampaignForm(p => ({ ...p, product_main: v }))} placeholder="اختر المنتج..." />
                      </div>
                    )}
                  </>
                );

                if (campaignForm.campaign_type === 'flash_sale') return (
                  <>
                    <div>
                      <Label>المنتج من المخزون *</Label>
                      <ProductSelect value={campaignForm.product_main} onChange={v => setCampaignForm(p => ({ ...p, product_main: v }))} placeholder="اختر منتج التخفيض..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{mk.discountType}</Label>
                        <Select value={campaignForm.discount_type} onValueChange={v => setCampaignForm(p => ({ ...p, discount_type: v as any }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{mk.percentage}</SelectItem>
                            <SelectItem value="fixed">{mk.fixedAmount}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{mk.discountValue}</Label>
                        <Input type="number" value={campaignForm.discount_value} onChange={e => setCampaignForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </>
                );

                if (campaignForm.campaign_type === 'bundle') return (
                  <>
                    <div>
                      <Label>المنتج الأول *</Label>
                      <ProductSelect value={campaignForm.product_x} onChange={v => setCampaignForm(p => ({ ...p, product_x: v }))} placeholder="اختر المنتج الأول..." />
                    </div>
                    <div>
                      <Label>المنتج الثاني *</Label>
                      <ProductSelect value={campaignForm.product_y} onChange={v => setCampaignForm(p => ({ ...p, product_y: v }))} placeholder="اختر المنتج الثاني..." />
                    </div>
                    <div>
                      <Label>سعر الحزمة (ر.س) *</Label>
                      <Input type="number" min={0} value={campaignForm.discount_value} onChange={e => setCampaignForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
                    </div>
                  </>
                );

                // buy_x_get_y
                return (
                  <>
                    <div className="grid grid-cols-[1fr_84px] gap-3 items-end">
                      <div>
                        <Label>المنتج المطلوب شراؤه (X) *</Label>
                        <ProductSelect value={campaignForm.product_x} onChange={v => setCampaignForm(p => ({ ...p, product_x: v }))} placeholder="العميل يشتري..." />
                      </div>
                      <div>
                        <Label>{mk.buyQuantity}</Label>
                        <Input type="number" min={1} value={campaignForm.buy_quantity ?? ''} onChange={e => setCampaignForm(p => ({ ...p, buy_quantity: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_84px] gap-3 items-end">
                      <div>
                        <Label>المنتج الهدية (Y) *</Label>
                        <ProductSelect value={campaignForm.product_y} onChange={v => setCampaignForm(p => ({ ...p, product_y: v }))} placeholder="يحصل على..." />
                      </div>
                      <div>
                        <Label>{mk.getQuantity}</Label>
                        <Input type="number" min={1} value={campaignForm.get_quantity ?? ''} onChange={e => setCampaignForm(p => ({ ...p, get_quantity: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{mk.startDate}</Label>
                  <Input type="datetime-local" value={campaignForm.starts_at} onChange={e => setCampaignForm(p => ({ ...p, starts_at: e.target.value }))} />
                </div>
                <div>
                  <Label>{mk.endDate}</Label>
                  <Input type="datetime-local" value={campaignForm.ends_at} onChange={e => setCampaignForm(p => ({ ...p, ends_at: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={campaignForm.is_active} onCheckedChange={v => setCampaignForm(p => ({ ...p, is_active: v }))} />
                <Label>{mk.active}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCampaignDialog(false)}>{mk.cancel}</Button>
              <Button onClick={handleSaveCampaign}>{mk.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
