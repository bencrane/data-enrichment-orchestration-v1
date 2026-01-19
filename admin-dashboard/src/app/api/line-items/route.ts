import { NextResponse } from "next/server";
import { hqRevenueActivationSupabase } from "@/lib/supabase";

export async function GET() {
  if (!hqRevenueActivationSupabase) {
    return NextResponse.json(
      { error: "HQ Revenue Activation database not configured" },
      { status: 500 }
    );
  }

  const { data, error } = await hqRevenueActivationSupabase
    .from("line_items")
    .select("id, slug, name, description, delivery_type, pricing_type, default_price")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
