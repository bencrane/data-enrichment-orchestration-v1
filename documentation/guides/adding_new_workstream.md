# Adding a New Workstream to the Admin Dashboard

This guide documents the process for adding a new workstream (like "Customer Companies" or "Apollo Scrape Ingest") to the admin dashboard.

## Overview

A workstream is a distinct data pipeline that allows users to:
1. Upload CSV data specific to that workstream
2. View past uploads
3. Configure enrichment pipelines
4. Set workflow configurations (webhook URLs, API keys, etc.)

## Prerequisites

- Access to Supabase database
- Understanding of the existing codebase structure
- The new workstream should have a clear data schema

---

## Step 1: Create the Database Table

Create a table to store the uploaded data for the workstream.

### SQL Template

```sql
CREATE TABLE client_{workstream_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL,
    -- Add workstream-specific columns here
    {column_name} TEXT NOT NULL,           -- Required fields
    {optional_column} TEXT,                 -- Optional fields (nullable)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common query patterns
CREATE INDEX idx_client_{workstream_name}_client_id ON client_{workstream_name}(client_id);
CREATE INDEX idx_client_{workstream_name}_upload_id ON client_{workstream_name}(upload_id);
CREATE INDEX idx_client_{workstream_name}_client_upload ON client_{workstream_name}(client_id, upload_id);
```

### Example: Customer Companies

```sql
CREATE TABLE client_customer_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL,
    company_name TEXT NOT NULL,
    domain TEXT,
    company_linkedin_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_customer_companies_client_id ON client_customer_companies(client_id);
CREATE INDEX idx_client_customer_companies_upload_id ON client_customer_companies(upload_id);
CREATE INDEX idx_client_customer_companies_client_upload ON client_customer_companies(client_id, upload_id);
```

---

## Step 2: Add Server Actions to `actions.ts`

Location: `admin-dashboard/src/app/actions.ts`

### 2.1 Define Types

```typescript
// ============ {Workstream Name} Actions ============

export type {WorkstreamName}Row = {
  {required_field}: string;
  {optional_field}?: string;
  [key: string]: string | undefined;  // Allow flexible CSV columns
};

export type {WorkstreamName}Upload = {
  id: string;
  upload_id: string;
  uploaded_at: string;
  row_count: number;
};
```

### 2.2 Add Get Uploads Function

```typescript
export async function get{WorkstreamName}Uploads(clientId: string): Promise<{WorkstreamName}Upload[]> {
  const { data, error } = await supabase
    .from("client_{workstream_table}")
    .select("upload_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching {workstream} uploads:", error);
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
```

### 2.3 Add Upload Function

```typescript
export async function upload{WorkstreamName}(
  clientId: string,
  uploadId: string,
  rows: {WorkstreamName}Row[]
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const records = rows.map((row) => ({
    client_id: clientId,
    upload_id: uploadId,
    {required_field}: row.{required_field},
    {optional_field}: row.{optional_field} || null,
  }));

  // Insert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("client_{workstream_table}").insert(batch);

    if (error) {
      console.error("Error inserting {workstream} data:", error);
      return { success: false, error: error.message };
    }
    inserted += batch.length;
  }

  return { success: true, rowCount: inserted };
}
```

---

## Step 3: Create the Workstream Pages

Create a new directory structure under `admin-dashboard/src/app/clients/[id]/{workstream-slug}/`

### Directory Structure

```
admin-dashboard/src/app/clients/[id]/{workstream-slug}/
├── page.tsx              # Main page with 4 action cards
├── upload/
│   └── page.tsx          # CSV upload page
├── uploads/
│   └── page.tsx          # Past uploads listing
├── pipelines/
│   └── page.tsx          # Enrichment pipeline builder
└── config/
    └── page.tsx          # Workflow configuration
```

### 3.1 Main Page (`page.tsx`)

This page displays 4 action cards linking to sub-pages.

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getClientById, Client } from "@/app/actions";

