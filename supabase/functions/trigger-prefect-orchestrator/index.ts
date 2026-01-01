/**
 * Supabase Edge Function: trigger-prefect-orchestrator
 *
 * Purpose: Acts as a secure API Gateway (relay) between Postgres and Prefect Cloud.
 * Called by a database trigger via pg_net when a new batch is inserted.
 *
 * Required Environment Variables (set via Supabase Dashboard > Edge Functions > Secrets):
 *   - PREFECT_API_KEY: Your Prefect Cloud API key
 *   - PREFECT_ACCOUNT_ID: Your Prefect Cloud account ID
 *   - PREFECT_WORKSPACE_ID: Your Prefect Cloud workspace ID
 *   - PREFECT_DEPLOYMENT_ID: The deployment ID to trigger (e.g., cf1a2bed-45ff-4a0a-aa66-46936580e037)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface RequestPayload {
  batch_id: string;
}

interface PrefectFlowRunRequest {
  state?: {
    type: string;
    message?: string;
  };
  parameters?: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    console.error(`[trigger-prefect-orchestrator] Invalid method: ${req.method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Retrieve required environment variables
    const PREFECT_API_KEY = Deno.env.get("PREFECT_API_KEY");
    const PREFECT_ACCOUNT_ID = Deno.env.get("PREFECT_ACCOUNT_ID");
    const PREFECT_WORKSPACE_ID = Deno.env.get("PREFECT_WORKSPACE_ID");
    const PREFECT_DEPLOYMENT_ID = Deno.env.get("PREFECT_DEPLOYMENT_ID");

    // Validate all required secrets are present
    if (!PREFECT_API_KEY || !PREFECT_ACCOUNT_ID || !PREFECT_WORKSPACE_ID || !PREFECT_DEPLOYMENT_ID) {
      const missing = [
        !PREFECT_API_KEY && "PREFECT_API_KEY",
        !PREFECT_ACCOUNT_ID && "PREFECT_ACCOUNT_ID",
        !PREFECT_WORKSPACE_ID && "PREFECT_WORKSPACE_ID",
        !PREFECT_DEPLOYMENT_ID && "PREFECT_DEPLOYMENT_ID",
      ].filter(Boolean);

      console.error(`[trigger-prefect-orchestrator] Missing environment variables: ${missing.join(", ")}`);
      return new Response(
        JSON.stringify({ error: "Server configuration error", missing }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the incoming request payload
    const payload: RequestPayload = await req.json();
    const { batch_id } = payload;

    if (!batch_id) {
      console.error("[trigger-prefect-orchestrator] Missing batch_id in request payload");
      return new Response(
        JSON.stringify({ error: "Missing batch_id in request payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[trigger-prefect-orchestrator] Triggering flow run for batch_id: ${batch_id}`);

    // Construct Prefect Cloud API URL
    const prefectUrl = `https://api.prefect.cloud/api/accounts/${PREFECT_ACCOUNT_ID}/workspaces/${PREFECT_WORKSPACE_ID}/deployments/${PREFECT_DEPLOYMENT_ID}/create_flow_run`;

    // Prepare the flow run request body
    // Note: Parameters can be passed to the flow if needed
    const flowRunRequest: PrefectFlowRunRequest = {
      state: {
        type: "SCHEDULED",
        message: `Triggered by batch creation: ${batch_id}`,
      },
      // Optionally pass batch_id as a parameter if your flow accepts it
      // parameters: { batch_id },
    };

    // Call Prefect Cloud API
    const prefectResponse = await fetch(prefectUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PREFECT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flowRunRequest),
    });

    // Handle Prefect API response
    if (!prefectResponse.ok) {
      const errorBody = await prefectResponse.text();
      console.error(
        `[trigger-prefect-orchestrator] Prefect API error: ${prefectResponse.status} ${prefectResponse.statusText}`,
        errorBody
      );
      return new Response(
        JSON.stringify({
          error: "Failed to trigger Prefect flow run",
          status: prefectResponse.status,
          details: errorBody,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const flowRunData = await prefectResponse.json();
    console.log(
      `[trigger-prefect-orchestrator] Successfully triggered flow run for batch_id: ${batch_id}`,
      `Flow run ID: ${flowRunData.id || "unknown"}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        batch_id,
        flow_run_id: flowRunData.id,
        message: "Prefect flow run triggered successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trigger-prefect-orchestrator] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
