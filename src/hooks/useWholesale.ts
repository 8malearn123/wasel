import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { productFromDevice, productFromAccessory, productFromNotes, productNotes, type ListingProduct } from '@/lib/wholesaleProduct';

export interface WholesaleListing {
  id: string;
  merchant_id: string;
  device_id: string | null;
  accessory_id: string | null;
  item_type: string;
  wholesale_price: number;
  min_quantity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  device?: { id: string; imei: string; model: string; brand: string | null; price: number; status: string; storage?: string | null; color?: string | null; condition?: string | null; category?: string | null } | null;
  accessory?: { id: string; name: string; sku: string; brand: string | null; price: number; quantity: number; category?: string | null } | null;
  merchant?: { id: string; name: string; phone: string | null } | null;
  /** what is on offer, from whichever source could be read (see wholesaleProduct.ts) */
  product?: ListingProduct | null;
}

export interface WholesaleOrder {
  id: string;
  order_number: string;
  supplier_merchant_id: string;
  buyer_merchant_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  supplier_merchant?: { name: string } | null;
  buyer_merchant?: { name: string } | null;
}

export interface CreditTransaction {
  id: string;
  supplier_merchant_id: string;
  buyer_merchant_id: string;
  order_id: string | null;
  transaction_type: string;
  credit_type: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  supplier_merchant?: { name: string } | null;
  buyer_merchant?: { name: string } | null;
}

type PartyRow = { merchant_id: string; name: string; phone: string | null };
type ListingItemRow = { listing_id: string; item_type: string; name: string | null; brand: string | null; model: string | null; sku: string | null };

let partiesMissingWarned = false;

/**
 * The other side of a deal. merchants / devices / accessories are readable only
 * by their own shop, so the joins above come back null for the other party;
 * wholesale_parties() and wholesale_listing_items() (migration 20261023100100)
 * return just the names and product descriptions a party to the deal may see.
 * Until that migration is applied they do not exist and the screens show «—»
 * where the name is unknown — never a made-up one.
 */
async function loadParties() {
  const [parties, items] = await Promise.all([
    supabase.rpc('wholesale_parties' as never),
    supabase.rpc('wholesale_listing_items' as never),
  ]);
  if ((parties.error || items.error) && !partiesMissingWarned) {
    partiesMissingWarned = true;
    console.warn('[wholesale] party names unavailable until migration 20261023100100 is applied:',
      (parties.error || items.error)?.message);
  }
  const names = new Map<string, PartyRow>();
  for (const p of ((parties.data as unknown as PartyRow[]) || [])) names.set(p.merchant_id, p);
  const products = new Map<string, ListingItemRow>();
  for (const i of ((items.data as unknown as ListingItemRow[]) || [])) products.set(i.listing_id, i);
  return { names, products };
}

const withParty = <T extends { supplier_merchant_id: string; buyer_merchant_id: string; supplier_merchant?: { name: string } | null; buyer_merchant?: { name: string } | null }>(
  row: T, names: Map<string, PartyRow>,
): T => ({
  ...row,
  supplier_merchant: row.supplier_merchant ?? (names.get(row.supplier_merchant_id) ? { name: names.get(row.supplier_merchant_id)!.name } : null),
  buyer_merchant: row.buyer_merchant ?? (names.get(row.buyer_merchant_id) ? { name: names.get(row.buyer_merchant_id)!.name } : null),
});

const withProduct = (l: WholesaleListing, names: Map<string, PartyRow>, products: Map<string, ListingItemRow>): WholesaleListing => {
  const p = products.get(l.id);
  const shop = names.get(l.merchant_id);
  const device = l.device ?? (l.device_id && p ? { id: l.device_id, imei: '', model: p.model ?? p.name ?? '', brand: p.brand, price: 0, status: '' } : null);
  const accessory = l.accessory ?? (l.accessory_id && p ? { id: l.accessory_id, name: p.name ?? '', sku: p.sku ?? '', brand: p.brand, price: 0, quantity: 0 } : null);
  // the shop's own row when readable (the supplier), else the description
  // saved with the listing, else what the parties function returned
  const product = l.device ? productFromDevice(l.device)
    : l.accessory ? productFromAccessory(l.accessory)
    : productFromNotes(l.notes)
      ?? (device ? productFromDevice(device) : accessory ? productFromAccessory(accessory) : null);
  return {
    ...l,
    merchant: l.merchant ?? (shop ? { id: shop.merchant_id, name: shop.name, phone: shop.phone } : null),
    device,
    accessory,
    product,
  };
};

