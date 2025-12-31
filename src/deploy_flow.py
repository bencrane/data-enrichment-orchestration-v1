"""
Prefect Deployment Script for Data Enrichment Orchestrator.

Deploys the process_pending_items flow to Prefect Cloud with an interval schedule.
"""

from prefect import flow
from prefect.client.schemas.schedules import IntervalSchedule
from datetime import timedelta

# Import the flow
from orchestrator import process_pending_items


def deploy():
    """Deploy the orchestrator flow to Prefect Cloud."""

    # Create deployment with interval schedule (every 60 seconds)
    deployment = process_pending_items.to_deployment(
        name="data-enrichment-orchestrator",
        interval=60,  # Run every 60 seconds
        tags=["enrichment", "orchestrator", "production"],
        description="Polls for PENDING workflow_states and dispatches to Modal workers",
        parameters={"batch_size": 50},
    )

    # Deploy
    deployment_id = deployment.apply()

    print("=" * 60)
    print("Deployment Complete!")
    print("=" * 60)
    print(f"Flow: process_pending_items")
    print(f"Deployment: data-enrichment-orchestrator")
    print(f"Schedule: Every 60 seconds")
    print(f"Deployment ID: {deployment_id}")
    print("=" * 60)

    return deployment_id


if __name__ == "__main__":
    deploy()
