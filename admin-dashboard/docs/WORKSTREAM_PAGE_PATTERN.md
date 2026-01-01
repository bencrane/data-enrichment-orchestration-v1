# Workstream Page Pattern Documentation

This document describes the standardized pattern for implementing workstream pages in the admin dashboard. Use this as a reference when adding new workstreams or modifying existing ones.

## Overview

Each workstream (e.g., `apollo_scrape`, `customer_companies`, `salesnav_koolkit`, `crm_data`) follows the same page structure and uses consistent data fetching patterns. The key concept is **pipeline inheritance**: clients can either use a workstream's default pipeline or create custom client-specific overrides.

## Directory Structure

Each workstream has the following page structure under `/clients/[id]/`:

```
/clients/[id]/{workstream-name}/
├── page.tsx           # Main landing page with 4 navigation cards
├── upload/
│   └── page.tsx       # File upload interface
├── uploads/
│   └── page.tsx       # Past uploads list
├── pipelines/
│   └── page.tsx       # Pipeline management (create, edit, set active)
└── config/
    └── page.tsx       # Workflow configuration (webhook URLs, API keys)
```

## Critical Pattern: WORKSTREAM_SLUG Constant

Every workstream page MUST define a `WORKSTREAM_SLUG` constant at the top of the file. This slug must match the value in the `enrichment_workflows.workstream_slug` column in the database.

```tsx
const WORKSTREAM_SLUG = "customer_companies";  // or "apollo_scrape", etc.
```

**Known workstream slugs:**
- `apollo_scrape` - Apollo lead scraping and enrichment
- `customer_companies` - Customer company enrichment
- `salesnav_koolkit` - Sales Navigator data processing
- `crm_data` - CRM data enrichment

## Pipeline Inheritance Model

The system supports a two-tier pipeline hierarchy:

1. **Workstream Default Pipeline**: A pipeline with `client_id = NULL` that serves as the default for all clients using this workstream
2. **Client-Specific Pipeline**: A pipeline with a specific `client_id` that overrides the default for that client

### Determining the Active Pipeline

```tsx
// Fetch both client pipelines and workstream defaults
const [pipelinesData, workstreamPipelines] = await Promise.all([
  getClientPipelines(clientId),
  getWorkstreamPipelines(WORKSTREAM_SLUG),
]);

// Filter to only this workstream's client pipelines
const clientWorkstreamPipelines = pipelinesData.filter(
  (p) => p.workstream_slug === WORKSTREAM_SLUG
);

// Find active client pipeline and workstream default
const clientActivePipeline = clientWorkstreamPipelines.find((p) => p.is_active);
const workstreamDefaultPipeline = workstreamPipelines.find((p) => p.is_active);

// Effective pipeline = client override OR inherited default
const effectivePipeline = clientActivePipeline || workstreamDefaultPipeline;
const isUsingInheritedDefault = !clientActivePipeline && !!workstreamDefaultPipeline;
```

## Key Server Actions (from `/app/actions.ts`)

### Pipeline Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `getWorkstreamPipelines(workstreamSlug)` | Get all pipelines for a workstream (including defaults) | workstream slug |
| `getClientPipelines(clientId)` | Get all pipelines for a specific client | client ID |
| `getActivePipelineForClient(workstreamSlug, clientId)` | Get the effective active pipeline (respects inheritance) | workstream slug, client ID |
| `createClientPipelineForWorkstream(clientId, workstreamSlug, data)` | Create a client-specific pipeline | client ID, workstream slug, pipeline data |
| `setActivePipeline(pipelineId, workstreamSlug, clientId)` | Mark a pipeline as active | **all 3 params required** |
| `updatePipeline(pipelineId, updates)` | Update pipeline properties | pipeline ID, partial data |
| `deletePipeline(pipelineId)` | Delete a pipeline | pipeline ID |

### Workflow Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `getWorkflowsByWorkstream(workstreamSlug)` | Get all workflows for a workstream | workstream slug |
| `getClientWorkflowConfigs(clientId)` | Get client's workflow configurations | client ID |
| `saveClientWorkflowConfig(clientId, workflowSlug, config, workstreamSlug)` | Save webhook URL/API config | client ID, workflow slug, config object, workstream slug |

### CRITICAL: setActivePipeline Signature

The `setActivePipeline` function requires **three parameters**:

```tsx
// CORRECT:
await setActivePipeline(pipelineId, WORKSTREAM_SLUG, clientId);

// WRONG - will not work properly:
await setActivePipeline(pipelineId);
```

