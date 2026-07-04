-- ENUM Types
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'branch_manager', 'cashier', 'inventory_manager');
CREATE TYPE public.device_status AS ENUM ('available', 'reserved', 'sold', 'transferred', 'repair');
CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'dispatched', 'received', 'cancelled');
CREATE TYPE public.purchase_status AS ENUM ('draft', 'pending', 'approved', 'received', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid', 'partial');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'mixed');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'expired', 'cancelled');

-- Merchants (Tenants)
CREATE TABLE public.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions (Trial/Activation)
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'trial',
    status subscription_status NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    activation_code TEXT,
    max_branches INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merchant Users (Role assignments)
CREATE TABLE public.merchant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'cashier',
    branch_id UUID, -- will be foreign key after branches table
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(merchant_id, user_id)
);

-- Branches
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_warehouse BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for branch_id in merchant_users
ALTER TABLE public.merchant_users 
ADD CONSTRAINT fk_merchant_users_branch 
FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- Suppliers
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devices (IMEI tracked)
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    imei TEXT NOT NULL,
    imei2 TEXT,
    model TEXT NOT NULL,
    brand TEXT,
    color TEXT,
    storage TEXT,
    condition TEXT DEFAULT 'new',
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    status device_status NOT NULL DEFAULT 'available',
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    purchase_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(merchant_id, imei)
);

-- Accessories (SKU tracked, quantity-based)
CREATE TABLE public.accessories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 5,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(merchant_id, sku, branch_id)
);

-- Purchase Orders
CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    status purchase_status NOT NULL DEFAULT 'draft',
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    total_amount DECIMAL(12,2) DEFAULT 0,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_date TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for purchase_id in devices
ALTER TABLE public.devices 
ADD CONSTRAINT fk_devices_purchase 
FOREIGN KEY (purchase_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    accessory_id UUID REFERENCES public.accessories(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    payment_status payment_status NOT NULL DEFAULT 'paid',
    notes TEXT,
    sold_by UUID REFERENCES auth.users(id),
    sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale Items
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    accessory_id UUID REFERENCES public.accessories(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_at_sale DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Transfers
CREATE TABLE public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    from_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    to_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    status transfer_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    requested_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Transfer Items
CREATE TABLE public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    accessory_id UUID REFERENCES public.accessories(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Log (Audit Trail)
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's merchant_id
CREATE OR REPLACE FUNCTION public.get_user_merchant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT merchant_id FROM public.merchant_users 
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
$$;

-- Helper function: Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_merchant_role(_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.merchant_users
        WHERE user_id = auth.uid() 
        AND role = _role
        AND is_active = true
    )
$$;

-- Helper function: Check if user is owner or admin
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.merchant_users
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
$$;

-- RLS Policies for merchants
CREATE POLICY "Users can view their merchant" ON public.merchants
    FOR SELECT USING (id = public.get_user_merchant_id());

CREATE POLICY "Owners can update their merchant" ON public.merchants
    FOR UPDATE USING (id = public.get_user_merchant_id() AND public.has_merchant_role('owner'));

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their subscription" ON public.subscriptions
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Owners can manage subscriptions" ON public.subscriptions
    FOR ALL USING (merchant_id = public.get_user_merchant_id() AND public.has_merchant_role('owner'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- RLS Policies for merchant_users
CREATE POLICY "Users can view merchant members" ON public.merchant_users
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Admins can manage merchant users" ON public.merchant_users
    FOR ALL USING (merchant_id = public.get_user_merchant_id() AND public.is_owner_or_admin());

-- RLS Policies for branches
CREATE POLICY "Users can view branches" ON public.branches
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Admins can manage branches" ON public.branches
    FOR ALL USING (merchant_id = public.get_user_merchant_id() AND public.is_owner_or_admin());

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers" ON public.suppliers
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Admins can manage suppliers" ON public.suppliers
    FOR ALL USING (merchant_id = public.get_user_merchant_id() AND public.is_owner_or_admin());

-- RLS Policies for devices
CREATE POLICY "Users can view devices" ON public.devices
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Users can manage devices" ON public.devices
    FOR ALL USING (merchant_id = public.get_user_merchant_id());

-- RLS Policies for accessories
CREATE POLICY "Users can view accessories" ON public.accessories
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Users can manage accessories" ON public.accessories
    FOR ALL USING (merchant_id = public.get_user_merchant_id());

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchases" ON public.purchase_orders
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Admins can manage purchases" ON public.purchase_orders
    FOR ALL USING (merchant_id = public.get_user_merchant_id() AND public.is_owner_or_admin());

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view purchase items" ON public.purchase_order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.purchase_orders po 
                WHERE po.id = purchase_order_id 
                AND po.merchant_id = public.get_user_merchant_id())
    );

CREATE POLICY "Admins can manage purchase items" ON public.purchase_order_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.purchase_orders po 
                WHERE po.id = purchase_order_id 
                AND po.merchant_id = public.get_user_merchant_id())
        AND public.is_owner_or_admin()
    );

-- RLS Policies for sales
CREATE POLICY "Users can view sales" ON public.sales
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Users can create sales" ON public.sales
    FOR INSERT WITH CHECK (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Admins can manage sales" ON public.sales
    FOR ALL USING (merchant_id = public.get_user_merchant_id());

-- RLS Policies for sale_items
CREATE POLICY "Users can view sale items" ON public.sale_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.sales s 
                WHERE s.id = sale_id 
                AND s.merchant_id = public.get_user_merchant_id())
    );

CREATE POLICY "Users can create sale items" ON public.sale_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.sales s 
                WHERE s.id = sale_id 
                AND s.merchant_id = public.get_user_merchant_id())
    );

