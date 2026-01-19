import { NextRequest, NextResponse } from "next/server";
import { hqRevenueActivationSupabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hqRevenueActivationSupabase) {
    return NextResponse.json(
      { error: "HQ Revenue Activation database not configured" },
      { status: 500 }
    );
  }

  const { id } = await params;
  const proposalId = parseInt(id, 10);

  if (isNaN(proposalId)) {
    return NextResponse.json({ error: "Invalid proposal ID" }, { status: 400 });
  }

  // Get proposal with line items
  const { data: proposal, error: proposalError } = await hqRevenueActivationSupabase
    .from("proposals")
    .select("id, client_id, status, special_terms, created_at, updated_at")
    .eq("id", proposalId)
    .single();

  if (proposalError) {
    if (proposalError.code === "PGRST116") {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({ error: proposalError.message }, { status: 500 });
  }

  // Get line items for this proposal
  const { data: lineItems, error: lineItemsError } = await hqRevenueActivationSupabase
    .from("proposal_line_items")
    .select(`
      id,
      price,
      billing_frequency,
      included,
      line_items (
        id,
        name,
        slug,
        description,
        delivery_type,
        pricing_type
      )
    `)
    .eq("proposal_id", proposalId);

  if (lineItemsError) {
    return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
  }

  // Flatten line items response
  const formattedLineItems = lineItems?.map((item) => ({
    id: item.line_items?.id,
    name: item.line_items?.name,
    slug: item.line_items?.slug,
    description: item.line_items?.description,
    delivery_type: item.line_items?.delivery_type,
    pricing_type: item.line_items?.pricing_type,
    price: item.price,
    billing_frequency: item.billing_frequency,
    included: item.included,
  }));

  return NextResponse.json({
    data: {
      ...proposal,
      line_items: formattedLineItems,
    },
  });
}
