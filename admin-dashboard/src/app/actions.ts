"use server";

import { supabase, ColumnInfo } from "@/lib/supabase";

export async function getTableSchema(tableName: string): Promise<ColumnInfo[]> {
  const { data, error } = await supabase.rpc("get_table_columns", {
    p_table_name: tableName,
  });

  if (error) {
    // Fallback: direct query if RPC doesn't exist
    const { data: directData, error: directError } = await supabase
      .from("columns")
      .select("column_name, data_type, udt_name, is_nullable, column_default")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (directError) {
      console.error("Error fetching schema:", directError);
      return [];
    }
    return directData as ColumnInfo[];
  }

  return data as ColumnInfo[];
}

export async function getPublicTables(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_public_tables");

  if (error) {
    console.error("Error fetching tables:", error);
    // Return known tables as fallback
    return ["batches", "batch_items", "workflow_states"];
  }

  return data.map((row: { table_name: string }) => row.table_name);
}

// ============ Client Actions ============

export type Client = {
  id: string;
  company_name: string;
  company_domain: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string;
};

export type CreateClientInput = {
  company_name: string;
  company_domain: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
  return data as Client[];
}

export async function createClient(input: CreateClientInput): Promise<{ success: boolean; error?: string; client?: Client }> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_name: input.company_name,
      company_domain: input.company_domain,
      first_name: input.first_name || null,
      last_name: input.last_name || null,
      email: input.email || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating client:", error);
    return { success: false, error: error.message };
  }
  return { success: true, client: data as Client };
}

// ============ Batch Actions ============

export type BatchItem = {
  company_name: string;
  company_domain: string;
  person_first_name: string;
  person_last_name: string;
  person_linkedin_url: string;
  job_title?: string;
  custom_inputs?: Record<string, unknown>;
};

export async function createBatch(
  clientId: string,
  blueprint: string[],
  items: BatchItem[],
  workstreamSlug: string
): Promise<{ success: boolean; error?: string; batchId?: string }> {
  // 1. Create the batch
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .insert({
      client_id: clientId,
      blueprint: blueprint,
      status: "PENDING",
      workstream_slug: workstreamSlug,
    })
    .select()
    .single();

  if (batchError) {
    console.error("Error creating batch:", batchError);
    return { success: false, error: batchError.message };
  }

  const batchId = batch.id;

  // 2. Create batch items
  const batchItems = items.map((item) => ({
    batch_id: batchId,
    company_name: item.company_name,
    company_domain: item.company_domain,
    person_first_name: item.person_first_name,
    person_last_name: item.person_last_name,
    person_linkedin_url: item.person_linkedin_url,
    job_title: item.job_title || null,
    custom_inputs: item.custom_inputs || null,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("batch_items")
    .insert(batchItems)
    .select();

  if (itemsError) {
    console.error("Error creating batch items:", itemsError);
    // Rollback: delete the batch
    await supabase.from("batches").delete().eq("id", batchId);
    return { success: false, error: itemsError.message };
  }

  // 3. Create workflow states for the first step in blueprint
  if (blueprint.length > 0 && insertedItems) {
    const firstStep = blueprint[0];
    const workflowStates = insertedItems.map((item: { id: string }) => ({
      id: crypto.randomUUID(),
      batch_id: batchId,
      item_id: item.id,
      step_name: firstStep,
      status: "PENDING",
    }));

    const { error: statesError } = await supabase
      .from("workflow_states")
      .insert(workflowStates);

    if (statesError) {
      console.error("Error creating workflow states:", statesError);
      return { success: false, error: statesError.message };
    }
  }

  return { success: true, batchId };
}

// ============ Apollo Upload Actions ============

export type ApolloRow = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  headline?: string;
  seniority?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  is_likely_to_engage?: string;
  lead_city?: string;
  lead_state?: string;
  lead_country?: string;
  company_name?: string;
  industry?: string;
  employee_count?: string;
  departments?: string;
  subdepartments?: string;
  functions?: string;
  company_website?: string;
  company_website_short?: string;
  company_blog_url?: string;
  company_twitter_url?: string;
  company_facebook_url?: string;
  company_linkedin_url?: string;
  company_phone?: string;
  company_street?: string;
  company_city?: string;
  company_state?: string;
  company_country?: string;
  company_postal_code?: string;
  company_address?: string;
  company_annual_revenue?: string;
  company_market_cap?: string;
  company_total_funding?: string;
  company_latest_funding_type?: string;
  company_latest_funding_amount?: string;
  company_last_funding_date?: string;
  company_keywords?: string;
  company_technologies?: string;
  company_short_description?: string;
  company_seo_description?: string;
  number_of_retail_locations?: string;
  company_founded_year?: string;
};

export type ApolloUpload = {
  id: string;
  upload_id: string;
  uploaded_at: string;
  row_count: number;
};

export async function getClientById(clientId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) {
    console.error("Error fetching client:", error);
    return null;
  }
  return data as Client;
}

export async function getApolloUploads(clientId: string): Promise<ApolloUpload[]> {
  const { data, error } = await supabase
    .from("raw_apollo_data")
    .select("upload_id, uploaded_at")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching uploads:", error);
    return [];
  }

  // Group by upload_id and count rows
  const uploadMap = new Map<string, { uploaded_at: string; count: number }>();
  for (const row of data) {
    const existing = uploadMap.get(row.upload_id);
    if (existing) {
      existing.count++;
    } else {
      uploadMap.set(row.upload_id, { uploaded_at: row.uploaded_at, count: 1 });
    }
  }

  return Array.from(uploadMap.entries()).map(([upload_id, info]) => ({
    id: upload_id,
    upload_id,
    uploaded_at: info.uploaded_at,
    row_count: info.count,
  }));
}

