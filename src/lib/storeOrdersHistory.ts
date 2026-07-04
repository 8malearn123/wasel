// Local history of orders placed by a guest visitor (per store slug)
export interface SavedOrder {
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  shipping_city: string;
  shipping_address: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;
  items: { item_name: string; quantity: number; unit_price: number }[];
}

const key = (slug: string) => `wasil_store_orders_${slug}`;

export function saveOrder(slug: string, order: SavedOrder) {
  try {
    const list = getOrders(slug);
    // dedupe by order_number, newest first
    const next = [order, ...list.filter((o) => o.order_number !== order.order_number)].slice(0, 50);
    localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getOrders(slug: string): SavedOrder[] {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as SavedOrder[]) : [];
  } catch {
    return [];
  }
}

export function removeOrder(slug: string, orderNumber: string) {
  try {
    const list = getOrders(slug).filter((o) => o.order_number !== orderNumber);
    localStorage.setItem(key(slug), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