export function useWholesale() {
  const { merchant, user } = useAuth();
  const [myListings, setMyListings] = useState<WholesaleListing[]>([]);
  const [marketplace, setMarketplace] = useState<WholesaleListing[]>([]);
  const [myOrders, setMyOrders] = useState<WholesaleOrder[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<WholesaleOrder[]>([]);
  const [myCredits, setMyCredits] = useState<CreditTransaction[]>([]);
  const [receivedCredits, setReceivedCredits] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    const [listingsRes, marketRes, buyerRes, supplierRes, creditsOutRes, creditsInRes, { names, products }] = await Promise.all([
      supabase.from('wholesale_listings').select('*, device:devices(id, imei, model, brand, price, status, storage, color, condition, category), accessory:accessories(id, name, sku, brand, price, quantity, category)').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_listings').select('*, device:devices(id, imei, model, brand, price, status), accessory:accessories(id, name, sku, brand, price, quantity), merchant:merchants(id, name, phone)').eq('is_active', true).neq('merchant_id', merchant.id),
      supabase.from('wholesale_orders').select('*, supplier_merchant:merchants!wholesale_orders_supplier_merchant_id_fkey(name), buyer_merchant:merchants!wholesale_orders_buyer_merchant_id_fkey(name)').eq('buyer_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_orders').select('*, supplier_merchant:merchants!wholesale_orders_supplier_merchant_id_fkey(name), buyer_merchant:merchants!wholesale_orders_buyer_merchant_id_fkey(name)').eq('supplier_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_credit_transactions' as any).select('*, buyer_merchant:merchants!wholesale_credit_transactions_buyer_merchant_id_fkey(name)').eq('supplier_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_credit_transactions' as any).select('*, supplier_merchant:merchants!wholesale_credit_transactions_supplier_merchant_id_fkey(name)').eq('buyer_merchant_id', merchant.id).order('created_at', { ascending: false }),
      loadParties(),
    ]);

    // Until those functions are installed, a shop the caller deals with is
    // still known by the name it publishes for its online store (store_settings
    // is readable for published stores) — the supplier's own public name.
    const ids = new Set<string>();
    for (const l of (marketRes.data || []) as WholesaleListing[]) ids.add(l.merchant_id);
    for (const o of [...(buyerRes.data || []), ...(supplierRes.data || [])] as WholesaleOrder[]) { ids.add(o.supplier_merchant_id); ids.add(o.buyer_merchant_id); }
    for (const c of [...(creditsOutRes.data || []), ...(creditsInRes.data || [])] as unknown as CreditTransaction[]) { ids.add(c.supplier_merchant_id); ids.add(c.buyer_merchant_id); }
    ids.delete(merchant.id);
    const unnamed = [...ids].filter(id => !names.has(id));
    if (unnamed.length) {
      const { data: stores } = await supabase.from('store_settings').select('merchant_id, store_name').in('merchant_id', unnamed);
      for (const st of (stores || []) as { merchant_id: string; store_name: string | null }[]) {
        if (st.store_name) names.set(st.merchant_id, { merchant_id: st.merchant_id, name: st.store_name, phone: null });
      }
    }

    const own = ((listingsRes.data || []) as WholesaleListing[]).map(l => withProduct(l, names, products));
    // Listings made before descriptions were saved: the supplier can read its
    // own product, so its listing gets the description buyers will see.
    // Only empty notes are filled; nothing a person wrote is replaced.
    const missing = own.filter(l => !l.notes && (l.device || l.accessory) && l.product);
    if (missing.length) {
      await Promise.all(missing.map(l =>
        supabase.from('wholesale_listings').update({ notes: productNotes(l.product!) } as any).eq('id', l.id)));
    }
    setMyListings(own);
    setMarketplace(((marketRes.data || []) as WholesaleListing[]).map(l => withProduct(l, names, products)));
    setMyOrders(((buyerRes.data || []) as WholesaleOrder[]).map(o => withParty(o, names)));
    setIncomingOrders(((supplierRes.data || []) as WholesaleOrder[]).map(o => withParty(o, names)));
    setMyCredits(((creditsOutRes.data || []) as unknown as CreditTransaction[]).map(c => withParty(c, names)));
    setReceivedCredits(((creditsInRes.data || []) as unknown as CreditTransaction[]).map(c => withParty(c, names)));
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createListing = async (data: { device_id?: string; accessory_id?: string; item_type: string; wholesale_price: number; min_quantity: number; notes?: string }) => {
    if (!merchant) return;
    // the description buyers will see, written with the listing (wholesaleProduct.ts)
    let notes = data.notes;
    if (!notes) {
      if (data.device_id) {
        const { data: d } = await supabase.from('devices').select('model, brand, storage, color, condition, category').eq('id', data.device_id).maybeSingle();
        if (d) notes = productNotes(productFromDevice(d));
      } else if (data.accessory_id) {
        const { data: a } = await supabase.from('accessories').select('name, brand, sku, category').eq('id', data.accessory_id).maybeSingle();
        if (a) notes = productNotes(productFromAccessory(a));
      }
    }
    const { error } = await supabase.from('wholesale_listings').insert({ merchant_id: merchant.id, ...data, notes: notes ?? null } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('تمت إضافة المنتج للبيع بالجملة');
    fetchAll();
  };

  const toggleListing = async (id: string, is_active: boolean) => {
    await supabase.from('wholesale_listings').update({ is_active } as any).eq('id', id);
    fetchAll();
  };

  const deleteListing = async (id: string) => {
    await supabase.from('wholesale_listings').delete().eq('id', id);
    toast.success('تم حذف المنتج');
    fetchAll();
  };

  const createOrder = async (listingId: string, quantity: number, listing: WholesaleListing, creditType?: 'invoice' | 'consignment', dueDate?: string) => {
    if (!merchant || !user) return;
    const orderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
    const totalAmount = listing.wholesale_price * quantity;

    const { data: order, error } = await supabase.from('wholesale_orders').insert({
      order_number: orderNumber,
      supplier_merchant_id: listing.merchant_id,
      buyer_merchant_id: merchant.id,
      total_amount: totalAmount,
      created_by: user.id,
    } as any).select().single();

    if (error) { toast.error(error.message); return; }

    // An order without its line has no product: if the line is refused, the
    // order goes too rather than being left behind empty
    const { error: itemError } = await supabase.from('wholesale_order_items').insert({
      order_id: (order as any).id,
      listing_id: listingId,
      quantity,
      unit_price: listing.wholesale_price,
    } as any);
    if (itemError) {
      await supabase.from('wholesale_orders').delete().eq('id', (order as any).id);
      toast.error(itemError.message);
      return;
    }

    // If credit type specified, create credit transaction
    if (creditType) {
      const { error: creditError } = await supabase.from('wholesale_credit_transactions' as any).insert({
        supplier_merchant_id: listing.merchant_id,
        buyer_merchant_id: merchant.id,
        order_id: (order as any).id,
        transaction_type: 'credit',
        credit_type: creditType,
        amount: totalAmount,
        remaining_amount: totalAmount,
        due_date: dueDate || null,
        status: 'unpaid',
        created_by: user.id,
      } as any);
      if (creditError) toast.error(`أُرسل الطلب #${orderNumber} لكن تعذّر تسجيل الآجل: ${creditError.message}`);
    }

    toast.success(`تم إرسال الطلب #${orderNumber}`);
    fetchAll();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('wholesale_orders').update({ status } as any).eq('id', orderId);
    toast.success('تم تحديث حالة الطلب');
    fetchAll();
  };

  const recordPayment = async (creditId: string, amount: number) => {
    const credit = myCredits.find(c => c.id === creditId) || receivedCredits.find(c => c.id === creditId);
    if (!credit) return;

    const newPaid = credit.paid_amount + amount;
    const newRemaining = credit.amount - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    await supabase.from('wholesale_credit_transactions' as any).update({
      paid_amount: newPaid,
      remaining_amount: Math.max(0, newRemaining),
      status: newStatus,
      paid_at: newRemaining <= 0 ? new Date().toISOString() : null,
    } as any).eq('id', creditId);

    toast.success('تم تسجيل الدفعة');
    fetchAll();
  };

  // Credit stats
  const getCreditStats = useCallback(() => {
    const totalOwed = myCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    const totalOwing = receivedCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    const overdueCount = myCredits.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'paid').length;
    return { totalOwed, totalOwing, overdueCount };
  }, [myCredits, receivedCredits]);

  return { myListings, marketplace, myOrders, incomingOrders, myCredits, receivedCredits, loading, createListing, toggleListing, deleteListing, createOrder, updateOrderStatus, recordPayment, getCreditStats, refetch: fetchAll };
}
