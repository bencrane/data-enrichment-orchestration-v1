import { NextRequest, NextResponse } from "next/server";
import { hqRevenueActivationSupabase } from "@/lib/supabase";

interface LineItemInput {
  line_item_id: number;
  price: number;
  billing_frequency: string;
  included: boolean;
}

interface CreateProposalBody {
  client_id: number;
  special_terms?: string;
  line_items: LineItemInput[];
}

export async function POST(request: NextRequest) {
  if (!hqRevenueActivationSupabase) {
    return NextResponse.json(
      { error: "HQ Revenue Activation database not configured" },
      { status: 500 }
    );
  }

  const body: CreateProposalBody = await request.json();
  const { client_id, special_terms, line_items } = body;

  if (!client_id || !line_items || !Array.isArray(line_items)) {
    return NextResponse.json(
      { error: "client_id and line_items are required" },
      { status: 400 }
    );
  }

  // Insert proposal
  const { data: proposal, error: proposalError } = await hqRevenueActivationSupabase
    .from("proposals")
    .insert({
      client_id,
      special_terms: special_terms || null,
      status: "draft",
    })
    .select("id, client_id, status, special_terms, created_at")
    .single();

  if (proposalError) {
    return NextResponse.json({ error: proposalError.message }, { status: 500 });
  }

  // Insert line items
  const lineItemsToInsert = line_items.map((item) => ({
    proposal_id: proposal.id,
    line_item_id: item.line_item_id,
    price: item.price,
    billing_frequency: item.billing_frequency,
    included: item.included,
  }));

  const { data: insertedLineItems, error: lineItemsError } = await hqRevenueActivationSupabase
    .from("proposal_line_items")
    .insert(lineItemsToInsert)
    .select(`
      id,
      price,
      billing_frequency,
      included,
      line_items (
        id,
        name,
        slug,
        description
      )
    `);

  if (lineItemsError) {
    // Rollback: delete the proposal if line items failed
    await hqRevenueActivationSupabase.from("proposals").delete().eq("id", proposal.id);
    return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      proposal_id: proposal.id,
      client_id: proposal.client_id,
      status: proposal.status,
      special_terms: proposal.special_terms,
      line_items: insertedLineItems,
    },
  });
}
