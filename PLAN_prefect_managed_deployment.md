# Plan: Deploy Orchestrator to Prefect Managed Work Pool

## Problem Summary
We need to deploy `orchestrator.py` to Prefect Managed infrastructure so:
- No local laptop worker required
- 24/7 availability
- Event-driven triggering via Edge Function

## What We've Completed
- [x] Created `managed-production` work pool (Prefect Managed type)
- [x] Created `postgres-connection-string` Secret Block
- [x] Updated `orchestrator.py` to use Prefect Secret Blocks

## What's Failing
The deployment command keeps erroring. Issues identified:
1. URL format - needs to end with `.git`
2. Dependencies - need to specify `pip_packages` in job_variables
3. Possible async/fsspec compatibility issues with Python 3.14

## Correct Deployment Pattern (from Prefect docs)

```python
from prefect import flow

flow.from_source(
    source="https://github.com/username/repo.git",  # Note: .git suffix
    entrypoint="path/to/file.py:flow_function",
).deploy(
    name="deployment-name",
    work_pool_name="managed-production",
    job_variables={
        "pip_packages": ["psycopg2-binary", "modal", "python-dotenv"]
    }
)
```

## The Plan

### Step 1: Verify Prerequisites
- Confirm `managed-production` work pool exists and is type `prefect:managed`
- Confirm `postgres-connection-string` Secret Block exists
- Confirm repo is public and accessible at https://github.com/bencrane/data-enrichment-orchestration-v1

### Step 2: Update orchestrator.py on GitHub
The current `orchestrator.py` on GitHub needs the Secret Block loading code.
- Check if the branch with our changes is merged to `main`
- If not, merge it

### Step 3: Deploy with Correct Syntax
Run this exact command:

```python
from prefect import flow

deployment_id = flow.from_source(
    source="https://github.com/bencrane/data-enrichment-orchestration-v1.git",
    entrypoint="src/orchestrator.py:orchestrator_main",
).deploy(
    name="data-enrichment-orchestrator",
    work_pool_name="managed-production",
    job_variables={
        "pip_packages": ["psycopg2-binary", "modal", "python-dotenv", "prefect"]
    },
    tags=["enrichment", "orchestrator", "production"],
    parameters={"batch_size": 50},
)
print(f"Deployment ID: {deployment_id}")
```

Key differences from previous attempts:
- `.git` suffix on source URL
- `job_variables` with `pip_packages` for runtime dependency installation
- No `GitRepository` import needed

### Step 4: Update Edge Function
After successful deployment:
1. Copy the new Deployment ID
2. Update Supabase Edge Function secret `PREFECT_DEPLOYMENT_ID`

### Step 5: Test End-to-End
1. Launch a batch from the UI
2. Verify Postgres trigger fires
3. Verify Edge Function calls Prefect API
4. Verify flow runs on Prefect Managed infrastructure
5. Verify items progress from PENDING → QUEUED → IN_PROGRESS

## Fallback Plan
If Prefect Managed continues to fail:
1. Use `default-agent-pool` with a local worker temporarily
2. Or deploy worker to Railway/Render for $5/month persistent hosting

## Sources
- [Prefect Deployments](https://docs.prefect.io/v3/concepts/deployments)
- [Managed Execution Guide](https://docs.prefect.io/latest/guides/managed-execution/)
- [Work Pools Tutorial](https://docs.prefect.io/latest/tutorial/work-pools/)
