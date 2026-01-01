"""
Prefect Deployment Script for Data Enrichment Orchestrator.

Deploys the orchestrator_main flow to Prefect Managed infrastructure.
This eliminates the need for a local worker - Prefect Cloud runs the flow.
"""

from prefect import flow


def deploy():
    """
    Deploy the orchestrator flow to Prefect Managed infrastructure.

    This deployment:
    - Uses Prefect Managed work pool (serverless, 24/7)
    - Pulls code from GitHub on each run
    - Uses Prefect Secret Blocks for credentials (not env vars)

    Prerequisites:
    1. Create work pool "managed-production" in Prefect Cloud (type: Prefect Managed)
    2. Create Secret Block: postgres-connection-string
    """

    # Deploy from GitHub source
    deployment_id = flow.from_source(
        source="https://github.com/bencrane/data-enrichment-orchestration-v1",
        entrypoint="src/orchestrator.py:orchestrator_main",
    ).deploy(
        name="data-enrichment-orchestrator",
        work_pool_name="managed-production",
        tags=["enrichment", "orchestrator", "production"],
        description="Event-driven orchestrator: polls for PENDING workflow_states and dispatches to Modal workers. Triggered by database INSERT on batches table.",
        parameters={"batch_size": 50},
        # No schedule - triggered by Edge Function via Prefect API
    )

    print("=" * 60)
    print("Deployment Complete!")
    print("=" * 60)
    print(f"Flow: orchestrator_main")
    print(f"Deployment: data-enrichment-orchestrator")
    print(f"Work Pool: managed-production (Prefect Managed)")
    print(f"Schedule: None (event-triggered via Edge Function)")
    print(f"Deployment ID: {deployment_id}")
    print("=" * 60)
    print("")
    print("IMPORTANT: Update your Edge Function with this deployment ID!")
    print(f"  PREFECT_DEPLOYMENT_ID = {deployment_id}")
    print("")
    print("=" * 60)

    return deployment_id


if __name__ == "__main__":
    deploy()
