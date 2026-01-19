import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Warehouse database client (for raw_salesnav_leads etc)
const warehouseUrl = process.env.WAREHOUSE_SUPABASE_URL!;
const warehouseServiceKey = process.env.WAREHOUSE_SUPABASE_SERVICE_ROLE_KEY!;

export const warehouseSupabase = warehouseUrl && warehouseServiceKey 
  ? createClient(warehouseUrl, warehouseServiceKey)
  : null;

// HQ Revenue Activation database client (service catalog, proposals)
const hqRevenueActivationUrl = process.env.HQ_REVENUE_ACTIVATION_SUPABASE_URL!;
const hqRevenueActivationServiceKey = process.env.HQ_REVENUE_ACTIVATION_SUPABASE_SERVICE_ROLE_KEY!;

export const hqRevenueActivationSupabase = hqRevenueActivationUrl && hqRevenueActivationServiceKey
  ? createClient(hqRevenueActivationUrl, hqRevenueActivationServiceKey)
  : null;

export type ColumnInfo = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
};
