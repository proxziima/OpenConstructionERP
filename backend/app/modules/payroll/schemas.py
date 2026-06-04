# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Payroll Pydantic schemas - request/response models.

Money is exposed as strings (Decimal-as-string) end to end so the JSON
never loses cents to binary-float rounding. The frontend parses them with
``Number(...)`` only for display.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PayrollBatchGenerate(BaseModel):
    """Request body for generating a draft batch from field labour."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    # Optional ISO YYYY-MM-DD bounds. When omitted, all unbatched labour for
    # the project is aggregated. ``date_to`` is inclusive.
    date_from: str | None = Field(default=None, max_length=20)
    date_to: str | None = Field(default=None, max_length=20)
    period_label: str | None = Field(default=None, max_length=120)
    notes: str = Field(default="", max_length=2000)


class PayrollEntryResponse(BaseModel):
    """A single payroll line returned from the API."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    batch_id: UUID
    resource_id: UUID | None
    worker: str
    work_date: str | None
    hours: str
    rate: str
    amount: str
    currency: str
    source: str
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    created_at: datetime
    updated_at: datetime


class PayrollBatchResponse(BaseModel):
    """A payroll batch (without entries) returned from the API."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    project_id: UUID
    period_label: str
    period_start: str | None
    period_end: str | None
    status: str
    currency: str
    total_hours: str
    total_amount: str
    entry_count: int
    notes: str
    created_by: UUID | None
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    created_at: datetime
    updated_at: datetime


class PayrollBatchDetailResponse(PayrollBatchResponse):
    """A payroll batch with its entries expanded."""

    entries: list[PayrollEntryResponse] = Field(default_factory=list)


class LabourCostResponse(BaseModel):
    """Live labour-cost rollup for a project (base currency)."""

    model_config = ConfigDict(extra="ignore")

    project_id: UUID
    currency: str
    labour_cost: str
    total_hours: str
