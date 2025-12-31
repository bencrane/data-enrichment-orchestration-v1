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
  items: BatchItem[]
): Promise<{ success: boolean; error?: string; batchId?: string }> {
  // 1. Create the batch
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .insert({
      client_id: clientId,
      blueprint: blueprint,
      status: "PENDING",
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
  blueprint: string[]
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
  created_at: string;
};

export type CreateWorkflowInput = {
  slug: string;
  name: string;
  type: "SYNC" | "ASYNC";
  description?: string;
  modal_sender_fn?: string;
  modal_receiver_fn?: string;
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
  const { data, error } = await supabase
    .from("enrichment_registry")
    .update({
      name: input.name,
      type: input.type,
      description: input.description ?? null,
      modal_sender_fn: input.modal_sender_fn ?? null,
      modal_receiver_fn: input.modal_receiver_fn ?? null,
    })
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
  client_id: string;
  name: string;
  description: string | null;
  steps: string[];
  created_at: string;
};

export type CreatePipelineInput = {
  name: string;
  description?: string;
  steps: string[];
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
  blueprint: string[]
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
