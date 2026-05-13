"""Variations data access layer (one repository class per entity)."""

from __future__ import annotations

import uuid
from typing import Any, TypeVar

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.variations.models import (
    DayworkSheet,
    DayworkSheetLine,
    DisruptionClaim,
    ExtensionOfTimeClaim,
    FinalAccount,
    Notice,
    SiteMeasurement,
    VariationCostImpact,
    VariationOrder,
    VariationRequest,
    VariationScheduleImpact,
)

T = TypeVar("T")


class _BaseRepo:
    """Shared CRUD helpers — concrete repos bind ``model`` and ``project_field``."""

    model: Any
    project_field: Any | None = None

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, row_id: uuid.UUID) -> Any | None:
        return await self.session.get(self.model, row_id)

    async def create(self, row: Any) -> Any:
        self.session.add(row)
        await self.session.flush()
        return row

    async def update_fields(self, row_id: uuid.UUID, **fields: Any) -> None:
        stmt = update(self.model).where(self.model.id == row_id).values(**fields)
        await self.session.execute(stmt)
        await self.session.flush()
        self.session.expire_all()

    async def delete(self, row_id: uuid.UUID) -> None:
        row = await self.get_by_id(row_id)
        if row is not None:
            await self.session.delete(row)
            await self.session.flush()

    async def list_for_project(
        self,
        project_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
        status: str | None = None,
    ) -> tuple[list[Any], int]:
        if self.project_field is None:  # pragma: no cover -- defensive
            return [], 0
        base = select(self.model).where(self.project_field == project_id)
        if status is not None:
            base = base.where(self.model.status == status)
        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = base.order_by(self.model.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total


class NoticeRepository(_BaseRepo):
    model = Notice
    project_field = Notice.project_id

    async def next_code(self, project_id: uuid.UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(Notice)
            .where(Notice.project_id == project_id)
        )
        count = (await self.session.execute(stmt)).scalar_one()
        return f"NOT-{count + 1:04d}"


class VariationRequestRepository(_BaseRepo):
    model = VariationRequest
    project_field = VariationRequest.project_id

    async def next_code(self, project_id: uuid.UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(VariationRequest)
            .where(VariationRequest.project_id == project_id)
        )
        count = (await self.session.execute(stmt)).scalar_one()
        return f"VR-{count + 1:04d}"

    async def list_open(self, project_id: uuid.UUID) -> list[VariationRequest]:
        stmt = select(VariationRequest).where(
            VariationRequest.project_id == project_id,
            VariationRequest.status.in_(["draft", "submitted", "under_review"]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class VariationOrderRepository(_BaseRepo):
    model = VariationOrder
    project_field = VariationOrder.project_id

    async def next_code(self, project_id: uuid.UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(VariationOrder)
            .where(VariationOrder.project_id == project_id)
        )
        count = (await self.session.execute(stmt)).scalar_one()
        return f"VO-{count + 1:04d}"

    async def list_open_variations(self, project_id: uuid.UUID) -> list[VariationOrder]:
        stmt = select(VariationOrder).where(
            VariationOrder.project_id == project_id,
            VariationOrder.status.in_(["issued", "in_progress"]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all_for_project(self, project_id: uuid.UUID) -> list[VariationOrder]:
        stmt = select(VariationOrder).where(VariationOrder.project_id == project_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class VariationCostImpactRepository(_BaseRepo):
    model = VariationCostImpact

    async def list_for_order(self, vo_id: uuid.UUID) -> list[VariationCostImpact]:
        stmt = select(VariationCostImpact).where(
            VariationCostImpact.variation_order_id == vo_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class VariationScheduleImpactRepository(_BaseRepo):
    model = VariationScheduleImpact

    async def list_for_order(self, vo_id: uuid.UUID) -> list[VariationScheduleImpact]:
        stmt = select(VariationScheduleImpact).where(
            VariationScheduleImpact.variation_order_id == vo_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class SiteMeasurementRepository(_BaseRepo):
    model = SiteMeasurement
    project_field = SiteMeasurement.project_id


class DayworkSheetRepository(_BaseRepo):
    model = DayworkSheet
    project_field = DayworkSheet.project_id

    async def next_sheet_number(self, project_id: uuid.UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(DayworkSheet)
            .where(DayworkSheet.project_id == project_id)
        )
        count = (await self.session.execute(stmt)).scalar_one()
        return f"DW-{count + 1:04d}"

    async def list_signed(self, project_id: uuid.UUID) -> list[DayworkSheet]:
        stmt = select(DayworkSheet).where(
            DayworkSheet.project_id == project_id,
            DayworkSheet.status.in_(["signed", "billed"]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class DayworkSheetLineRepository(_BaseRepo):
    model = DayworkSheetLine

    async def list_for_sheet(self, sheet_id: uuid.UUID) -> list[DayworkSheetLine]:
        stmt = select(DayworkSheetLine).where(DayworkSheetLine.sheet_id == sheet_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class DisruptionClaimRepository(_BaseRepo):
    model = DisruptionClaim
    project_field = DisruptionClaim.project_id

    async def pending_claims(self, project_id: uuid.UUID) -> list[DisruptionClaim]:
        stmt = select(DisruptionClaim).where(
            DisruptionClaim.project_id == project_id,
            DisruptionClaim.status.in_(["submitted", "under_review"]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class ExtensionOfTimeClaimRepository(_BaseRepo):
    model = ExtensionOfTimeClaim
    project_field = ExtensionOfTimeClaim.project_id

    async def pending_claims(self, project_id: uuid.UUID) -> list[ExtensionOfTimeClaim]:
        stmt = select(ExtensionOfTimeClaim).where(
            ExtensionOfTimeClaim.project_id == project_id,
            ExtensionOfTimeClaim.status.in_(["submitted", "under_review"]),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class FinalAccountRepository(_BaseRepo):
    model = FinalAccount
    project_field = FinalAccount.project_id

    async def for_project(self, project_id: uuid.UUID) -> FinalAccount | None:
        stmt = select(FinalAccount).where(FinalAccount.project_id == project_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()
