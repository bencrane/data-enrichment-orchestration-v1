# Modal Cold Start Strategy

**Date:** 2026-01-10  
**Status:** PENDING DECISION  
**Decision Date:** 2026-01-11  
**Author:** AI Assistant

---

## Problem

HTTP endpoints served by Modal functions experience cold starts when no warm container exists. This results in 5-7 second latency for the first request after container idle timeout.

**Observed behavior:**
- Form submissions show "Submitting..." for extended periods
- Modal dashboard shows Startup: 3-5s, Execution: 1-8s for function calls
- Users experience inconsistent response times

**Root cause analysis:**

When a request arrives at a Modal ASGI endpoint:
1. If no warm container exists → cold start (3-5s)
   - Container provisioning
   - Image loading
   - Python environment initialization
2. DB connection establishment (~0.5s)
3. Query execution (~0.5-1s)
4. Response generation

The `spawn()` call for async processing is instant—it just enqueues work. The latency users experience is the **HTTP response time**, blocked by ASGI container cold start.

---

## Modal 1.0 Parameter Names

Note: Modal 1.0 renamed these parameters:
- `keep_warm` → `min_containers`
- `concurrency_limit` → `max_containers`
- `container_idle_timeout` → `scaledown_window`

---

## Options & Tradeoffs

### Option A: `min_containers=1` (Always Warm)

```python
@app.function(
    min_containers=1,  # Always keep one container warm
)
```

| Aspect | Value |
|--------|-------|
| Cold start frequency | Never |
| Response time | <1 sec always |
| Weekly cost (3 functions) | ~$49/week (~$210/month) |
| Best for | Customer-facing, latency-critical |

**Pros:**
- Instant response every time
- No user-perceived latency
- Reliable webhook receipt

**Cons:**
- Ongoing cost even when not in use
- Paying for idle time (nights, weekends)

---

### Option B: `scaledown_window=300` (Stay Warm 5 Min)

```python
@app.function(
    scaledown_window=300,  # Stay warm 5 min after last request
)
```

| Aspect | Value |
|--------|-------|
| Cold start frequency | Only after 5 min idle |
| Response time | <1 sec during active use, 5-7 sec after idle |
| Weekly cost (3 functions) | ~$0-10/week (usage-based) |
| Best for | Internal tooling, cost-conscious |

**Pros:**
- Near-zero cost when not in use
- Fast during active work sessions
- Good balance for sporadic usage

**Cons:**
- First request after 5 min idle = 5-7 sec wait
- Can feel slow if usage is infrequent

---

### Option C: `scaledown_window=600` (Stay Warm 10 Min)

Same as Option B but with longer warm window.

| Aspect | Value |
|--------|-------|
| Cold start frequency | Only after 10 min idle |
| Weekly cost | ~$0-15/week |

---

### Option D: Default (60 sec scaledown)

No configuration changes. Modal's default behavior.

| Aspect | Value |
|--------|-------|
| Cold start frequency | Frequent (after 60 sec idle) |
| Response time | Often 5-7 sec |
| Weekly cost | ~$0 |
| Best for | Non-critical background jobs |

**Not recommended** for user-facing endpoints.

---

## Functions Affected

| File | Function | Purpose | Latency Sensitivity |
|------|----------|---------|---------------------|
| `src/forms_api.py` | `api()` | Form submissions | Medium (internal user) |
| `src/deals_api.py` | `api()` | Frontend data | Medium (internal user) |
| `src/calcom_ingest.py` | `ingest()` | Webhook receipt | High (external system) |

**Spawned functions (NOT affected):**
- `process_proposal_generation` — runs async, user doesn't wait
- `process_meeting_outcome` — runs async, user doesn't wait
- `handle_booking_*` — runs async after webhook acknowledged

These can cold start without impacting user experience.

---

## Cost Breakdown

### min_containers=1 (per container, 24/7)

```
CPU:    $0.000024/sec × 86400 sec/day = $2.07/day
Memory: $0.000003/GB/sec × 0.256 GB × 86400 = $0.07/day
Total per container: ~$2.14/day

3 containers × $2.14/day × 7 days = ~$45/week
```

### scaledown_window=300 (usage-based)

Assume 2 hours of active use per day:
```
Warm time: 2 hours + buffer ≈ 3 hours/day
Cost: 3 containers × $0.27/hour × 3 hours × 7 days = ~$17/week
```

With lighter usage (30 min/day active):
```
~$5/week
```

---

## User Experience Comparison

| Scenario | min_containers=1 | scaledown_window=300 |
|----------|------------------|----------------------|
| First action of the day | <1 sec | 5-7 sec |
| During active session | <1 sec | <1 sec |
| After lunch break (30 min) | <1 sec | 5-7 sec |
| Cal.com webhook at 3 AM | <1 sec | 5-7 sec (Cal retries) |

---

## Recommendation

**For current stage (internal tooling, pre-launch):**

Use `scaledown_window=300` — acceptable UX, minimal cost.

**When to upgrade to `min_containers=1`:**
- Customer-facing proposal pages go live
- Webhook reliability becomes critical
- Cost is justified by business value

---

## Current Implementation Status

As of 2026-01-10, `min_containers=1` has been added to all three functions but NOT YET DEPLOYED.

**Files modified:**
- `src/deals_api.py` — min_containers=1 added
- `src/forms_api.py` — min_containers=1 added  
- `src/calcom_ingest.py` — min_containers=1 added

**Next step:** Decide on strategy and deploy, or revert to `scaledown_window` approach.

---

## Decision Needed (2026-01-11)

- [ ] Confirm strategy: `min_containers=1` OR `scaledown_window=300`
- [ ] Deploy chosen configuration
- [ ] Monitor costs in Modal dashboard

---

## References

- [Modal cold start documentation](https://modal.com/docs/guide/cold-start)
- [Modal 1.0 migration guide](https://modal.com/docs/guide/modal-1-0-migration)
- Related: `post_mortem_2026_01_10_wrong_modal_url.md`

