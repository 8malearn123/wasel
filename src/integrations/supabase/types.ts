export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          branch_id: string | null
          brand: string | null
          category: string | null
          cost: number
          created_at: string
          id: string
          merchant_id: string
          min_quantity: number | null
          name: string
          price: number
          quantity: number
          sku: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          merchant_id: string
          min_quantity?: number | null
          name: string
          price?: number
          quantity?: number
          sku: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          merchant_id?: string
          min_quantity?: number | null
          name?: string
          price?: number
          quantity?: number
          sku?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          merchant_id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          merchant_id: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          merchant_id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_requests: {
        Row: {
          admin_notes: string | null
          branch_id: string | null
          branch_name: string
          city: string | null
          created_at: string
          id: string
          invoice_amount: number | null
          merchant_id: string
          notes: string | null
          payment_confirmed: boolean
          requested_by: string
          status: Database["public"]["Enums"]["branch_request_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          branch_id?: string | null
          branch_name: string
          city?: string | null
          created_at?: string
          id?: string
          invoice_amount?: number | null
          merchant_id: string
          notes?: string | null
          payment_confirmed?: boolean
          requested_by: string
          status?: Database["public"]["Enums"]["branch_request_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          branch_id?: string | null
          branch_name?: string
          city?: string | null
          created_at?: string
          id?: string
          invoice_amount?: number | null
          merchant_id?: string
          notes?: string | null
          payment_confirmed?: boolean
          requested_by?: string
          status?: Database["public"]["Enums"]["branch_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_warehouse: boolean | null
          merchant_id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_warehouse?: boolean | null
          merchant_id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_warehouse?: boolean | null
          merchant_id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          buy_quantity: number | null
          campaign_type: string
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          ends_at: string | null
          get_quantity: number | null
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          buy_quantity?: number | null
          campaign_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          ends_at?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          buy_quantity?: number | null
          campaign_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          ends_at?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses: number | null
          merchant_id: string
          min_order_amount: number | null
          name: string
          starts_at: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          merchant_id: string
          min_order_amount?: number | null
          name: string
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          merchant_id?: string
          min_order_amount?: number | null
          name?: string
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          loyalty_points: number
          loyalty_tier: string
          merchant_id: string
          name: string
          notes: string | null
          phone: string | null
          total_purchases: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          loyalty_points?: number
          loyalty_tier?: string
          merchant_id: string
          name: string
          notes?: string | null
          phone?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          loyalty_points?: number
          loyalty_tier?: string
          merchant_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_closings: {
        Row: {
          accessories_sold: number
          bank_transfer_sales: number
          branch_id: string
          card_sales: number
          cash_counted: number | null
          cash_difference: number | null
          cash_sales: number
          closed_by: string | null
          closing_date: string
          created_at: string
          devices_sold: number
          id: string
          merchant_id: string
          notes: string | null
          status: string
          total_discount: number
          total_sales: number
          total_tax: number
          transactions_count: number
          updated_at: string
        }
        Insert: {
          accessories_sold?: number
          bank_transfer_sales?: number
          branch_id: string
          card_sales?: number
          cash_counted?: number | null
          cash_difference?: number | null
          cash_sales?: number
          closed_by?: string | null
          closing_date?: string
          created_at?: string
          devices_sold?: number
          id?: string
          merchant_id: string
          notes?: string | null
          status?: string
          total_discount?: number
          total_sales?: number
          total_tax?: number
          transactions_count?: number
          updated_at?: string
        }
        Update: {
          accessories_sold?: number
          bank_transfer_sales?: number
          branch_id?: string
          card_sales?: number
          cash_counted?: number | null
          cash_difference?: number | null
          cash_sales?: number
          closed_by?: string | null
          closing_date?: string
          created_at?: string
          devices_sold?: number
          id?: string
          merchant_id?: string
          notes?: string | null
          status?: string
          total_discount?: number
          total_sales?: number
          total_tax?: number
          transactions_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_closings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          branch_id: string | null
          brand: string | null
          category: string | null
          color: string | null
          condition: string | null
          cost: number
          created_at: string
          id: string
          imei: string
          imei2: string | null
          merchant_id: string
          model: string
          notes: string | null
          price: number
          purchase_id: string | null
          status: Database["public"]["Enums"]["device_status"]
          storage: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          condition?: string | null
          cost?: number
          created_at?: string
          id?: string
          imei: string
          imei2?: string | null
          merchant_id: string
          model: string
          notes?: string | null
          price?: number
          purchase_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          condition?: string | null
          cost?: number
          created_at?: string
          id?: string
          imei?: string
          imei2?: string | null
          merchant_id?: string
          model?: string
          notes?: string | null
          price?: number
          purchase_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_devices_purchase"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          merchant_id: string
          points: number
          sale_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          merchant_id: string
          points?: number
          sale_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          merchant_id?: string
          points?: number
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          merchant_id: string
          name: string
          name_ar: string | null
          sort_order: number | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          merchant_id: string
          name: string
          name_ar?: string | null
          sort_order?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          merchant_id?: string
          name?: string
          name_ar?: string | null
          sort_order?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_categories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payouts: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string | null
          iban: string | null
          id: string
          merchant_id: string
          net_amount: number | null
          notes: string | null
          orders_count: number | null
          period_from: string | null
          period_to: string | null
          platform_fee: number | null
          processed_at: string | null
          processed_by: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["payout_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          merchant_id: string
          net_amount?: number | null
          notes?: string | null
          orders_count?: number | null
          period_from?: string | null
          period_to?: string | null
          platform_fee?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          merchant_id?: string
          net_amount?: number | null
          notes?: string | null
          orders_count?: number | null
          period_from?: string | null
          period_to?: string | null
          platform_fee?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payouts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_users: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          login_code: string | null
          merchant_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          login_code?: string | null
          merchant_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          login_code?: string | null
          merchant_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_merchant_users_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_users_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          auto_print_closing: boolean
          bank_account: string | null
          bank_name: string | null
          cr_number: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          platform_fee_percentage: number | null
          updated_at: string
          vat_enabled: boolean
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          auto_print_closing?: boolean
          bank_account?: string | null
          bank_name?: string | null
          cr_number?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          platform_fee_percentage?: number | null
          updated_at?: string
          vat_enabled?: boolean
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          auto_print_closing?: boolean
          bank_account?: string | null
          bank_name?: string | null
          cr_number?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          platform_fee_percentage?: number | null
          updated_at?: string
          vat_enabled?: boolean
          vat_number?: string | null
        }
        Relationships: []
      }
      online_order_items: {
        Row: {
          accessory_id: string | null
          created_at: string | null
          device_id: string | null
          id: string
          item_image: string | null
          item_name: string
          order_id: string
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          accessory_id?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          item_image?: string | null
          item_name: string
          order_id: string
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          accessory_id?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          item_image?: string | null
          item_name?: string
          order_id?: string
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_order_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "public_store_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "public_store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "online_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      online_orders: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          discount_amount: number | null
          id: string
          merchant_id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          payout_id: string | null
          shipping_address: string
          shipping_city: string
          shipping_cost: number | null
          shipping_provider:
            | Database["public"]["Enums"]["shipping_provider"]
            | null
          status: Database["public"]["Enums"]["online_order_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          discount_amount?: number | null
          id?: string
          merchant_id: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          payout_id?: string | null
          shipping_address: string
          shipping_city: string
          shipping_cost?: number | null
          shipping_provider?:
            | Database["public"]["Enums"]["shipping_provider"]
            | null
          status?: Database["public"]["Enums"]["online_order_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          discount_amount?: number | null
          id?: string
          merchant_id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          payout_id?: string | null
          shipping_address?: string
          shipping_city?: string
          shipping_cost?: number | null
          shipping_provider?:
            | Database["public"]["Enums"]["shipping_provider"]
            | null
          status?: Database["public"]["Enums"]["online_order_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "online_orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          advanced_reports: boolean
          branch_limit: number
          created_at: string
          has_loyalty: boolean
          has_online_store: boolean
          has_wholesale: boolean
          id: string
          is_active: boolean
          name: string
          name_ar: string
          price: number
          priority_support: boolean
          sort_order: number
          updated_at: string
          user_limit: number
        }
        Insert: {
          advanced_reports?: boolean
          branch_limit?: number
          created_at?: string
          has_loyalty?: boolean
          has_online_store?: boolean
          has_wholesale?: boolean
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
          price?: number
          priority_support?: boolean
          sort_order?: number
          updated_at?: string
          user_limit?: number
        }
        Update: {
          advanced_reports?: boolean
          branch_limit?: number
          created_at?: string
          has_loyalty?: boolean
          has_online_store?: boolean
          has_wholesale?: boolean
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          price?: number
          priority_support?: boolean
          sort_order?: number
          updated_at?: string
          user_limit?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          accessory_id: string | null
          created_at: string
          device_id: string | null
          id: string
          purchase_order_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          purchase_order_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          purchase_order_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "public_store_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "public_store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          merchant_id: string
          notes: string | null
          order_date: string
          order_number: string
          paid_amount: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          received_date: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          order_date?: string
          order_number: string
          paid_amount?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          paid_amount?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_order_parts: {
        Row: {
          created_at: string
          id: string
          quantity: number
          repair_order_id: string
          repair_part_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          repair_order_id: string
          repair_part_id: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          repair_order_id?: string
          repair_part_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_order_parts_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_parts_repair_part_id_fkey"
            columns: ["repair_part_id"]
            isOneToOne: false
            referencedRelation: "repair_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          branch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          device_brand: string | null
          device_color: string | null
          device_imei: string | null
          device_model: string | null
          device_type: string
          diagnosis_notes: string | null
          estimated_completion: string | null
          estimated_cost: number | null
          id: string
          issue_description: string
          merchant_id: string
          notes: string | null
          paid_amount: number | null
          parts_cost: number | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          priority: string | null
          received_at: string
          repair_number: string
          status: Database["public"]["Enums"]["repair_status"]
          updated_at: string
          warranty_days: number | null
          warranty_ends_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_brand?: string | null
          device_color?: string | null
          device_imei?: string | null
          device_model?: string | null
          device_type: string
          diagnosis_notes?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          issue_description: string
          merchant_id: string
          notes?: string | null
          paid_amount?: number | null
          parts_cost?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          priority?: string | null
          received_at?: string
          repair_number: string
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
          warranty_days?: number | null
          warranty_ends_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_brand?: string | null
          device_color?: string | null
          device_imei?: string | null
          device_model?: string | null
          device_type?: string
          diagnosis_notes?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          issue_description?: string
          merchant_id?: string
          notes?: string | null
          paid_amount?: number | null
          parts_cost?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          priority?: string | null
          received_at?: string
          repair_number?: string
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
          warranty_days?: number | null
          warranty_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          branch_id: string | null
          brand: string | null
          category: string | null
          compatible_models: string | null
          cost: number
          created_at: string
          id: string
          merchant_id: string
          min_quantity: number | null
          name: string
          notes: string | null
          price: number
          quantity: number
          sku: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          compatible_models?: string | null
          cost?: number
          created_at?: string
          id?: string
          merchant_id: string
          min_quantity?: number | null
          name: string
          notes?: string | null
          price?: number
          quantity?: number
          sku: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          compatible_models?: string | null
          cost?: number
          created_at?: string
          id?: string
          merchant_id?: string
          min_quantity?: number | null
          name?: string
          notes?: string | null
          price?: number
          quantity?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          accessory_id: string | null
          cost_at_sale: number | null
          created_at: string
          device_id: string | null
          id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          accessory_id?: string | null
          cost_at_sale?: number | null
          created_at?: string
          device_id?: string | null
          id?: string
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          accessory_id?: string | null
          cost_at_sale?: number | null
          created_at?: string
          device_id?: string | null
          id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "public_store_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "public_store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          id: string
          invoice_number: string
          is_printed: boolean
          merchant_id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          sale_date: string
          sold_by: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number: string
          is_printed?: boolean
          merchant_id: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sale_date?: string
          sold_by?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number?: string
          is_printed?: boolean
          merchant_id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sale_date?: string
          sold_by?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          accessory_id: string | null
          created_at: string
          device_id: string | null
          id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          quantity?: number
          transfer_id: string
        }
        Update: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "public_store_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "public_store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_by: string | null
          created_at: string
          dispatched_at: string | null
          from_branch_id: string
          id: string
          merchant_id: string
          notes: string | null
          received_at: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_branch_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_branch_id: string
          id?: string
          merchant_id: string
          notes?: string | null
          received_at?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_branch_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_branch_id?: string
          id?: string
          merchant_id?: string
          notes?: string | null
          received_at?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_branch_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_items: {
        Row: {
          counted_at: string | null
          counted_quantity: number | null
          created_at: string
          discrepancy: number | null
          id: string
          item_id: string
          item_name: string
          item_sku: string | null
          item_type: Database["public"]["Enums"]["stocktake_item_type"]
          notes: string | null
          stocktake_id: string
          system_quantity: number
        }
        Insert: {
          counted_at?: string | null
          counted_quantity?: number | null
          created_at?: string
          discrepancy?: number | null
          id?: string
          item_id: string
          item_name: string
          item_sku?: string | null
          item_type: Database["public"]["Enums"]["stocktake_item_type"]
          notes?: string | null
          stocktake_id: string
          system_quantity?: number
        }
        Update: {
          counted_at?: string | null
          counted_quantity?: number | null
          created_at?: string
          discrepancy?: number | null
          id?: string
          item_id?: string
          item_name?: string
          item_sku?: string | null
          item_type?: Database["public"]["Enums"]["stocktake_item_type"]
          notes?: string | null
          stocktake_id?: string
          system_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_items_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktakes: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          completed_by: string | null
          counted_items: number | null
          created_at: string
          created_by: string | null
          discrepancy_count: number | null
          id: string
          item_types: Database["public"]["Enums"]["stocktake_item_type"][]
          merchant_id: string
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["stocktake_status"]
          stocktake_number: string
          total_items: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          counted_items?: number | null
          created_at?: string
          created_by?: string | null
          discrepancy_count?: number | null
          id?: string
          item_types?: Database["public"]["Enums"]["stocktake_item_type"][]
          merchant_id: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["stocktake_status"]
          stocktake_number: string
          total_items?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          counted_items?: number | null
          created_at?: string
          created_by?: string | null
          discrepancy_count?: number | null
          id?: string
          item_types?: Database["public"]["Enums"]["stocktake_item_type"][]
          merchant_id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["stocktake_status"]
          stocktake_number?: string
          total_items?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktakes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          merchant_id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          merchant_id: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          merchant_id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_published: boolean
          merchant_id: string
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          merchant_id: string
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          merchant_id?: string
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          additional_banners: Json
          announcement_bar_enabled: boolean | null
          announcement_bar_text: string | null
          banner_url: string | null
          created_at: string | null
          currency_symbol: string | null
          description: string | null
          featured_product_ids: Json | null
          featured_section_enabled: boolean | null
          font_family: string | null
          free_shipping_threshold: number | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          instagram_url: string | null
          is_published: boolean | null
          logo_url: string | null
          loyalty_enabled: boolean
          loyalty_points_per_currency: number
          merchant_id: string
          og_image_url: string | null
          primary_color: string | null
          return_policy: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          shipping_cost: number | null
          show_cr_number: boolean
          show_vat_number: boolean
          show_vat_status: boolean
          slug: string
          store_name: string | null
          theme_id: string | null
          twitter_url: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          additional_banners?: Json
          announcement_bar_enabled?: boolean | null
          announcement_bar_text?: string | null
          banner_url?: string | null
          created_at?: string | null
          currency_symbol?: string | null
          description?: string | null
          featured_product_ids?: Json | null
          featured_section_enabled?: boolean | null
          font_family?: string | null
          free_shipping_threshold?: number | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram_url?: string | null
          is_published?: boolean | null
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_points_per_currency?: number
          merchant_id: string
          og_image_url?: string | null
          primary_color?: string | null
          return_policy?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          shipping_cost?: number | null
          show_cr_number?: boolean
          show_vat_number?: boolean
          show_vat_status?: boolean
          slug: string
          store_name?: string | null
          theme_id?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          additional_banners?: Json
          announcement_bar_enabled?: boolean | null
          announcement_bar_text?: string | null
          banner_url?: string | null
          created_at?: string | null
          currency_symbol?: string | null
          description?: string | null
          featured_product_ids?: Json | null
          featured_section_enabled?: boolean | null
          font_family?: string | null
          free_shipping_threshold?: number | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram_url?: string | null
          is_published?: boolean | null
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_points_per_currency?: number
          merchant_id?: string
          og_image_url?: string | null
          primary_color?: string | null
          return_policy?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          shipping_cost?: number | null
          show_cr_number?: boolean
          show_vat_number?: boolean
          show_vat_status?: boolean
          slug?: string
          store_name?: string | null
          theme_id?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          activation_code: string | null
          admin_notes: string | null
          auto_renew: boolean
          created_at: string
          id: string
          max_branches: number | null
          max_users: number | null
          merchant_id: string
          plan: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_ends_at: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          activation_code?: string | null
          admin_notes?: string | null
          auto_renew?: boolean
          created_at?: string
          id?: string
          max_branches?: number | null
          max_users?: number | null
          merchant_id: string
          plan?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_ends_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          activation_code?: string | null
          admin_notes?: string | null
          auto_renew?: boolean
          created_at?: string
          id?: string
          max_branches?: number | null
          max_users?: number | null
          merchant_id?: string
          plan?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_ends_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          merchant_id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          balance?: number | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          balance?: number | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          merchant_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          replied_at: string | null
          replied_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          merchant_id: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          replied_at?: string | null
          replied_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          merchant_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          replied_at?: string | null
          replied_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_credit_transactions: {
        Row: {
          amount: number
          buyer_merchant_id: string
          created_at: string
          created_by: string | null
          credit_type: string
          due_date: string | null
          id: string
          notes: string | null
          order_id: string | null
          paid_amount: number
          paid_at: string | null
          remaining_amount: number
          status: string
          supplier_merchant_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          buyer_merchant_id: string
          created_at?: string
          created_by?: string | null
          credit_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          remaining_amount?: number
          status?: string
          supplier_merchant_id: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_merchant_id?: string
          created_at?: string
          created_by?: string | null
          credit_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          remaining_amount?: number
          status?: string
          supplier_merchant_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_credit_transactions_buyer_merchant_id_fkey"
            columns: ["buyer_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_credit_transactions_supplier_merchant_id_fkey"
            columns: ["supplier_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_listings: {
        Row: {
          accessory_id: string | null
          created_at: string
          device_id: string | null
          id: string
          is_active: boolean
          item_type: string
          merchant_id: string
          min_quantity: number
          notes: string | null
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          merchant_id: string
          min_quantity?: number
          notes?: string | null
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          accessory_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          merchant_id?: string
          min_quantity?: number
          notes?: string | null
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_listings_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_listings_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "public_store_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_listings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_listings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "public_store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_listings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "wholesale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_orders: {
        Row: {
          buyer_merchant_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: string
          status: string
          supplier_merchant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_merchant_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number: string
          status?: string
          supplier_merchant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          buyer_merchant_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          status?: string
          supplier_merchant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_orders_buyer_merchant_id_fkey"
            columns: ["buyer_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_supplier_merchant_id_fkey"
            columns: ["supplier_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_store_accessories: {
        Row: {
          branch_id: string | null
          brand: string | null
          category: string | null
          created_at: string | null
          id: string | null
          merchant_id: string | null
          min_quantity: number | null
          name: string | null
          price: number | null
          quantity: number | null
          sku: string | null
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          merchant_id?: string | null
          min_quantity?: number | null
          name?: string | null
          price?: number | null
          quantity?: number | null
          sku?: string | null
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          merchant_id?: string | null
          min_quantity?: number | null
          name?: string | null
          price?: number | null
          quantity?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accessories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      public_store_devices: {
        Row: {
          branch_id: string | null
          brand: string | null
          color: string | null
          condition: string | null
          created_at: string | null
          id: string | null
          merchant_id: string | null
          model: string | null
          notes: string | null
          price: number | null
          status: Database["public"]["Enums"]["device_status"] | null
          storage: string | null
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string | null
          id?: string | null
          merchant_id?: string | null
          model?: string | null
          notes?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["device_status"] | null
          storage?: string | null
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string | null
          id?: string | null
          merchant_id?: string | null
          model?: string | null
          notes?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["device_status"] | null
          storage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      demo_switch_plan: { Args: { _plan_name: string }; Returns: undefined }
      generate_invoice_number: {
        Args: { _merchant_id: string }
        Returns: string
      }
      generate_online_order_number: {
        Args: { _merchant_id: string }
        Returns: string
      }
      generate_po_number: { Args: { _merchant_id: string }; Returns: string }
      generate_repair_number: {
        Args: { _merchant_id: string }
        Returns: string
      }
      generate_stocktake_number: {
        Args: { _merchant_id: string }
        Returns: string
      }
      generate_transfer_number: {
        Args: { _merchant_id: string }
        Returns: string
      }
      get_public_merchant_legal: {
        Args: { _slug: string }
        Returns: {
          cr_number: string
          name: string
          vat_enabled: boolean
          vat_number: string
        }[]
      }
      get_user_login_code: { Args: { _user_id: string }; Returns: string }
      get_user_merchant_id: { Args: never; Returns: string }
      has_merchant_role:
        | {
            Args: { _role: Database["public"]["Enums"]["user_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _merchant_id: string
              _role: Database["public"]["Enums"]["user_role"]
            }
            Returns: boolean
          }
      is_owner_or_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _merchant_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      branch_request_status:
        | "pending_review"
        | "pending_payment"
        | "activated"
        | "rejected"
      device_status:
        | "available"
        | "reserved"
        | "sold"
        | "transferred"
        | "repair"
      online_order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_method: "cash" | "card" | "bank_transfer" | "mixed"
      payment_status: "paid" | "unpaid" | "partial"
      payout_status: "pending" | "processing" | "completed" | "failed"
      purchase_status:
        | "draft"
        | "pending"
        | "approved"
        | "received"
        | "cancelled"
      repair_status:
        | "received"
        | "diagnosing"
        | "waiting_parts"
        | "in_progress"
        | "completed"
        | "delivered"
        | "cancelled"
      shipping_provider: "aramex" | "smsa" | "other"
      stocktake_item_type: "device" | "accessory" | "repair_part"
      stocktake_status: "draft" | "in_progress" | "completed" | "cancelled"
      subscription_status: "trial" | "active" | "expired" | "cancelled"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      transfer_status:
        | "pending"
        | "approved"
        | "dispatched"
        | "received"
        | "cancelled"
      user_role:
        | "owner"
        | "admin"
        | "branch_manager"
        | "cashier"
        | "inventory_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      branch_request_status: [
        "pending_review",
        "pending_payment",
        "activated",
        "rejected",
      ],
      device_status: ["available", "reserved", "sold", "transferred", "repair"],
      online_order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_method: ["cash", "card", "bank_transfer", "mixed"],
      payment_status: ["paid", "unpaid", "partial"],
      payout_status: ["pending", "processing", "completed", "failed"],
      purchase_status: [
        "draft",
        "pending",
        "approved",
        "received",
        "cancelled",
      ],
      repair_status: [
        "received",
        "diagnosing",
        "waiting_parts",
        "in_progress",
        "completed",
        "delivered",
        "cancelled",
      ],
      shipping_provider: ["aramex", "smsa", "other"],
      stocktake_item_type: ["device", "accessory", "repair_part"],
      stocktake_status: ["draft", "in_progress", "completed", "cancelled"],
      subscription_status: ["trial", "active", "expired", "cancelled"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      transfer_status: [
        "pending",
        "approved",
        "dispatched",
        "received",
        "cancelled",
      ],
      user_role: [
        "owner",
        "admin",
        "branch_manager",
        "cashier",
        "inventory_manager",
      ],
    },
  },
} as const
