// Database types matching Supabase schema
export type DeviceStatus = 'available' | 'reserved' | 'sold' | 'transferred' | 'repair';
export type TransferStatus = 'pending' | 'approved' | 'dispatched' | 'received' | 'cancelled';
export type PurchaseStatus = 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'mixed';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';
export type UserRole = 'owner' | 'admin' | 'branch_manager' | 'cashier' | 'inventory_manager';

export interface Merchant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  merchant_id: string;
  plan: string;
  plan_id?: string;
  status: SubscriptionStatus;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  activation_code?: string;
  max_branches: number;
  max_users: number;
  auto_renew: boolean;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantUser {
  id: string;
  merchant_id: string;
  user_id: string;
  role: UserRole;
  branch_id?: string;
  login_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: Profile;
  branch?: Branch;
}

export interface Branch {
  id: string;
  merchant_id: string;
  name: string;
  address?: string;
  phone?: string;
  is_warehouse: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  merchant_id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  merchant_id: string;
  branch_id?: string;
  imei: string;
  imei2?: string;
  model: string;
  brand?: string;
  color?: string;
  storage?: string;
  condition: string;
  category?: string;
  cost: number;
  price: number;
  status: DeviceStatus;
  supplier_id?: string;
  purchase_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch?: Branch;
  supplier?: Supplier;
}

export interface Accessory {
  id: string;
  merchant_id: string;
  branch_id?: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  cost: number;
  price: number;
  quantity: number;
  min_quantity: number;
  supplier_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch?: Branch;
  supplier?: Supplier;
}

export interface PurchaseOrder {
  id: string;
  merchant_id: string;
  supplier_id: string;
  branch_id?: string;
  order_number: string;
  status: PurchaseStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  paid_amount: number;
  notes?: string;
  order_date: string;
  received_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  supplier?: Supplier;
  branch?: Branch;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  device_id?: string;
  accessory_id?: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
  // Joined fields
  device?: Device;
  accessory?: Accessory;
}

export interface Sale {
  id: string;
  merchant_id: string;
  branch_id: string;
  invoice_number: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes?: string;
  sold_by?: string;
  sale_date: string;
  created_at: string;
  // Joined fields
  branch?: Branch;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  device_id?: string;
  accessory_id?: string;
  quantity: number;
  unit_price: number;
  cost_at_sale: number;
  created_at: string;
  // Joined fields
  device?: Device;
  accessory?: Accessory;
}

export interface StockTransfer {
  id: string;
  merchant_id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: TransferStatus;
  notes?: string;
  requested_by?: string;
  approved_by?: string;
  dispatched_at?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  from_branch?: Branch;
  to_branch?: Branch;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  device_id?: string;
  accessory_id?: string;
  quantity: number;
  created_at: string;
  // Joined fields
  device?: Device;
  accessory?: Accessory;
}

export interface RepairPart {
  id: string;
  merchant_id: string;
  branch_id?: string;
  name: string;
  sku: string;
  category?: string;
  brand?: string;
  cost: number;
  price: number;
  quantity: number;
  min_quantity: number;
  compatible_models?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch?: Branch;
}

export interface RepairOrderPart {
  id: string;
  repair_order_id: string;
  repair_part_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
  // Joined fields
  repair_part?: RepairPart;
}

export interface ActivityLog {
  id: string;
  merchant_id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
