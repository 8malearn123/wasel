import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/accounting-api\/?/, '')
    
    // Auth: accept either Bearer token or x-api-key header
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('x-api-key')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    let merchantId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      // JWT auth - get merchant from user
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      const token = authHeader.replace('Bearer ', '')
      const { data: claims, error } = await supabase.auth.getClaims(token)
      if (error || !claims?.claims?.sub) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }
      const userId = claims.claims.sub
      
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: mu } = await adminClient
        .from('merchant_users')
        .select('merchant_id, role')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .single()
      
      if (!mu) {
        return jsonResponse({ error: 'Forbidden: owner/admin role required' }, 403)
      }
      merchantId = mu.merchant_id
    } else if (apiKey) {
      // API key not yet implemented - placeholder for future webhook-style auth
      return jsonResponse({ error: 'API key auth not yet supported. Use Bearer token.' }, 401)
    } else {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse query params
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Route handling
    if (req.method === 'GET') {
      switch (path) {
        case 'sales':
        case 'sales/': {
          let query = adminClient
            .from('sales')
            .select('*, items:sale_items(*, device:devices(brand, model, imei), accessory:accessories(name, sku))')
            .eq('merchant_id', merchantId)
            .order('sale_date', { ascending: false })
            .range(offset, offset + limit - 1)
          
          if (from) query = query.gte('sale_date', from)
          if (to) query = query.lte('sale_date', to)
          
          const { data, error, count } = await query
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case 'sales/summary':
        case 'sales/summary/': {
          let query = adminClient
            .from('sales')
            .select('total_amount, tax_amount, discount_amount, payment_method, sale_date, subtotal')
            .eq('merchant_id', merchantId)
          
          if (from) query = query.gte('sale_date', from)
          if (to) query = query.lte('sale_date', to)
          
          const { data, error } = await query
          if (error) return jsonResponse({ error: error.message }, 500)
          
          const summary = {
            total_sales: 0,
            total_tax: 0,
            total_discount: 0,
            total_subtotal: 0,
            transactions_count: data?.length || 0,
            by_payment_method: { cash: 0, card: 0, bank_transfer: 0, mixed: 0 },
          }
          
          for (const s of (data || [])) {
            summary.total_sales += Number(s.total_amount)
            summary.total_tax += Number(s.tax_amount || 0)
            summary.total_discount += Number(s.discount_amount || 0)
            summary.total_subtotal += Number(s.subtotal)
            const method = s.payment_method as keyof typeof summary.by_payment_method
            if (summary.by_payment_method[method] !== undefined) {
              summary.by_payment_method[method] += Number(s.total_amount)
            }
          }
          
          return jsonResponse({ data: summary, period: { from, to } })
        }

        case 'inventory/devices':
        case 'inventory/devices/': {
          const status = url.searchParams.get('status') || undefined
          let query = adminClient
            .from('devices')
            .select('id, imei, brand, model, color, storage, condition, cost, price, status, branch_id, created_at')
            .eq('merchant_id', merchantId)
            .range(offset, offset + limit - 1)
          
          if (status) query = query.eq('status', status)
          
          const { data, error } = await query
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case 'inventory/accessories':
        case 'inventory/accessories/': {
          const { data, error } = await adminClient
            .from('accessories')
            .select('id, sku, name, category, brand, cost, price, quantity, min_quantity, branch_id, created_at')
            .eq('merchant_id', merchantId)
            .range(offset, offset + limit - 1)
          
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case 'daily-closings':
        case 'daily-closings/': {
          let query = adminClient
            .from('daily_closings')
            .select('*')
            .eq('merchant_id', merchantId)
            .order('closing_date', { ascending: false })
            .range(offset, offset + limit - 1)
          
          if (from) query = query.gte('closing_date', from)
          if (to) query = query.lte('closing_date', to)
          
          const { data, error } = await query
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case 'suppliers':
        case 'suppliers/': {
          const { data, error } = await adminClient
            .from('suppliers')
            .select('id, name, contact_name, phone, email, balance, is_active')
            .eq('merchant_id', merchantId)
            .range(offset, offset + limit - 1)
          
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case 'purchases':
        case 'purchases/': {
          let query = adminClient
            .from('purchase_orders')
            .select('*, supplier:suppliers(name), items:purchase_order_items(quantity, unit_cost, device_id, accessory_id)')
            .eq('merchant_id', merchantId)
            .order('order_date', { ascending: false })
            .range(offset, offset + limit - 1)
          
          if (from) query = query.gte('order_date', from)
          if (to) query = query.lte('order_date', to)
          
          const { data, error } = await query
          if (error) return jsonResponse({ error: error.message }, 500)
          return jsonResponse({ data, count: data?.length, offset, limit })
        }

        case '':
        case undefined: {
          return jsonResponse({
            version: '1.0',
            endpoints: [
              'GET /sales - List sales with items',
              'GET /sales/summary - Sales summary with totals',
              'GET /inventory/devices - List devices',
              'GET /inventory/accessories - List accessories',
              'GET /daily-closings - Daily closing reports',
              'GET /suppliers - List suppliers',
              'GET /purchases - Purchase orders',
            ],
            query_params: {
              from: 'Filter start date (ISO 8601)',
              to: 'Filter end date (ISO 8601)',
              limit: 'Max results (default 100, max 1000)',
              offset: 'Pagination offset',
              status: 'Filter by status (devices only)',
            },
            auth: 'Bearer <JWT token> in Authorization header',
          })
        }

        default:
          return jsonResponse({ error: `Unknown endpoint: ${path}` }, 404)
      }
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Accounting API error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
