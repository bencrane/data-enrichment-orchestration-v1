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

  // Get proposal
  const { data: proposal, error: proposalError } = await hqRevenueActivationSupabase
    .from("proposals")
    .select("id, company_id, booking_id, concept, concept_slug, organizer_email, special_terms, status, created_at, updated_at")
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
  // Note: Supabase types nested joins as arrays, so we access the first element
  const formattedLineItems = lineItems?.map((item) => {
    const lineItem = Array.isArray(item.line_items) ? item.line_items[0] : item.line_items;
    return {
      id: lineItem?.id,
      name: lineItem?.name,
      slug: lineItem?.slug,
      description: lineItem?.description,
      delivery_type: lineItem?.delivery_type,
      pricing_type: lineItem?.pricing_type,
      price: item.price,
      billing_frequency: item.billing_frequency,
      included: item.included,
    };
  });

  return NextResponse.json({
    data: {
      ...proposal,
      line_items: formattedLineItems,
    },
  });
}