export async function uploadApolloData(
  clientId: string,
  uploadId: string,
  rows: ApolloRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    full_name: row.full_name || null,
    title: row.title || null,
    headline: row.headline || null,
    seniority: row.seniority || null,
    email: row.email || null,
    email_status: row.email_status || null,
    linkedin_url: row.linkedin_url || null,
    is_likely_to_engage: row.is_likely_to_engage || null,
    lead_city: row.lead_city || null,
    lead_state: row.lead_state || null,
    lead_country: row.lead_country || null,
    company_name: row.company_name || null,
    industry: row.industry || null,
    employee_count: row.employee_count || null,
    departments: row.departments || null,
    subdepartments: row.subdepartments || null,
    functions: row.functions || null,
    company_website: row.company_website || null,
    company_website_short: row.company_website_short || null,
    company_blog_url: row.company_blog_url || null,
    company_twitter_url: row.company_twitter_url || null,
    company_facebook_url: row.company_facebook_url || null,
    company_linkedin_url: row.company_linkedin_url || null,
    company_phone: row.company_phone || null,
    company_street: row.company_street || null,
    company_city: row.company_city || null,
    company_state: row.company_state || null,
    company_country: row.company_country || null,
    company_postal_code: row.company_postal_code || null,
    company_address: row.company_address || null,
    company_annual_revenue: row.company_annual_revenue || null,
    company_market_cap: row.company_market_cap || null,
    company_total_funding: row.company_total_funding || null,
    company_latest_funding_type: row.company_latest_funding_type || null,
    company_latest_funding_amount: row.company_latest_funding_amount || null,
    company_last_funding_date: row.company_last_funding_date || null,
    company_keywords: row.company_keywords || null,
    company_technologies: row.company_technologies || null,
    company_short_description: row.company_short_description || null,
    company_seo_description: row.company_seo_description || null,
    number_of_retail_locations: row.number_of_retail_locations || null,
    company_founded_year: row.company_founded_year || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("raw_apollo_data").insert(batch);

    if (error) {
      console.error("Error inserting Apollo data:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

// ============ Batch Management Actions ============

export type Batch = {
  id: string;
  client_id: string;
  status: string;
  blueprint: string[];
  created_at: string;
  item_count?: number;
};

export async function getClientBatches(clientId: string): Promise<Batch[]> {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching batches:", error);
    return [];
  }

  // Get item counts for each batch
  const batchesWithCounts = await Promise.all(
    (data || []).map(async (batch) => {
      const { count } = await supabase
        .from("batch_items")
        .select("*", { count: "exact", head: true })
        .eq("batch_id", batch.id);

      return {
        ...batch,
        item_count: count || 0,
      };
    })
  );

  return batchesWithCounts as Batch[];
}

export type RawApolloRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  company_website_short: string | null;
  company_website: string | null;
  [key: string]: string | null | undefined;
};

export async function startBatchFromUpload(
  clientId: string,
  uploadId: string,
  blueprint: string[],
  workstreamSlug: string
): Promise<{ success: boolean; error?: string; batchId?: string; itemCount?: number }> {
  // 1. Fetch all raw_apollo_data rows for this upload
  const { data: rawRows, error: fetchError } = await supabase
    .from("raw_apollo_data")
    .select("*")
    .eq("client_id", clientId)
    .eq("upload_id", uploadId);

  if (fetchError) {
    console.error("Error fetching raw Apollo data:", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!rawRows || rawRows.length === 0) {
    return { success: false, error: "No data found for this upload" };
  }

  // 2. Create the batch with explicit UUID
  const batchId = crypto.randomUUID();
  const { error: batchError } = await supabase
    .from("batches")
    .insert({
      id: batchId,
      client_id: clientId,
      blueprint: blueprint,
      status: "PENDING",
      workstream_slug: workstreamSlug,
    });

  if (batchError) {
    console.error("Error creating batch:", batchError);
    return { success: false, error: batchError.message };
  }

  // 3. Transform raw Apollo rows to BatchItems with explicit UUIDs
  const batchItems = rawRows.map((raw: RawApolloRow) => ({
    id: crypto.randomUUID(),
    batch_id: batchId,
    // Company fields
    company_name: raw.company_name || null,
    company_domain: raw.company_website_short || raw.company_website || null,
    company_linkedin_url: raw.company_linkedin_url || null,
    company_industry: raw.industry || null,
    company_city: raw.company_city || null,
    company_state: raw.company_state || null,
    company_country: raw.company_country || null,
    // Person fields
    person_first_name: raw.first_name || null,
    person_last_name: raw.last_name || null,
    person_linkedin_url: raw.linkedin_url || null,
    person_title: raw.title || null,
    // Store complete original data
    original_data: raw,
  }));

  // 4. Insert batch items in chunks
  const CHUNK_SIZE = 500;
  const insertedItemIds: string[] = [];

  for (let i = 0; i < batchItems.length; i += CHUNK_SIZE) {
    const chunk = batchItems.slice(i, i + CHUNK_SIZE);
    const { error: itemsError } = await supabase
      .from("batch_items")
      .insert(chunk);

    if (itemsError) {
      console.error("Error creating batch items:", itemsError);
      // Rollback: delete the batch
      await supabase.from("batches").delete().eq("id", batchId);
      return { success: false, error: itemsError.message };
    }

    // Collect the IDs we generated
    insertedItemIds.push(...chunk.map((item) => item.id));
  }

  // 5. Create WorkflowState (PENDING) for the first step in blueprint
  if (blueprint.length > 0 && insertedItemIds.length > 0) {
    const firstStep = blueprint[0];
    const workflowStates = insertedItemIds.map((itemId) => ({
      id: crypto.randomUUID(),
      batch_id: batchId,
      item_id: itemId,
      step_name: firstStep,
      status: "PENDING",
    }));

    // Insert workflow states in chunks
    for (let i = 0; i < workflowStates.length; i += CHUNK_SIZE) {
      const chunk = workflowStates.slice(i, i + CHUNK_SIZE);
      const { error: statesError } = await supabase
        .from("workflow_states")
        .insert(chunk);

      if (statesError) {
        console.error("Error creating workflow states:", statesError);
        return { success: false, error: statesError.message };
      }
    }
  }

  return { success: true, batchId, itemCount: insertedItemIds.length };
}

// ============ Workflow Registry Actions ============

export type EnrichmentWorkflow = {
  slug: string;
  name: string;
  type: "SYNC" | "ASYNC";
  description: string | null;
  modal_sender_fn: string | null;
  modal_receiver_fn: string | null;
  workstream_slug: string | null;
  requires_clay: boolean;
  created_at: string;
};

export type CreateWorkflowInput = {
  slug: string;
  name: string;
  type: "SYNC" | "ASYNC";
  description?: string;
  modal_sender_fn?: string;
  modal_receiver_fn?: string;
  workstream_slug?: string | null;
  requires_clay?: boolean;
};

export async function getWorkflows(): Promise<EnrichmentWorkflow[]> {
  const { data, error } = await supabase
    .from("enrichment_registry")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workflows:", error);
    return [];
  }
  return data as EnrichmentWorkflow[];
}

export async function getWorkflowsByWorkstream(
  workstreamSlug: string
): Promise<EnrichmentWorkflow[]> {
  const { data, error } = await supabase
    .from("enrichment_registry")
    .select("*")
    .eq("workstream_slug", workstreamSlug)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workflows by workstream:", error);
    return [];
  }
  return data as EnrichmentWorkflow[];
}

