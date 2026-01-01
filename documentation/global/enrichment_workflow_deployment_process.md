# Enrichment Workflow Deployment Process

## Overview

This document outlines the step-by-step process to deploy Modal functions after creating a new enrichment workflow in the UI.

---

## Prerequisites

Before starting, ensure you have:
- [ ] Completed the enrichment workflow creation in the UI
- [ ] Set the `webhook_url` in `client_workflow_configs` for the relevant client
- [ ] Confirmed the `enrichment_registry` entry exists with correct function names

---

## Step 1: Verify Registry Entry

Query the `enrichment_registry` to confirm your workflow was created correctly:

```sql
SELECT slug, name, type, modal_sender_fn, modal_receiver_fn 
FROM enrichment_registry 
WHERE slug = 'your_workflow_slug';
```

**Expected Result:**
| Field | Example Value |
|-------|---------------|
| `slug` | `normalize_all_core_values` |
| `name` | `Normalize All Core Values` |
| `type` | `ASYNC` |
| `modal_sender_fn` | `start_normalize_all_core_values` |
| `modal_receiver_fn` | `receive_normalize_all_core_values` |

**Important:** The `modal_sender_fn` and `modal_receiver_fn` names in the registry MUST match the function names you create in `worker.py`.

---

## Step 2: Add Modal Functions to worker.py

Open `src/worker.py` and add the sender and receiver functions following this template:

### ASYNC Sender Function Template

```python
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
    concurrency_limit=5,
)
def start_YOUR_WORKFLOW_SLUG(item_id: str):
    """
    Async Sender: Initiates YOUR_WORKFLOW_NAME via Clay.

    This function:
    1. Fetches client-specific config (webhook_url)
    2. Fetches batch_item data for the payload
    3. POSTs to Clay webhook with all data
    4. Sets state to IN_PROGRESS
    """
    import requests

    step_name = "YOUR_WORKFLOW_SLUG"  # Must match enrichment_registry.slug
    print(f"[ASYNC SENDER] start_YOUR_WORKFLOW_SLUG called for item={item_id[:8]}...")

    # Fetch client-specific configuration
    config = _get_client_config(item_id, step_name)
    webhook_url = config.get("webhook_url") if config else None

    if not webhook_url:
        print(f"[ASYNC SENDER] ERROR: No webhook_url configured for this client/workflow")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "No webhook_url configured",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "No webhook_url configured"}

    print(f"[ASYNC SENDER] Using webhook_url: {webhook_url}")

    # Fetch batch_item data for the payload
    item_data = _get_batch_item_data(item_id)
    if not item_data:
        print(f"[ASYNC SENDER] ERROR: BatchItem {item_id} not found")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": "BatchItem not found",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": "BatchItem not found"}

    # Send all batch_item fields to Clay
    payload = item_data

    print(f"[ASYNC SENDER] Sending to Clay ({step_name}): {payload}")

    # POST to Clay webhook
    try:
        response = requests.post(webhook_url, json=payload, timeout=30)
        response.raise_for_status()
        print(f"[ASYNC SENDER] Clay webhook response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[ASYNC SENDER] ERROR: Clay webhook failed: {e}")
        _update_state(item_id, step_name, "FAILED", meta={
            "error": str(e),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": False, "item_id": item_id, "error": str(e)}

    # Set state to IN_PROGRESS
    _update_state(item_id, step_name, "IN_PROGRESS", meta={
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "service": "clay",
        "webhook_url": webhook_url,
        "payload": payload,
    })

    return {"success": True, "item_id": item_id, "status": "IN_PROGRESS", "webhook_url": webhook_url}
```

### ASYNC Receiver Function Template

```python
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-secrets")],
)
def receive_YOUR_WORKFLOW_SLUG(item_id: str, payload: dict):
    """
    Async Receiver: Receives data from external service.

    This function:
    1. Accepts the payload from external service
    2. Records the enrichment result
    3. Sets state to COMPLETED
    """
    step_name = "YOUR_WORKFLOW_SLUG"  # Must match enrichment_registry.slug
    print(f"[ASYNC RECEIVER] receive_YOUR_WORKFLOW_SLUG called for item={item_id[:8]}...")

    # Record the result
    _record_result(item_id, step_name, {
        "action": "YOUR_WORKFLOW_SLUG",
        "status": "success",
        "received_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    })

    # Set state to COMPLETED
    _update_state(item_id, step_name, "COMPLETED", meta={
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "item_id": item_id, "status": "COMPLETED"}
```

---

## Step 3: Update Local Entrypoint (Optional)

Add your new functions to the `main()` local entrypoint for documentation:

```python
print("  - start_YOUR_WORKFLOW_SLUG (ASYNC SENDER)")
print("  - receive_YOUR_WORKFLOW_SLUG (ASYNC RECEIVER)")
```

---

## Step 4: Deploy to Modal

Run the deployment command:

```bash
cd /Users/benjamincrane/data-enrichment-orchestration-v1
source venv/bin/activate
modal deploy src/worker.py
```

**Expected Output:**
```
✓ Created objects.
├── 🔨 Created function start_YOUR_WORKFLOW_SLUG.
├── 🔨 Created function receive_YOUR_WORKFLOW_SLUG.
✓ App deployed! 🎉
```

---

## Step 5: Verify Deployment

Confirm the functions are available:

```bash
modal app list
```

Or verify programmatically:

```python
import modal
fn = modal.Function.from_name('data-enrichment-workers', 'start_YOUR_WORKFLOW_SLUG')
print(f'Function found: {fn}')
```

---

## Step 6: Configure Client Webhook

Ensure `client_workflow_configs` has the webhook URL for the client:

```sql
INSERT INTO client_workflow_configs (id, client_id, workflow_slug, config, created_at)
VALUES (
    gen_random_uuid(),
    'YOUR_CLIENT_ID',
    'YOUR_WORKFLOW_SLUG',
    '{"webhook_url": "https://api.clay.com/v1/webhooks/YOUR_WEBHOOK_ID"}',
    NOW()
);
```

---

## Naming Convention Reference

| Registry Field | Function Name Pattern | Example |
|----------------|----------------------|---------|
| `slug` | `snake_case` | `normalize_all_core_values` |
| `modal_sender_fn` | `start_` + slug | `start_normalize_all_core_values` |
| `modal_receiver_fn` | `receive_` + slug | `receive_normalize_all_core_values` |

---

## Checklist

Before testing, confirm:

- [ ] `enrichment_registry` entry exists with correct `slug`, `modal_sender_fn`, `modal_receiver_fn`
- [ ] Modal functions added to `src/worker.py` with matching names
- [ ] `step_name` variable in functions matches the `slug`
- [ ] Modal app deployed successfully
- [ ] `client_workflow_configs` has `webhook_url` for the client/workflow combination
- [ ] Clay table configured with callback webhook to your receiver endpoint

---

## Troubleshooting

### "No webhook_url configured"
- Check `client_workflow_configs` has an entry for the `client_id` + `workflow_slug` combination
- Verify the `config` JSON contains `{"webhook_url": "..."}`

### Function not found in Modal
- Run `modal deploy src/worker.py` again
- Check function name matches exactly (case-sensitive)

### Items stuck at QUEUED
- Verify Modal credentials are set in Prefect deployment's `job_variables.env`
- Check Modal logs: `modal app logs data-enrichment-workers`

### Items stuck at IN_PROGRESS
- Clay webhook not calling back - check Clay table configuration
- Verify receiver endpoint is accessible and deployed