-- RLS Policies for stock_transfers
CREATE POLICY "Users can view transfers" ON public.stock_transfers
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "Users can manage transfers" ON public.stock_transfers
    FOR ALL USING (merchant_id = public.get_user_merchant_id());

-- RLS Policies for stock_transfer_items
CREATE POLICY "Users can view transfer items" ON public.stock_transfer_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.stock_transfers st 
                WHERE st.id = transfer_id 
                AND st.merchant_id = public.get_user_merchant_id())
    );

CREATE POLICY "Users can manage transfer items" ON public.stock_transfer_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.stock_transfers st 
                WHERE st.id = transfer_id 
                AND st.merchant_id = public.get_user_merchant_id())
    );

-- RLS Policies for activity_logs
CREATE POLICY "Users can view activity logs" ON public.activity_logs
    FOR SELECT USING (merchant_id = public.get_user_merchant_id());

CREATE POLICY "System can create logs" ON public.activity_logs
    FOR INSERT WITH CHECK (merchant_id = public.get_user_merchant_id());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_merchant_users_updated_at BEFORE UPDATE ON public.merchant_users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_accessories_updated_at BEFORE UPDATE ON public.accessories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_stock_transfers_updated_at BEFORE UPDATE ON public.stock_transfers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.sales WHERE merchant_id = _merchant_id;
    RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Function to generate transfer number
CREATE OR REPLACE FUNCTION public.generate_transfer_number(_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.stock_transfers WHERE merchant_id = _merchant_id;
    RETURN 'TRF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Function to generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number(_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.purchase_orders WHERE merchant_id = _merchant_id;
    RETURN 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Indexes for performance
CREATE INDEX idx_devices_merchant ON public.devices(merchant_id);
CREATE INDEX idx_devices_branch ON public.devices(branch_id);
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_devices_imei ON public.devices(imei);
CREATE INDEX idx_accessories_merchant ON public.accessories(merchant_id);
CREATE INDEX idx_accessories_branch ON public.accessories(branch_id);
CREATE INDEX idx_accessories_sku ON public.accessories(sku);
CREATE INDEX idx_sales_merchant ON public.sales(merchant_id);
CREATE INDEX idx_sales_branch ON public.sales(branch_id);
CREATE INDEX idx_sales_date ON public.sales(sale_date);
CREATE INDEX idx_stock_transfers_merchant ON public.stock_transfers(merchant_id);
CREATE INDEX idx_activity_logs_merchant ON public.activity_logs(merchant_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);