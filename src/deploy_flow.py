"""
Prefect Deployment Script for Data Enrichment Orchestrator.

Deploys the orchestrator_main flow to Prefect Managed infrastructure.
This eliminates the need for a local worker - Prefect Cloud runs the flow.
"""

from prefect import flow
from prefect.deployments import Deployment

# Import the flow
from orchestrator import orchestrator_main


def deploy():
    """
    Deploy the orchestrator flow to Prefect Managed infrastructure.

    This deployment:
    - Uses Prefect Managed work pool (serverless, 24/7)
    - Pulls code from GitHub on each run
    - Installs dependencies from requirements.txt
    - Uses Prefect Secret Blocks for credentials (not env vars)

    Prerequisites:
    1. Create work pool "managed-production" in Prefect Cloud (type: Prefect Managed)
    2. Create Secret Blocks in Prefect Cloud:
       - postgres-connection-string
       - modal-token-id (if needed)
       - modal-token-secret (if needed)
    """

    deployment = orchestrator_main.to_deployment(
        name="data-enrichment-orchestrator",
        work_pool_name="managed-production",
        tags=["enrichment", "orchestrator", "production"],
        description="Event-driven orchestrator: polls for PENDING workflow_states and dispatches to Modal workers. Triggered by database INSERT on batches table.",
        parameters={"batch_size": 50},
        # No schedule - triggered by Edge Function via Prefect API
        # Pull code from GitHub when running
        pull=[
            {
                "prefect.deployments.steps.git_clone": {
                    "repository": "https://github.com/bencrane/data-enrichment-orchestration-v1",
                    "branch": "main",
                }
            },
            {
                "prefect.deployments.steps.pip_install_requirements": {
                    "requirements_file": "requirements.txt",
                }
            }
        ],
        entrypoint="src/orchestrator.py:orchestrator_main",
    )

    # Deploy
    deployment_id = deployment.apply()

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