export async function createWorkflow(
  input: CreateWorkflowInput
): Promise<{ success: boolean; error?: string; workflow?: EnrichmentWorkflow }> {
  const { data, error } = await supabase
    .from("enrichment_registry")
    .insert({
      slug: input.slug,
      name: input.name,
      type: input.type,
      description: input.description || null,
      modal_sender_fn: input.modal_sender_fn || null,
      modal_receiver_fn: input.modal_receiver_fn || null,
      workstream_slug: input.workstream_slug || null,
      requires_clay: input.requires_clay ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating workflow:", error);
    return { success: false, error: error.message };
  }
  return { success: true, workflow: data as EnrichmentWorkflow };
}

export async function updateWorkflow(
  slug: string,
  input: Partial<Omit<CreateWorkflowInput, "slug">>
): Promise<{ success: boolean; error?: string; workflow?: EnrichmentWorkflow }> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.modal_sender_fn !== undefined) updateData.modal_sender_fn = input.modal_sender_fn || null;
  if (input.modal_receiver_fn !== undefined) updateData.modal_receiver_fn = input.modal_receiver_fn || null;
  if (input.workstream_slug !== undefined) updateData.workstream_slug = input.workstream_slug;
  if (input.requires_clay !== undefined) updateData.requires_clay = input.requires_clay;

  const { data, error } = await supabase
    .from("enrichment_registry")
    .update(updateData)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    console.error("Error updating workflow:", error);
    return { success: false, error: error.message };
  }
  return { success: true, workflow: data as EnrichmentWorkflow };
}

