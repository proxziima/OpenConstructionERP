/**
 * API helpers for the Equipment & Fleet module.
 *
 * Backed by /api/v1/equipment/ — see backend/app/modules/equipment/router.py
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────── */

export type EquipmentStatus =
  | 'active'
  | 'under_maintenance'
  | 'decommissioned'
  | 'reserved';
export type Ownership = 'owned' | 'rented' | 'leased';
export type WorkOrderStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type InspectionType =
  | 'annual'
  | 'quarterly'
  | 'pre_use'
  | 'monthly'
  | 'weekly';
export type InspectionResult = 'pass' | 'fail' | 'conditional';
export type DamageSeverity = 'minor' | 'major' | 'critical';
export type DamageStatus = 'reported' | 'under_repair' | 'repaired';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type_code: string;
  manufacturer?: string | null;
  model?: string | null;
  serial?: string | null;
  year?: number | null;
  ownership: Ownership;
  status: EquipmentStatus;
  location_lat?: number | null;
  location_lng?: number | null;
  hour_meter: number | string;
  odometer_km: number | string;
  last_telemetry_at?: string | null;
  purchase_date?: string | null;
  purchase_value?: number | string | null;
  depreciation_method: string;
  useful_life_years?: number | null;
  residual_value?: number | string | null;
  currency: string;
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipmentPayload {
  code: string;
  name: string;
  type_code?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  year?: number;
  ownership?: Ownership;
  status?: EquipmentStatus;
  hour_meter?: number;
  odometer_km?: number;
  purchase_date?: string;
  purchase_value?: number;
  currency?: string;
  notes?: string;
}

export interface TelemetryReading {
  id: string;
  equipment_id: string;
  recorded_at: string;
  fuel_level?: number | string | null;
  hour_meter?: number | string | null;
  odometer_km?: number | string | null;
  lat?: number | null;
  lng?: number | null;
  engine_status?: string | null;
  raw_payload: Record<string, unknown>;
}

export interface MaintenanceWorkOrder {
  id: string;
  equipment_id: string;
  schedule_id?: string | null;
  scheduled_for?: string | null;
  completed_at?: string | null;
  status: WorkOrderStatus;
  technician_id?: string | null;
  work_summary?: string | null;
  cost: number | string;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  equipment_id: string;
  inspection_type: InspectionType;
  inspected_at: string;
  valid_until: string;
  inspector_name?: string | null;
  result: InspectionResult;
  notes?: string | null;
  certificate_url?: string | null;
  approved_by?: string | null;
}

export interface DamageReport {
  id: string;
  equipment_id: string;
  reported_at: string;
  reported_by?: string | null;
  severity: DamageSeverity;
  description: string;
  photos: string[];
  repair_cost_estimate?: number | string | null;
  currency: string;
  status: DamageStatus;
  work_order_id?: string | null;
}

export interface EquipmentDashboard {
  equipment_id: string;
  code: string;
  name: string;
  status: EquipmentStatus;
  utilization_pct: number;
  fuel_cost_mtd: number | string;
  open_work_orders: number;
  expiring_inspections: number;
  blocked: boolean;
  last_telemetry_at?: string | null;
}

/* ── Equipment CRUD ────────────────────────────────────────────────────── */

export function listEquipment(params?: {
  offset?: number;
  limit?: number;
  status?: string;
  type?: string;
  ownership?: string;
}): Promise<Equipment[]> {
  const qs = new URLSearchParams();
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.type) qs.set('type', params.type);
  if (params?.ownership) qs.set('ownership', params.ownership);
  const q = qs.toString();
  return apiGet<Equipment[]>(`/v1/equipment/equipment/${q ? `?${q}` : ''}`);
}

export function getEquipment(id: string): Promise<Equipment> {
  return apiGet<Equipment>(`/v1/equipment/equipment/${id}`);
}

export function createEquipment(data: CreateEquipmentPayload): Promise<Equipment> {
  return apiPost<Equipment>('/v1/equipment/equipment/', data);
}

export function updateEquipment(
  id: string,
  data: Partial<CreateEquipmentPayload>,
): Promise<Equipment> {
  return apiPatch<Equipment>(`/v1/equipment/equipment/${id}`, data);
}

export function deleteEquipment(id: string): Promise<void> {
  return apiDelete(`/v1/equipment/equipment/${id}`);
}

export function getEquipmentDashboard(id: string): Promise<EquipmentDashboard> {
  return apiGet<EquipmentDashboard>(`/v1/equipment/equipment/${id}/dashboard`);
}

/* ── Telemetry ────────────────────────────────────────────────────────── */

export function listTelemetry(
  equipmentId: string,
  params?: { limit?: number },
): Promise<TelemetryReading[]> {
  const qs = new URLSearchParams();
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<TelemetryReading[]>(
    `/v1/equipment/equipment/${equipmentId}/telemetry${q ? `?${q}` : ''}`,
  );
}

/* ── Maintenance ─────────────────────────────────────────────────────── */

export function listMaintenanceWorkOrders(params?: {
  equipment_id?: string;
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<MaintenanceWorkOrder[]> {
  const qs = new URLSearchParams();
  if (params?.equipment_id) qs.set('equipment_id', params.equipment_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<MaintenanceWorkOrder[]>(
    `/v1/equipment/maintenance-work-orders/${q ? `?${q}` : ''}`,
  );
}

/* ── Inspections ─────────────────────────────────────────────────────── */

export function listInspections(equipmentId?: string): Promise<Inspection[]> {
  const qs = new URLSearchParams();
  if (equipmentId) qs.set('equipment_id', equipmentId);
  const q = qs.toString();
  return apiGet<Inspection[]>(`/v1/equipment/inspections/${q ? `?${q}` : ''}`);
}

/* ── Damage reports ─────────────────────────────────────────────────── */

export function listDamageReports(params?: {
  equipment_id?: string;
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<DamageReport[]> {
  const qs = new URLSearchParams();
  if (params?.equipment_id) qs.set('equipment_id', params.equipment_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<DamageReport[]>(
    `/v1/equipment/damage-reports/${q ? `?${q}` : ''}`,
  );
}