This is because it needs to deactivate all other pipelines for the same workstream/client combination before activating the selected one.

## Pipelines Page Pattern

### Required Imports

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getClientById,
  getWorkflowsByWorkstream,
  getClientPipelines,
  getWorkstreamPipelines,
  createClientPipelineForWorkstream,
  updatePipeline,
  deletePipeline,
  setActivePipeline,
  Client,
  EnrichmentWorkflow,
  EnrichmentPipeline,
} from "@/app/actions";
```

### Required State

```tsx
const [client, setClient] = useState<Client | null>(null);
const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
const [savedPipelines, setSavedPipelines] = useState<EnrichmentPipeline[]>([]);
const [workstreamDefaultPipeline, setWorkstreamDefaultPipeline] = useState<EnrichmentPipeline | null>(null);
const [loading, setLoading] = useState(true);
const [builderOpen, setBuilderOpen] = useState(false);

// Pipeline builder state
const [pipeline, setPipeline] = useState<string[]>([]);
const [pipelineName, setPipelineName] = useState("");
const [pipelineDescription, setPipelineDescription] = useState("");
const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
const [savingPipeline, setSavingPipeline] = useState(false);
const [pipelineError, setPipelineError] = useState<string | null>(null);
```

### Page Structure

1. **Active Pipeline Card** - Shows the effective pipeline with (default) or (custom) label
2. **Custom Pipelines Card** - Lists client-specific pipelines with Set Active/Edit/Delete actions
3. **Collapsible Pipeline Builder** - Form to create/edit pipelines

### Key Functions

```tsx
// Set a pipeline as active
async function handleSetActivePipeline(pipelineId: string) {
  const result = await setActivePipeline(pipelineId, WORKSTREAM_SLUG, clientId);
  if (result.success) {
    const newPipelines = await getClientPipelines(clientId);
    setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
  }
}

// Revert to inherited default
async function handleUseInheritedDefault() {
  for (const p of savedPipelines) {
    if (p.is_active) {
      await updatePipeline(p.id, { is_active: false });
    }
  }
  const newPipelines = await getClientPipelines(clientId);
  setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
}
```

## Config Page Pattern

### Required Imports

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getClientById,
  getWorkflowsByWorkstream,
  getClientWorkflowConfigs,
  saveClientWorkflowConfig,
  getActivePipelineForClient,
  Client,
  EnrichmentWorkflow,
  EnrichmentPipeline,
  ClientWorkflowConfig,
} from "@/app/actions";
```

### Required State

```tsx
const [client, setClient] = useState<Client | null>(null);
const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
const [activePipeline, setActivePipeline] = useState<EnrichmentPipeline | null>(null);
const [clientConfigs, setClientConfigs] = useState<ClientWorkflowConfig[]>([]);
const [loading, setLoading] = useState(true);
const [allWorkflowsOpen, setAllWorkflowsOpen] = useState(false);
```

### Page Structure

1. **Active Pipeline Workflows Card** - Shows workflows in the active pipeline with config status
2. **All Available Workflows (Collapsible)** - Shows all workflows for this workstream
3. **Config Edit Modal** - JSON editor for webhook URLs and API settings

### Workflow Card Styling (Clay-based)

Cards are styled based on whether Clay integration is required and configured:

```tsx
function renderWorkflowCard(workflow: EnrichmentWorkflow) {
  const config = getConfigForWorkflow(workflow.slug);
  const isConfigured = !!config && !!config.config?.webhook_url;
  const requiresClay = workflow.requires_clay;

  const getCardClasses = () => {
    if (!requiresClay) {
      // Clay not required - light grey
      return "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50";
    }
    if (requiresClay && !isConfigured) {
      // Clay required but not configured - faint red
      return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10";
    }
    // Clay required and configured - subtle green border
    return "border-green-200 dark:border-green-800 bg-white dark:bg-zinc-800";
  };
  // ... render card with getCardClasses()
}
```

### Pipeline Flow Visualization

The config page shows a visual representation of the pipeline steps with color-coded status:

```tsx
<div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-50 rounded-lg">
  {activePipeline.steps.map((slug, idx) => {
    const workflow = workflows.find((w) => w.slug === slug);
    const config = getConfigForWorkflow(slug);
    const requiresClay = workflow?.requires_clay ?? false;
    const isConfigured = !!config && !!config.config?.webhook_url;
    const needsConfig = requiresClay && !isConfigured;
    return (
      <span key={slug} className="flex items-center">
        <span className={`px-2 py-1 rounded text-xs font-mono ${
          needsConfig
            ? "bg-red-100 text-red-800"
            : "bg-zinc-200 text-zinc-700"
        }`}>
          {slug}
        </span>
        {idx < activePipeline.steps.length - 1 && (
          <span className="mx-2 text-zinc-400">→</span>
        )}
      </span>
    );
  })}
</div>
```

