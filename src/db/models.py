import enum
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import ForeignKey, String, DateTime, JSON, UniqueConstraint, Enum as SQLEnum, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class BatchStatus(enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class WorkflowStatus(enum.Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class EnrichmentType(enum.Enum):
    SYNC = "SYNC"
    ASYNC = "ASYNC"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    batches: Mapped[List["Batch"]] = relationship(
        "Batch", back_populates="client", cascade="all, delete-orphan"
    )
    pipelines: Mapped[List["EnrichmentPipeline"]] = relationship(
        "EnrichmentPipeline", back_populates="client", cascade="all, delete-orphan"
    )
    workflow_configs: Mapped[List["ClientWorkflowConfig"]] = relationship(
        "ClientWorkflowConfig", back_populates="client", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Client(id={self.id}, name={self.name})>"


class EnrichmentPipeline(Base):
    """Saved enrichment pipelines (blueprints) per client."""
    __tablename__ = "enrichment_pipelines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    client: Mapped["Client"] = relationship("Client", back_populates="pipelines")

    def __repr__(self) -> str:
        return f"<EnrichmentPipeline(id={self.id}, name={self.name}, client_id={self.client_id})>"


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    status: Mapped[BatchStatus] = mapped_column(
        SQLEnum(BatchStatus), default=BatchStatus.PENDING, nullable=False
    )
    blueprint: Mapped[dict] = mapped_column(JSON, nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    client: Mapped["Client"] = relationship("Client", back_populates="batches")
    items: Mapped[List["BatchItem"]] = relationship(
        "BatchItem", back_populates="batch", cascade="all, delete-orphan"
    )
    workflow_states: Mapped[List["WorkflowState"]] = relationship(
        "WorkflowState", back_populates="batch", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Batch(id={self.id}, status={self.status})>"


class BatchItem(Base):
    __tablename__ = "batch_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False
    )
    # Company columns
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_industry: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Person columns
    person_first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    person_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Original data storage
    original_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="items")
    workflow_states: Mapped[List["WorkflowState"]] = relationship(
        "WorkflowState", back_populates="item", cascade="all, delete-orphan"
    )
    enrichment_results: Mapped[List["EnrichmentResult"]] = relationship(
        "EnrichmentResult", back_populates="batch_item", cascade="all, delete-orphan"
    )
    work_history: Mapped[List["PersonWorkHistory"]] = relationship(
        "PersonWorkHistory", back_populates="batch_item", cascade="all, delete-orphan"
    )
    final_lead: Mapped["FinalLead | None"] = relationship(
        "FinalLead", back_populates="batch_item", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return f"<BatchItem(id={self.id}, company_domain={self.company_domain})>"


class WorkflowState(Base):
    __tablename__ = "workflow_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batch_items.id", ondelete="CASCADE"), nullable=False
    )
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[WorkflowStatus] = mapped_column(
        SQLEnum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Timestamp for when the next step was spawned (idempotency flag for sequencer)
    advanced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="workflow_states")
    item: Mapped["BatchItem"] = relationship("BatchItem", back_populates="workflow_states")

    __table_args__ = (
        UniqueConstraint("batch_id", "item_id", "step_name", name="uq_workflow_state"),
    )

    def __repr__(self) -> str:
        return f"<WorkflowState(batch_id={self.batch_id}, item_id={self.item_id}, step={self.step_name}, status={self.status})>"


class RawApolloData(Base):
    """Staging table for raw Apollo CSV uploads."""
    __tablename__ = "raw_apollo_data"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    upload_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Person data
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(512), nullable=True)
    email_status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Engagement & Location
    is_likely_to_engage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lead_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lead_state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lead_country: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Company basics
    company_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(512), nullable=True)
    employee_count: Mapped[str | None] = mapped_column(String(255), nullable=True)
    departments: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    subdepartments: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    functions: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Company links
    company_website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_website_short: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_blog_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_twitter_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_facebook_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_phone: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Company address
    company_street: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_postal_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_address: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Company financials
    company_annual_revenue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_market_cap: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_total_funding: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_latest_funding_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_latest_funding_amount: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_last_funding_date: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Company metadata (using TEXT for potentially long fields)
    company_keywords: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    company_technologies: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    company_short_description: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    company_seo_description: Mapped[str | None] = mapped_column(String(16384), nullable=True)
    number_of_retail_locations: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_founded_year: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<RawApolloData(id={self.id}, email={self.email}, company={self.company_name})>"


