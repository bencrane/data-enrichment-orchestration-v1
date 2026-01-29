import { NextRequest, NextResponse } from "next/server";
import { warehouseSupabase } from "@/lib/supabase";

const PROCESS_ENDPOINT = "https://bencrane--hq-master-data-ingest-process-similar-companies-queue.modal.run";
const STATUS_ENDPOINT = "https://bencrane--hq-master-data-ingest-get-similar-companies-queue-status.modal.run";

// POST: Insert domains into queue OR trigger batch processing
export async function POST(request: NextRequest) {
  try {
    if (!warehouseSupabase) {
      return NextResponse.json({ error: "Warehouse database not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { action } = body;

    // Action: queue - Insert domains into queue table
    if (action === "queue") {
      const { domains } = body;

      if (!domains || !Array.isArray(domains) || domains.length === 0) {
        return NextResponse.json({ error: "Domains array is required" }, { status: 400 });
      }

      // Insert domains into queue table
      const rows = domains.map((domain: string) => ({ domain: domain.toLowerCase().trim() }));

      const { data, error } = await warehouseSupabase
        .schema("raw")
        .from("company_enrich_similar_queue")
        .insert(rows)
        .select("id");

      if (error) {
        console.error("Database insert error:", error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        domains_queued: data?.length || 0,
      });
    }

    // Action: process - Trigger batch processing
    if (action === "process") {
      const { batch_size, webhook_url } = body;

      if (!batch_size || batch_size < 1) {
        return NextResponse.json({ error: "batch_size is required and must be >= 1" }, { status: 400 });
      }

      const res = await fetch(PROCESS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_size,
          webhook_url: webhook_url || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return NextResponse.json({ error: data.error || "Process request failed" }, { status: res.status });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid action. Use 'queue' or 'process'" }, { status: 400 });
  } catch (error) {
    console.error("Company enrich error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}

// GET: Fetch queue status
export async function GET() {
  try {
    const res = await fetch(STATUS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Status request failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Status fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status fetch failed" },
      { status: 500 }
    );
  }
}
