# Architecture Comprehension Summary

## My Comprehension of the "Tracer Bullet" Architecture

The Tracer Bullet approach means we build a **complete vertical slice** through all system layers before adding any real business logic. We're constructing a skeleton that can:

1. Store state (DB) → 2. React to state changes (Prefect) → 3. Execute work (Modal) → 4. Write results back (DB)

...with stub/sleep implementations. This proves the plumbing works before we fill the pipes with real data.

The three pillars:
- **Brain (Postgres)**: The single source of truth. All decisions flow FROM database state, not from in-memory orchestrator state.
- **Conductor (Prefect)**: Purely reactive. It wakes on events, reads `workflow_states`, looks up the `enrichment_registry`, and dispatches. It is **data-agnostic** — it handles `company_id` and `status`, never actual enrichment payloads.
- **Workers (Modal)**: Stateless and ephemeral. They receive a `company_id`, fetch their own input, do the work, write results to domain tables, update `workflow_states` to `COMPLETED`, and terminate.

---

## How the State Machine Enforces Prefect/Modal Decoupling

The decoupling is **structural**, not just conventional:

1. **The `workflow_states` table is the contract.** Both Prefect and Modal operate against this table independently:
   - Prefect reads: "What rows are `PENDING`?" → dispatches work → writes `QUEUED`/`IN_PROGRESS`
   - Modal reads nothing from Prefect. It receives only a `company_id`. When done, it writes `COMPLETED` directly to the DB.

2. **Neither component knows the other exists.**
   - Prefect doesn't wait for Modal to finish. It dispatches via `.spawn()` and exits.
   - Modal doesn't report back to Prefect. It updates the DB, which fires a trigger.
   - The DB trigger wakes Prefect again—a new, fresh Prefect run with zero memory of the prior dispatch.

3. **The Blueprint lives in the DB, not in code.** The `batches.blueprint` JSON array (`["step_A", "step_B"]`) defines workflow order. Prefect reads this to determine "what's next" rather than hardcoding step sequences. This means:
   - Swapping orchestrators requires only implementing the same "read state → dispatch → exit" pattern.
   - Swapping workers requires only implementing the same "receive ID → do work → update state" pattern.

**Consequence**: You could replace Prefect with Temporal, Airflow, or a cron job polling the DB — and Modal workers would never know. The interface is the database schema.

---

## MCP Usage Rules - Confirmed Understanding

| Tier | Tool | Purpose | Hard Rule |
|------|------|---------|-----------|
| Tier 1 | `modal-mcp-server` | All compute execution | If it runs Python (not orchestration), it goes on Modal |
| Tier 1 | `prefect` | Orchestration control plane | Never touches business data—only IDs and statuses |
| Tier 2 | `exa` | External validation | Do not hallucinate external facts—verify with Exa |
| Tier 2 | `context7` | Documentation lookup | Do not trust training data for library syntax—check Context7 |
| Tier 3 | `sentry` | Production debugging only | Not for development |

---

## Questions / Potential Blockers for Phase 1

1. **`batch_companies` link table**: The schema (Section 3.1) mentions it but the Phase 1 checklist only explicitly names `batches`, `companies`, `workflow_states`. Should I include `batch_companies` in Phase 1 models, or is this implicit?

2. **`enrichment_registry` timing**: The architecture defines this table in Section 3.3, but the checklist puts it in Phase 2. I will **not** create it in Phase 1 unless instructed. Confirm this is correct?

3. **DB Trigger Mechanism**: The flow mentions "DB event fires → Wakes Prefect." Is this implemented via:
   - Supabase Database Webhooks?
   - Postgres `LISTEN/NOTIFY`?
   - Polling with Prefect schedules?

   This doesn't block Phase 1 (pure schema work), but I want to know the intended mechanism before Phase 3.

4. **Database Connection**: I see `.env` exists but is untracked. I assume it contains `DATABASE_URL` for Supabase. Should I verify connectivity as the first step of Phase 1?

---

**Status**: Ready to receive Phase 1 (Database Foundation) instructions.
