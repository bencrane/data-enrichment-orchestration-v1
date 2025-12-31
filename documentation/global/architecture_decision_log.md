# Architecture Decision Log & Open Questions

**Last Updated:** 2025-12-31

This document tracks key architectural decisions, the context behind them, and open questions that require future resolution. It serves to reduce ambiguity by explicitly stating what has been decided and what remains open.

## ✅ Decision 001: Client-Level Workflow Configuration (Phase 3.7)

*   **Context**: We need to inject client-specific variables (specifically Clay Webhook URLs) into generic Modal workers (e.g., `enrich_company_via_waterfall_in_clay`).
*   **The Conflict**: Should configuration be tied to the **Batch** (Upload), the **Client** (Account), or the **Pipeline** (Sequence)?
*   **The Decision**: Configuration will be tied to the **Client**.
    *   **Implementation**: A table `client_workflow_configs` keyed by `(client_id, workflow_slug)`.
    *   **Logic**: "For SecurityPal, the `enrich_company` step *always* uses URL X."
*   **Rationale**: 
    1.  **Commercial Reality**: Work is client-driven. Data belongs to a client and flows into their specific resources.
    2.  **Simplicity**: This "Tracer Bullet" covers the primary use case (one main enrichment destination per client) without over-engineering batch overrides.

---

## 🚧 Open Challenge: Multi-Type Ingestion Routing

*   **Context**: A single Client might have distinct ingestion processes (e.g., "Sales List" vs. "Recruiting List") that require routing to *different* Clay Tables (and thus different Webhook URLs).
*   **Current Limitation**: The current `client_workflow_configs` model allows only **one** URL per workflow slug per client.
*   **User Constraint**: We explicitly *do not* want to mix data types in the same Clay table (max 50k row limits, debugging complexity).
*   **Future Solution Options**:
    1.  **Registry Forking (Likely)**: Create distinct Registry entries for different business intents (e.g., `enrich_company_sales`, `enrich_company_recruit`). Each has its own config entry.
    2.  **Batch-Level Overrides**: Add a UI selector at batch launch to override the default client config.
*   **Status**: **Deferred**. We will build the Client-Level model first. If/when a client needs dual pipelines, we will refactor or add Registry entries.

---

## ❓ Open Questions (To Be Clarified)

1.  **File Type Definition**: 
    *   We verify Apollo uploads via `HEADER_MAP`.
    *   *Question*: How will we formally define/validate *other* file types (e.g., "Customer List", "Clay Export")?
    *   *Draft Idea*: A `file_type` Enum on `raw_apollo_uploads` (renamed to `raw_uploads`)?

2.  **Pipeline-to-File Association**:
    *   *Observation*: "The contents of a file type dictate to some degree the type of pipeline... that can be run."
    *   *Question*: Should the UI strictly filter available Pipelines based on the uploaded file type? (e.g., If I upload "Companies", don't show me "Person Enrichment" pipelines).

---