## Main Workstream Page Pattern

The main landing page (`/clients/[id]/{workstream}/page.tsx`) displays 4 navigation cards:

1. **Upload Files** - Link to `/upload`
2. **Past Uploads** - Link to `/uploads` with count
3. **Enrichment Pipelines** - Link to `/pipelines` with count
4. **Workflow Configuration** - Link to `/config` with count

## Common Gotchas

### 1. Wrong Pipeline Shown in Batch Launch Modal

**Problem**: The batch launch modal shows an old client-specific pipeline instead of the current active one.

**Cause**: Using `getClientPipelines(clientId)` which only fetches client-specific pipelines.

**Fix**: Use `getActivePipelineForClient(WORKSTREAM_SLUG, clientId)` which respects inheritance.

### 2. setActivePipeline Not Working

**Problem**: Calling `setActivePipeline(pipelineId)` doesn't properly activate the pipeline.

**Cause**: Missing required parameters.

**Fix**: Always pass all three parameters: `setActivePipeline(pipelineId, WORKSTREAM_SLUG, clientId)`

### 3. Pipelines Not Filtered by Workstream

**Problem**: Client pipelines from other workstreams appear in the list.

**Cause**: Not filtering by workstream slug.

**Fix**: Always filter client pipelines:
```tsx
const clientWorkstreamPipelines = pipelinesData.filter(
  (p) => p.workstream_slug === WORKSTREAM_SLUG
);
```

### 4. Green Border Too Neon

**Problem**: User feedback that green-300 border is too bright.

**Fix**: Use `border-green-200` instead of `border-green-300` for configured workflows.

### 5. Table Row onClick Not Working

**Problem**: Clicking on workstream rows in the data-ingestion table doesn't navigate.

**Cause**: `onClick` handlers on `TableRow` components may not reliably fire in all browsers.

**Fix**: Use `Link` wrappers inside each `TableCell` instead of `onClick` on `TableRow`:
```tsx
<TableRow key={workstream.slug} className="cursor-pointer hover:bg-zinc-50">
  <TableCell className="p-0">
    <Link href={`/clients/${clientId}/${routePath}`} className="block px-4 py-4">
      {workstream.name}
    </Link>
  </TableCell>
  {/* ... repeat for other cells */}
</TableRow>
```

### 6. Workstream Not Appearing in Data Ingestion Table

**Problem**: A workstream doesn't show up in the table even though pages exist.

**Cause**: The workstream isn't in the `data_ingestion_workstreams` table or `is_active` is false.

**Fix**: Insert the workstream into the database:
```sql
INSERT INTO data_ingestion_workstreams (slug, name, description, is_active)
VALUES ('workstream_slug', 'Display Name', 'Description', true);
```

## Adding a New Workstream

1. **Add database entry**: Insert into `data_ingestion_workstreams` table:
   ```sql
   INSERT INTO data_ingestion_workstreams (slug, name, description, is_active)
   VALUES ('new_workstream', 'New Workstream', 'Description here', true);
   ```

2. **Add route mapping** in `/clients/[id]/data-ingestion/page.tsx`:
   ```tsx
   const routeMap: Record<string, string> = {
     apollo_scrape: "apollo-ingest",
     customer_companies: "customer-companies",
     new_workstream: "new-workstream",  // Add this line
     // ...
   };
   ```

3. Create the directory structure under `/clients/[id]/{new-workstream}/`

4. Copy an existing workstream's pages (e.g., from `customer-companies`)

5. Update `WORKSTREAM_SLUG` constant in each page to match database slug

6. Update page titles, descriptions, and navigation links

7. Ensure workflows exist with matching `workstream_slug` in `enrichment_workflows` table

8. Test pipeline inheritance, config saving, and batch launching

## Reference Implementation

The `apollo-ingest` workstream (`/clients/[id]/apollo-ingest/`) is the reference implementation. When in doubt, compare your code against these files:

- `pipelines/page.tsx` - Full pipeline management with inheritance
- `config/page.tsx` - Workflow configuration with Clay-based styling

The `customer_companies` workstream was updated to match this pattern and can also serve as a reference.
