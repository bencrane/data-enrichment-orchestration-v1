"""
Prefect Deployment Script for Data Enrichment Orchestrator.

Deploys the orchestrator_main flow to Prefect Cloud with a cron schedule.
"""

import os
from dotenv import load_dotenv
from prefect import flow
from prefect.client.schemas.schedules import CronSchedule

# Load environment variables
load_dotenv()

# Import the flow
from orchestrator import orchestrator_main


def deploy():
    """Deploy the orchestrator flow to Prefect Cloud."""
    
    # Get required environment variables to pass to the worker
    env_vars = {
        "POSTGRES_CONNECTION_STRING": os.getenv("POSTGRES_CONNECTION_STRING", ""),
        "MODAL_TOKEN_ID": os.getenv("MODAL_TOKEN_ID", ""),
        "MODAL_TOKEN_SECRET": os.getenv("MODAL_TOKEN_SECRET", ""),
    }
    
    # Validate required env vars are present
    if not env_vars["POSTGRES_CONNECTION_STRING"]:
        raise ValueError("POSTGRES_CONNECTION_STRING must be set in .env")

    # Create deployment with cron schedule (every minute, UTC)
    # Set working directory to repo root so src/orchestrator.py is accessible
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_vars["PREFECT_WORKING_DIR"] = repo_root

    deployment = orchestrator_main.to_deployment(
        name="data-enrichment-orchestrator",
        schedule=CronSchedule(cron="* * * * *", timezone="UTC"),
        tags=["enrichment", "orchestrator", "production"],
        description="Polls for PENDING workflow_states and dispatches to Modal workers",
        parameters={"batch_size": 50},
        job_variables={
            "env": env_vars,
            "working_dir": repo_root,  # Run from repo root
        },
    )

    # Deploy
    deployment_id = deployment.apply()

    print("=" * 60)
    print("Deployment Complete!")
    print("=" * 60)
    print(f"Flow: orchestrator_main")
    print(f"Deployment: data-enrichment-orchestrator")
    print(f"Schedule: Every minute (UTC cron)")
    print(f"Deployment ID: {deployment_id}")
    print(f"Env vars passed: {list(env_vars.keys())}")
    print(f"Working dir: {repo_root}")
    print("=" * 60)

    return deployment_id


if __name__ == "__main__":
    deploy()