export default function {WorkstreamName}Page() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const clientData = await getClientById(clientId);
      setClient(clientData);
      setLoading(false);
    }
    fetchData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-red-500">Client not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/clients/${clientId}`}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {/* Back arrow SVG */}
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {Workstream Display Name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upload Files Card */}
          <Link href={`/clients/${clientId}/{workstream-slug}/upload`}>
            <Card className="cursor-pointer hover:border-zinc-400 transition-colors h-full">
              {/* Card content */}
            </Card>
          </Link>

          {/* Past Uploads Card */}
          <Link href={`/clients/${clientId}/{workstream-slug}/uploads`}>
            <Card className="cursor-pointer hover:border-zinc-400 transition-colors h-full">
              {/* Card content */}
            </Card>
          </Link>

          {/* Enrichment Pipelines Card */}
          <Link href={`/clients/${clientId}/{workstream-slug}/pipelines`}>
            <Card className="cursor-pointer hover:border-zinc-400 transition-colors h-full">
              {/* Card content */}
            </Card>
          </Link>

          {/* Workflow Configuration Card */}
          <Link href={`/clients/${clientId}/{workstream-slug}/config`}>
            <Card className="cursor-pointer hover:border-zinc-400 transition-colors h-full">
              {/* Card content */}
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
```

### 3.2 Upload Page (`upload/page.tsx`)

Key components:
- CSV header mapping (flexible column name matching)
- Drag-and-drop file upload
- Preview table before upload
- Upload button with loading state

```typescript
// CSV header to snake_case mapping
const HEADER_MAP: Record<string, keyof {WorkstreamName}Row> = {
  "{column name variant 1}": "{db_column}",
  "{column_name_variant_2}": "{db_column}",
  // Add all acceptable header variations
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function mapCsvRow(row: Record<string, string>): {WorkstreamName}Row {
  const mapped: {WorkstreamName}Row = { {required_field}: "" };
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = HEADER_MAP[normalizedKey];
    if (mappedKey && value) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}
```

### 3.3 Past Uploads Page (`uploads/page.tsx`)

Fetches and displays upload history with row counts.

### 3.4 Pipelines Page (`pipelines/page.tsx`)

Copy from existing Apollo or Customer Companies pipelines page. The workstream parameter ensures pipelines are isolated.

### 3.5 Config Page (`config/page.tsx`)

Copy from existing config page. The workstream parameter ensures configs are isolated.

---

## Step 4: Add Workstream Card to Client Dashboard

Location: `admin-dashboard/src/app/clients/[id]/page.tsx`

Add a new Link-wrapped Card in the grid:

```typescript
{/* {Workstream Display Name} */}
<Link href={`/clients/${clientId}/{workstream-slug}`}>
  <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
    <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
      <div className="w-12 h-12 rounded-full bg-{color}-50 dark:bg-{color}-900/20 flex items-center justify-center mb-3">
        {/* Icon SVG */}
      </div>
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
        {Workstream Display Name}
      </h3>
      <p className="text-sm text-zinc-500 mt-1">
        Upload, enrich, and configure
      </p>
    </div>
  </Card>
</Link>
```

---

## Step 5: Export Types and Functions

Ensure all new types and functions are exported from `actions.ts`:

```typescript
export type { {WorkstreamName}Row, {WorkstreamName}Upload };
export { get{WorkstreamName}Uploads, upload{WorkstreamName} };
```

---

## Checklist

- [ ] Database table created with proper indexes
- [ ] Types defined in `actions.ts`
- [ ] `get{WorkstreamName}Uploads` function added
- [ ] `upload{WorkstreamName}` function added
- [ ] Main workstream page created with 4 cards
- [ ] Upload page with CSV parsing and header mapping
- [ ] Past uploads page
- [ ] Pipelines page (can copy from existing)
- [ ] Config page (can copy from existing)
- [ ] Client dashboard card added and clickable
- [ ] All imports/exports verified
- [ ] Test upload functionality end-to-end

---

## File Reference

| File | Purpose |
|------|---------|
| `admin-dashboard/src/app/actions.ts` | Server actions and types |
| `admin-dashboard/src/app/clients/[id]/page.tsx` | Client dashboard with workstream cards |
| `admin-dashboard/src/app/clients/[id]/{workstream}/page.tsx` | Main workstream page |
| `admin-dashboard/src/app/clients/[id]/{workstream}/upload/page.tsx` | CSV upload |
| `admin-dashboard/src/app/clients/[id]/{workstream}/uploads/page.tsx` | Upload history |
| `admin-dashboard/src/app/clients/[id]/{workstream}/pipelines/page.tsx` | Pipeline builder |
| `admin-dashboard/src/app/clients/[id]/{workstream}/config/page.tsx` | Workflow config |

---

## Example: Customer Companies Implementation

- **Database table**: `client_customer_companies`
- **Workstream slug**: `customer-companies`
- **Types**: `CustomerCompanyRow`, `CustomerCompanyUpload`
- **Functions**: `getCustomerCompanyUploads`, `uploadCustomerCompanies`
- **Required field**: `company_name`
- **Optional fields**: `domain`, `company_linkedin_url`
- **Card color**: Emerald (`bg-emerald-50`)
