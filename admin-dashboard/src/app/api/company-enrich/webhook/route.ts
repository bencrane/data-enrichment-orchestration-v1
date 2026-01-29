import { NextRequest, NextResponse } from "next/server";

// Store recent batch results in memory (in production, use a database)
// This is a simple solution for the admin dashboard
const batchResults = new Map<string, {
  event: string;
  batch_id: string;
  status: string;
  total: number;
  processed: number;
  errors: number;
  error_details: Array<{ domain: string; error: string }>;
  received_at: string;
}>();

// POST: Receive webhook callback when batch completes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("Webhook received:", JSON.stringify(body, null, 2));

    const { event, batch_id, status, total, processed, errors, error_details } = body;

    if (event === "batch_completed" && batch_id) {
      batchResults.set(batch_id, {
        event,
        batch_id,
        status,
        total: total || 0,
        processed: processed || 0,
        errors: errors || 0,
        error_details: error_details || [],
        received_at: new Date().toISOString(),
      });

      // Keep only last 100 results
      if (batchResults.size > 100) {
        const oldestKey = batchResults.keys().next().value;
        if (oldestKey) batchResults.delete(oldestKey);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET: Retrieve batch results (for polling)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");

  if (batchId) {
    const result = batchResults.get(batchId);
    if (result) {
      return NextResponse.json(result);
    }
    return NextResponse.json({ status: "pending", batch_id: batchId });
  }

  // Return all recent results
  const allResults = Array.from(batchResults.values()).reverse();
  return NextResponse.json({ results: allResults });
}