export async function deleteWorkflow(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("enrichment_registry")
    .delete()
    .eq("slug", slug);

  if (error) {
    console.error("Error deleting workflow:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============ Enrichment Pipeline Actions ============

export type EnrichmentPipeline = {
  id: string;
  client_id: string | null;
  workstream_slug: string | null;
  name: string;
  description: string | null;
  steps: string[];
  is_active: boolean;
  created_at: string;
};

export type CreatePipelineInput = {
  name: string;
  description?: string;
  steps: string[];
  is_active?: boolean;
};

export async function getClientPipelines(clientId: string): Promise<EnrichmentPipeline[]> {
  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pipelines:", error);
    return [];
  }
  return data as EnrichmentPipeline[];
}

export async function getPipelineById(pipelineId: string): Promise<EnrichmentPipeline | null> {
  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .select("*")
    .eq("id", pipelineId)
    .single();

  if (error) {
    console.error("Error fetching pipeline:", error);
    return null;
  }
  return data as EnrichmentPipeline;
}

export async function createPipeline(
  clientId: string,
  input: CreatePipelineInput
): Promise<{ success: boolean; error?: string; pipeline?: EnrichmentPipeline }> {
  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .insert({
      client_id: clientId,
      name: input.name,
      description: input.description || null,
      steps: input.steps,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true, pipeline: data as EnrichmentPipeline };
}

export async function updatePipeline(
  pipelineId: string,
  input: Partial<CreatePipelineInput>
): Promise<{ success: boolean; error?: string; pipeline?: EnrichmentPipeline }> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.steps !== undefined) updateData.steps = input.steps;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .update(updateData)
    .eq("id", pipelineId)
    .select()
    .single();

  if (error) {
    console.error("Error updating pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true, pipeline: data as EnrichmentPipeline };
}

export async function createClientPipelineForWorkstream(
  clientId: string,
  workstreamSlug: string,
  input: CreatePipelineInput
): Promise<{ success: boolean; error?: string; pipeline?: EnrichmentPipeline }> {
  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .insert({
      client_id: clientId,
      workstream_slug: workstreamSlug,
      name: input.name,
      description: input.description || null,
      steps: input.steps,
      is_active: input.is_active || false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating client pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true, pipeline: data as EnrichmentPipeline };
}

export async function deletePipeline(
  pipelineId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("enrichment_pipelines")
    .delete()
    .eq("id", pipelineId);

  if (error) {
    console.error("Error deleting pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============ Workstream Pipeline Actions ============

export async function getWorkstreamPipelines(
  workstreamSlug: string
): Promise<EnrichmentPipeline[]> {
  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .select("*")
    .eq("workstream_slug", workstreamSlug)
    .is("client_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workstream pipelines:", error);
    return [];
  }
  return data as EnrichmentPipeline[];
}

export async function createWorkstreamPipeline(
  workstreamSlug: string,
  input: CreatePipelineInput
): Promise<{ success: boolean; error?: string; pipeline?: EnrichmentPipeline }> {
  // If this pipeline should be active, deactivate others first
  if (input.is_active) {
    await supabase
      .from("enrichment_pipelines")
      .update({ is_active: false })
      .eq("workstream_slug", workstreamSlug)
      .is("client_id", null);
  }

  const { data, error } = await supabase
    .from("enrichment_pipelines")
    .insert({
      workstream_slug: workstreamSlug,
      client_id: null,
      name: input.name,
      description: input.description || null,
      steps: input.steps,
      is_active: input.is_active || false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating workstream pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true, pipeline: data as EnrichmentPipeline };
}

export async function setActivePipeline(
  pipelineId: string,
  workstreamSlug: string,
  clientId: string | null
): Promise<{ success: boolean; error?: string }> {
  // Deactivate all pipelines for this workstream/client combo
  let deactivateQuery = supabase
    .from("enrichment_pipelines")
    .update({ is_active: false })
    .eq("workstream_slug", workstreamSlug);

  if (clientId) {
    deactivateQuery = deactivateQuery.eq("client_id", clientId);
  } else {
    deactivateQuery = deactivateQuery.is("client_id", null);
  }

  await deactivateQuery;

  // Activate the selected pipeline
  const { error } = await supabase
    .from("enrichment_pipelines")
    .update({ is_active: true })
    .eq("id", pipelineId);

  if (error) {
    console.error("Error setting active pipeline:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getActivePipelineForClient(
  workstreamSlug: string,
  clientId: string
): Promise<EnrichmentPipeline | null> {
  // First check for client-specific active pipeline
  const { data: clientPipeline } = await supabase
    .from("enrichment_pipelines")
    .select("*")
    .eq("workstream_slug", workstreamSlug)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .single();

  if (clientPipeline) {
    return clientPipeline as EnrichmentPipeline;
  }

  // Fall back to workstream default
  const { data: workstreamPipeline } = await supabase
    .from("enrichment_pipelines")
    .select("*")
    .eq("workstream_slug", workstreamSlug)
    .is("client_id", null)
    .eq("is_active", true)
    .single();

  return workstreamPipeline as EnrichmentPipeline | null;
}

// ============ Upload Inspector Actions ============

export type UploadDetails = {
  upload_id: string;
  client_id: string;
  uploaded_at: string;
  row_count: number;
  rows: RawApolloRow[];
};

export async function getUploadDetails(
  clientId: string,
  uploadId: string,
  limit: number = 100
): Promise<UploadDetails | null> {
  // Get count first
  const { count, error: countError } = await supabase
    .from("raw_apollo_data")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("upload_id", uploadId);

  if (countError) {
    console.error("Error fetching upload count:", countError);
    return null;
  }

  // Get rows with limit
  const { data, error } = await supabase
    .from("raw_apollo_data")
    .select("*")
    .eq("client_id", clientId)
    .eq("upload_id", uploadId)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching upload details:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return {
    upload_id: uploadId,
    client_id: clientId,
    uploaded_at: data[0].uploaded_at,
    row_count: count || data.length,
    rows: data as RawApolloRow[],
  };
}

export async function startBatchFromSelectedRows(
  clientId: string,
  uploadId: string,
  rowIds: string[],
  blueprint: string[],
  workstreamSlug: string
): Promise<{ success: boolean; error?: string; batchId?: string; itemCount?: number }> {
  if (!rowIds || rowIds.length === 0) {
    return { success: false, error: "No rows selected" };
  }

  // 1. Fetch the selected raw_apollo_data rows
  const { data: rawRows, error: fetchError } = await supabase
    .from("raw_apollo_data")
    .select("*")
    .eq("client_id", clientId)
    .eq("upload_id", uploadId)
    .in("id", rowIds);

  if (fetchError) {
    console.error("Error fetching raw Apollo data:", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!rawRows || rawRows.length === 0) {
    return { success: false, error: "No data found for selected rows" };
  }

  // 2. Create the batch with explicit UUID
  const batchId = crypto.randomUUID();
  const { error: batchError } = await supabase
    .from("batches")
    .insert({
      id: batchId,
      client_id: clientId,
      blueprint: blueprint,
      status: "PENDING",
      workstream_slug: workstreamSlug,
    });

  if (batchError) {
    console.error("Error creating batch:", batchError);
    return { success: false, error: batchError.message };
  }

  // 3. Transform raw Apollo rows to BatchItems with explicit UUIDs
  const batchItems = rawRows.map((raw: RawApolloRow) => ({
    id: crypto.randomUUID(),
    batch_id: batchId,
    // Company fields
    company_name: raw.company_name || null,
    company_domain: raw.company_website_short || raw.company_website || null,
    company_linkedin_url: raw.company_linkedin_url || null,
    company_industry: raw.industry || null,
    company_city: raw.company_city || null,
    company_state: raw.company_state || null,
    company_country: raw.company_country || null,
    // Person fields
    person_first_name: raw.first_name || null,
    person_last_name: raw.last_name || null,
    person_linkedin_url: raw.linkedin_url || null,
    person_title: raw.title || null,
    // Store complete original data
    original_data: raw,
  }));

  // 4. Insert batch items in chunks
  const CHUNK_SIZE = 500;
  const insertedItemIds: string[] = [];

  for (let i = 0; i < batchItems.length; i += CHUNK_SIZE) {
    const chunk = batchItems.slice(i, i + CHUNK_SIZE);
    const { error: itemsError } = await supabase
      .from("batch_items")
      .insert(chunk);

    if (itemsError) {
      console.error("Error creating batch items:", itemsError);
      // Rollback: delete the batch
      await supabase.from("batches").delete().eq("id", batchId);
      return { success: false, error: itemsError.message };
    }

    // Collect the IDs we generated
    insertedItemIds.push(...chunk.map((item) => item.id));
  }

  // 5. Create WorkflowState (PENDING) for the first step in blueprint
  if (blueprint.length > 0 && insertedItemIds.length > 0) {
    const firstStep = blueprint[0];
    const workflowStates = insertedItemIds.map((itemId) => ({
      id: crypto.randomUUID(),
      batch_id: batchId,
      item_id: itemId,
      step_name: firstStep,
      status: "PENDING",
    }));

    // Insert workflow states in chunks
    for (let i = 0; i < workflowStates.length; i += CHUNK_SIZE) {
      const chunk = workflowStates.slice(i, i + CHUNK_SIZE);
      const { error: statesError } = await supabase
        .from("workflow_states")
        .insert(chunk);

      if (statesError) {
        console.error("Error creating workflow states:", statesError);
        return { success: false, error: statesError.message };
      }
    }
  }

  return { success: true, batchId, itemCount: insertedItemIds.length };
}

// ============ Client Workflow Configuration Actions ============

export type ClientWorkflowConfig = {
  id: string;
  client_id: string;
  workflow_slug: string;
  workstream_slug: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getClientWorkflowConfig(
  clientId: string,
  workflowSlug: string
): Promise<ClientWorkflowConfig | null> {
  const { data, error } = await supabase
    .from("client_workflow_configs")
    .select("*")
    .eq("client_id", clientId)
    .eq("workflow_slug", workflowSlug)
    .single();

  if (error) {
    // PGRST116 = no rows returned (not an error for our use case)
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching client workflow config:", error);
    return null;
  }
  return data as ClientWorkflowConfig;
}

export async function getClientWorkflowConfigs(
  clientId: string
): Promise<ClientWorkflowConfig[]> {
  const { data, error } = await supabase
    .from("client_workflow_configs")
    .select("*")
    .eq("client_id", clientId)
    .order("workflow_slug", { ascending: true });

  if (error) {
    console.error("Error fetching client workflow configs:", error);
    return [];
  }
  return data as ClientWorkflowConfig[];
}

export async function saveClientWorkflowConfig(
  clientId: string,
  workflowSlug: string,
  config: Record<string, unknown>,
  workstreamSlug: string
): Promise<{ success: boolean; error?: string; config?: ClientWorkflowConfig }> {
  // Use upsert to handle the unique constraint (client_id, workflow_slug, workstream_slug)
  const { data, error } = await supabase
    .from("client_workflow_configs")
    .upsert(
      {
        client_id: clientId,
        workflow_slug: workflowSlug,
        workstream_slug: workstreamSlug,
        config: config,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "client_id,workflow_slug,workstream_slug",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving client workflow config:", error);
    return { success: false, error: error.message };
  }
  return { success: true, config: data as ClientWorkflowConfig };
}

export async function deleteClientWorkflowConfig(
  clientId: string,
  workflowSlug: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("client_workflow_configs")
    .delete()
    .eq("client_id", clientId)
    .eq("workflow_slug", workflowSlug);

  if (error) {
    console.error("Error deleting client workflow config:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============ Customer Companies Actions ============

export type CustomerCompanyRow = {
  company_name: string;
  domain?: string;
  company_linkedin_url?: string;
  [key: string]: string | undefined;
};

export type CustomerCompanyUpload = {
  id: string;
  upload_id: string;
  uploaded_at: string;
  row_count: number;
};

export async function getCustomerCompanyUploads(clientId: string): Promise<CustomerCompanyUpload[]> {
  const { data, error } = await supabase
    .from("client_customer_companies")
    .select("upload_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer company uploads:", error);
    return [];
  }

  // Group by upload_id and count rows
  const uploadMap = new Map<string, { uploaded_at: string; count: number }>();
  for (const row of data) {
    const existing = uploadMap.get(row.upload_id);
    if (existing) {
      existing.count++;
    } else {
      uploadMap.set(row.upload_id, { uploaded_at: row.created_at, count: 1 });
    }
  }

  return Array.from(uploadMap.entries()).map(([upload_id, info]) => ({
    id: upload_id,
    upload_id,
    uploaded_at: info.uploaded_at,
    row_count: info.count,
  }));
}

export async function uploadCustomerCompanies(
  clientId: string,
  uploadId: string,
  rows: CustomerCompanyRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    company_name: row.company_name,
    domain: row.domain || null,
    company_linkedin_url: row.company_linkedin_url || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("client_customer_companies").insert(batch);

    if (error) {
      console.error("Error inserting customer companies:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

// ============ SalesNav KoolKit Actions ============

export type SalesNavKoolKitRow = {
  matching_filters?: string;
  linkedin_user_profile_urn?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  profile_headline?: string;
  profile_summary?: string;
  job_title?: string;
  job_description?: string;
  job_started_on?: string;
  linkedin_url_user_profile?: string;
  location?: string;
  company?: string;
  linkedin_company_profile_urn?: string;
  linkedin_url_company?: string;
  company_website?: string;
  company_description?: string;
  company_headcount?: string;
  company_industries?: string;
  company_registered_address?: string;
  [key: string]: string | undefined;
};

export type SalesNavKoolKitUpload = {
  id: string;
  upload_id: string;
  uploaded_at: string;
  row_count: number;
};

export async function getSalesNavKoolKitUploads(clientId: string): Promise<SalesNavKoolKitUpload[]> {
  const { data, error } = await supabase
    .from("client_salesnav_koolkit")
    .select("upload_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching SalesNav KoolKit uploads:", error);
    return [];
  }

  // Group by upload_id and count rows
  const uploadMap = new Map<string, { uploaded_at: string; count: number }>();
  for (const row of data) {
    const existing = uploadMap.get(row.upload_id);
    if (existing) {
      existing.count++;
    } else {
      uploadMap.set(row.upload_id, { uploaded_at: row.created_at, count: 1 });
    }
  }

  return Array.from(uploadMap.entries()).map(([upload_id, info]) => ({
    id: upload_id,
    upload_id,
    uploaded_at: info.uploaded_at,
    row_count: info.count,
  }));
}

export async function uploadSalesNavKoolKit(
  clientId: string,
  uploadId: string,
  rows: SalesNavKoolKitRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    matching_filters: row.matching_filters || null,
    linkedin_user_profile_urn: row.linkedin_user_profile_urn || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email: row.email || null,
    phone_number: row.phone_number || null,
    profile_headline: row.profile_headline || null,
    profile_summary: row.profile_summary || null,
    job_title: row.job_title || null,
    job_description: row.job_description || null,
    job_started_on: row.job_started_on || null,
    linkedin_url_user_profile: row.linkedin_url_user_profile || null,
    location: row.location || null,
    company: row.company || null,
    linkedin_company_profile_urn: row.linkedin_company_profile_urn || null,
    linkedin_url_company: row.linkedin_url_company || null,
    company_website: row.company_website || null,
    company_description: row.company_description || null,
    company_headcount: row.company_headcount || null,
    company_industries: row.company_industries || null,
    company_registered_address: row.company_registered_address || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("client_salesnav_koolkit").insert(batch);

    if (error) {
      console.error("Error inserting SalesNav KoolKit data:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

// ============ CRM Data Upload Actions ============

export type CrmDataRow = {
  company_name?: string;
  domain?: string;
  company_linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  person_linkedin_url?: string;
  work_email?: string;
  mobile_phone?: string;
  notes?: string;
  [key: string]: string | undefined;
};

export type CrmDataUpload = {
  id: string;
  upload_id: string;
  uploaded_at: string;
  row_count: number;
  file_type: "companies" | "people";
};

export async function getCrmDataUploads(clientId: string): Promise<CrmDataUpload[]> {
  // Query both normalized tables
  const [companiesResult, peopleResult] = await Promise.all([
    supabase
      .from("crm_data_normalized_companies")
      .select("upload_id, created_at")
      .eq("client_id", clientId),
    supabase
      .from("crm_data_normalized_people")
      .select("upload_id, created_at")
      .eq("client_id", clientId),
  ]);

  if (companiesResult.error) {
    console.error("Error fetching CRM companies uploads:", companiesResult.error);
  }
  if (peopleResult.error) {
    console.error("Error fetching CRM people uploads:", peopleResult.error);
  }

  const companiesData = companiesResult.data || [];
  const peopleData = peopleResult.data || [];

  // Group by upload_id and count rows
  const uploadMap = new Map<string, { uploaded_at: string; count: number; file_type: "companies" | "people" }>();

  for (const row of companiesData) {
    const existing = uploadMap.get(row.upload_id);
    if (existing) {
      existing.count++;
    } else {
      uploadMap.set(row.upload_id, { uploaded_at: row.created_at, count: 1, file_type: "companies" });
    }
  }

  for (const row of peopleData) {
    const existing = uploadMap.get(row.upload_id);
    if (existing) {
      existing.count++;
    } else {
      uploadMap.set(row.upload_id, { uploaded_at: row.created_at, count: 1, file_type: "people" });
    }
  }

  // Sort by uploaded_at descending
  const uploads = Array.from(uploadMap.entries()).map(([upload_id, info]) => ({
    id: upload_id,
    upload_id,
    uploaded_at: info.uploaded_at,
    row_count: info.count,
    file_type: info.file_type,
  }));

  uploads.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  return uploads;
}

export async function uploadCrmData(
  clientId: string,
  uploadId: string,
  rows: CrmDataRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    company_name: row.company_name || null,
    domain: row.domain || null,
    company_linkedin_url: row.company_linkedin_url || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    person_linkedin_url: row.person_linkedin_url || null,
    work_email: row.work_email || null,
    mobile_phone: row.mobile_phone || null,
    notes: row.notes || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("client_crm_data").insert(batch);

    if (error) {
      console.error("Error inserting CRM data:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

// ============ CRM Data Normalized Tables ============

export type CrmNormalizedCompanyRow = {
  company_name?: string;
  domain?: string;
  company_linkedin_url?: string;
};

export type CrmNormalizedPersonRow = {
  company_name?: string;
  domain?: string;
  company_linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  person_linkedin_url?: string;
  email?: string;
  mobile_phone?: string;
};

export type CrmDataFileType = "companies" | "people";

export async function uploadCrmNormalizedCompanies(
  clientId: string,
  uploadId: string,
  rows: CrmNormalizedCompanyRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    company_name: row.company_name || null,
    domain: row.domain || null,
    company_linkedin_url: row.company_linkedin_url || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("crm_data_normalized_companies").insert(batch);

    if (error) {
      console.error("Error inserting CRM normalized companies:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

export async function uploadCrmNormalizedPeople(
  clientId: string,
  uploadId: string,
  rows: CrmNormalizedPersonRow[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    company_name: row.company_name || null,
    domain: row.domain || null,
    company_linkedin_url: row.company_linkedin_url || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    full_name: row.full_name || null,
    person_linkedin_url: row.person_linkedin_url || null,
    email: row.email || null,
    mobile_phone: row.mobile_phone || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("crm_data_normalized_people").insert(batch);

    if (error) {
      console.error("Error inserting CRM normalized people:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}

// ============ Data Ingestion Workstreams Actions ============

export type DataIngestionWorkstream = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  table_name: string | null;
  route_path: string | null;
  is_active: boolean;
  created_at: string;
};

export type CreateWorkstreamInput = {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  table_name?: string;
  route_path?: string;
  is_active?: boolean;
};

export async function getDataIngestionWorkstreams(): Promise<DataIngestionWorkstream[]> {
  const { data, error } = await supabase
    .from("data_ingestion_workstreams")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching workstreams:", error);
    return [];
  }
  return data as DataIngestionWorkstream[];
}

export async function getActiveWorkstreams(): Promise<DataIngestionWorkstream[]> {
  const { data, error } = await supabase
    .from("data_ingestion_workstreams")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching active workstreams:", error);
    return [];
  }
  return data as DataIngestionWorkstream[];
}

export async function createDataIngestionWorkstream(
  input: CreateWorkstreamInput
): Promise<{ success: boolean; error?: string; workstream?: DataIngestionWorkstream }> {
  const { data, error } = await supabase
    .from("data_ingestion_workstreams")
    .insert({
      slug: input.slug,
      name: input.name,
      description: input.description || null,
      icon: input.icon || null,
      color: input.color || null,
      table_name: input.table_name || null,
      route_path: input.route_path || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating workstream:", error);
    return { success: false, error: error.message };
  }
  return { success: true, workstream: data as DataIngestionWorkstream };
}

export async function updateDataIngestionWorkstream(
  slug: string,
  input: Partial<Omit<CreateWorkstreamInput, "slug">>
): Promise<{ success: boolean; error?: string; workstream?: DataIngestionWorkstream }> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.icon !== undefined) updateData.icon = input.icon || null;
  if (input.color !== undefined) updateData.color = input.color || null;
  if (input.table_name !== undefined) updateData.table_name = input.table_name || null;
  if (input.route_path !== undefined) updateData.route_path = input.route_path || null;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { data, error } = await supabase
    .from("data_ingestion_workstreams")
    .update(updateData)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    console.error("Error updating workstream:", error);
    return { success: false, error: error.message };
  }
  return { success: true, workstream: data as DataIngestionWorkstream };
}

export async function deleteDataIngestionWorkstream(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("data_ingestion_workstreams")
    .delete()
    .eq("slug", slug);

  if (error) {
    console.error("Error deleting workstream:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