class EnrichmentRegistry(Base):
    """Registry of available enrichment workflows."""
    __tablename__ = "enrichment_registry"

    slug: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[EnrichmentType] = mapped_column(
        SQLEnum(EnrichmentType), nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Modal function references (explicit, no magic naming)
    modal_sender_fn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    modal_receiver_fn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    results: Mapped[List["EnrichmentResult"]] = relationship(
        "EnrichmentResult", back_populates="workflow"
    )
    client_configs: Mapped[List["ClientWorkflowConfig"]] = relationship(
        "ClientWorkflowConfig", back_populates="workflow"
    )

    def __repr__(self) -> str:
        return f"<EnrichmentRegistry(slug={self.slug}, name={self.name}, type={self.type})>"


class EnrichmentResult(Base):
    """Audit log of enrichment outputs per batch item."""
    __tablename__ = "enrichment_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batch_items.id", ondelete="CASCADE"), nullable=False
    )
    workflow_slug: Mapped[str] = mapped_column(
        String(255), ForeignKey("enrichment_registry.slug", ondelete="CASCADE"), nullable=False
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    batch_item: Mapped["BatchItem"] = relationship("BatchItem", back_populates="enrichment_results")
    workflow: Mapped["EnrichmentRegistry"] = relationship("EnrichmentRegistry", back_populates="results")

    __table_args__ = (
        Index("ix_enrichment_results_item_workflow", "batch_item_id", "workflow_slug"),
    )

    def __repr__(self) -> str:
        return f"<EnrichmentResult(id={self.id}, item={self.batch_item_id}, workflow={self.workflow_slug})>"


class ClientWorkflowConfig(Base):
    """Client-specific configuration for workflow steps (e.g., Clay Table URLs, API keys)."""
    __tablename__ = "client_workflow_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    workflow_slug: Mapped[str] = mapped_column(
        String(255), ForeignKey("enrichment_registry.slug", ondelete="CASCADE"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    client: Mapped["Client"] = relationship("Client", back_populates="workflow_configs")
    workflow: Mapped["EnrichmentRegistry"] = relationship("EnrichmentRegistry", back_populates="client_configs")

    __table_args__ = (
        UniqueConstraint("client_id", "workflow_slug", name="uq_client_workflow_config"),
    )

    def __repr__(self) -> str:
        return f"<ClientWorkflowConfig(client_id={self.client_id}, workflow={self.workflow_slug})>"


# =============================================================================
# Phase 5: Extraction / Consolidation Tables
# =============================================================================

class PersonWorkHistory(Base):
    """
    Extracted work history from enrichment results.
    Tracks where a person has worked (for GTM: "Find people who worked at Customer X").
    """
    __tablename__ = "person_work_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batch_items.id", ondelete="CASCADE"), nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    company_domain: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    start_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_current: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    batch_item: Mapped["BatchItem"] = relationship("BatchItem", back_populates="work_history")

    __table_args__ = (
        Index("ix_person_work_history_company", "company_name"),
        Index("ix_person_work_history_batch_item", "batch_item_id"),
    )

    def __repr__(self) -> str:
        return f"<PersonWorkHistory(id={self.id}, company={self.company_name}, title={self.title})>"


class FinalLead(Base):
    """
    The "Gold" consolidated lead record.
    Projects normalized/enriched data from multiple workflow steps into a single clean record.
    """
    __tablename__ = "final_leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batch_items.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # Person fields
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    email: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Company fields (normalized)
    normalized_company_name: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    normalized_company_domain: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    company_linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Enrichment metadata
    enrichment_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enrichment_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    batch_item: Mapped["BatchItem"] = relationship("BatchItem", back_populates="final_lead")

    def __repr__(self) -> str:
        return f"<FinalLead(id={self.id}, email={self.email}, company={self.normalized_company_name})>"
