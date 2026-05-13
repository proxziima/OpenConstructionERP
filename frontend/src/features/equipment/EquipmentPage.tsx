import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Truck,
  Plus,
  Search,
  X,
  Loader2,
  Activity,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Breadcrumb,
  SkeletonTable,
} from '@/shared/ui';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import { useToastStore } from '@/stores/useToastStore';
import { getErrorMessage } from '@/shared/lib/api';
import {
  listEquipment,
  createEquipment,
  listTelemetry,
  listMaintenanceWorkOrders,
  listInspections,
  listDamageReports,
  type Equipment,
  type EquipmentStatus,
  type WorkOrderStatus,
  type InspectionResult,
  type DamageSeverity,
  type Ownership,
} from './api';

type DrawerTab = 'utilization' | 'maintenance' | 'certifications' | 'damage';

const STATUS_VARIANT: Record<
  EquipmentStatus,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  active: 'success',
  under_maintenance: 'warning',
  decommissioned: 'neutral',
  reserved: 'blue',
};

const WO_STATUS_VARIANT: Record<
  WorkOrderStatus,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  scheduled: 'blue',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const INSPECTION_VARIANT: Record<
  InspectionResult,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  pass: 'success',
  fail: 'error',
  conditional: 'warning',
};

const DAMAGE_VARIANT: Record<
  DamageSeverity,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  minor: 'neutral',
  major: 'warning',
  critical: 'error',
};

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue';

const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

function toNum(n: number | string | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === 'number' ? n : Number(n) || 0;
}

export function EquipmentPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const eqQ = useQuery({
    queryKey: ['equipment', 'list', statusFilter, ownershipFilter],
    queryFn: () =>
      listEquipment({
        limit: 200,
        status: statusFilter || undefined,
        ownership: ownershipFilter || undefined,
      }),
  });

  const filtered = useMemo(() => {
    const items = eqQ.data ?? [];
    const s = search.toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(s) ||
        it.name.toLowerCase().includes(s) ||
        (it.manufacturer || '').toLowerCase().includes(s) ||
        (it.model || '').toLowerCase().includes(s) ||
        (it.serial || '').toLowerCase().includes(s),
    );
  }, [eqQ.data, search]);

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          {
            label: t('equipment.title', { defaultValue: 'Equipment & Fleet' }),
          },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">
            {t('equipment.title', { defaultValue: 'Equipment & Fleet' })}
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            {t('equipment.subtitle', {
              defaultValue:
                'Track equipment assets, utilization, maintenance and certifications.',
            })}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          {t('equipment.new', { defaultValue: 'New Asset' })}
        </Button>
      </div>

      <div className="border-b border-border-light">
        <nav className="flex gap-1 -mb-px">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-oe-blue text-oe-blue"
          >
            <Truck size={14} />
            {t('equipment.tab_assets', { defaultValue: 'Assets' })}
          </button>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
          <input
            type="text"
            placeholder={t('common.search', { defaultValue: 'Search…' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(inputCls, 'pl-8')}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={clsx(inputCls, 'max-w-[180px]')}
        >
          <option value="">
            {t('common.all_statuses', { defaultValue: 'All statuses' })}
          </option>
          {(
            ['active', 'under_maintenance', 'decommissioned', 'reserved'] as EquipmentStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={ownershipFilter}
          onChange={(e) => setOwnershipFilter(e.target.value)}
          className={clsx(inputCls, 'max-w-[160px]')}
        >
          <option value="">
            {t('equipment.all_ownership', { defaultValue: 'All ownership' })}
          </option>
          {(['owned', 'rented', 'leased'] as Ownership[]).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <Card padding="none">
        {eqQ.isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={5} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Truck size={22} />}
            title={t('equipment.empty', { defaultValue: 'No equipment yet' })}
            description={t('equipment.empty_desc', {
              defaultValue:
                'Register equipment to track utilization, maintenance schedules and certifications.',
            })}
            action={{
              label: t('equipment.new', { defaultValue: 'New Asset' }),
              onClick: () => setCreateOpen(true),
            }}
          />
        ) : (
          <AssetTable rows={filtered} onSelect={setSelectedId} />
        )}
      </Card>

      {selectedId && (
        <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* ─── Table ─── */

function AssetTable({
  rows,
  onSelect,
}: {
  rows: Equipment[];
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_code', { defaultValue: 'Code' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_name', { defaultValue: 'Name' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_type', { defaultValue: 'Type' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_status', { defaultValue: 'Status' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_location', { defaultValue: 'Location' })}
            </th>
            <th className="px-4 py-2.5 text-right">
              {t('equipment.col_hours', { defaultValue: 'Hours' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="border-t border-border-light hover:bg-surface-secondary cursor-pointer"
            >
              <td className="px-4 py-2 font-mono text-xs text-content-secondary">
                {r.code}
              </td>
              <td className="px-4 py-2">
                <div className="font-medium text-content-primary truncate max-w-[280px]">
                  {r.name}
                </div>
                {(r.manufacturer || r.model) && (
                  <div className="text-xs text-content-tertiary truncate max-w-[280px]">
                    {[r.manufacturer, r.model].filter(Boolean).join(' · ')}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-content-secondary text-xs">
                {r.type_code}
              </td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[r.status]} dot>
                  {r.status}
                </Badge>
              </td>
              <td className="px-4 py-2 text-xs text-content-secondary">
                {r.location_lat !== null &&
                r.location_lng !== null &&
                r.location_lat !== undefined &&
                r.location_lng !== undefined ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} className="text-content-tertiary" />
                    {r.location_lat.toFixed(2)}, {r.location_lng.toFixed(2)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">
                {toNum(r.hour_meter).toFixed(0)} h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Detail Drawer ─── */

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DrawerTab>('utilization');

  const eqQ = useQuery({
    queryKey: ['equipment', 'detail', id],
    queryFn: () =>
      listEquipment({ limit: 500 }).then(
        (rows) => rows.find((r) => r.id === id) ?? null,
      ),
  });
  const eq = eqQ.data;

  const telemetryQ = useQuery({
    queryKey: ['equipment', 'telemetry', id],
    queryFn: () => listTelemetry(id, { limit: 50 }),
    enabled: !!id && tab === 'utilization',
  });

  const wosQ = useQuery({
    queryKey: ['equipment', 'workOrders', id],
    queryFn: () => listMaintenanceWorkOrders({ equipment_id: id }),
    enabled: !!id && tab === 'maintenance',
  });

  const insQ = useQuery({
    queryKey: ['equipment', 'inspections', id],
    queryFn: () => listInspections(id),
    enabled: !!id && tab === 'certifications',
  });

  const damQ = useQuery({
    queryKey: ['equipment', 'damage', id],
    queryFn: () => listDamageReports({ equipment_id: id }),
    enabled: !!id && tab === 'damage',
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-2xl overflow-y-auto bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-surface-elevated px-5 py-3">
          <div>
            <h2 className="text-base font-semibold">
              {eq ? `${eq.code} · ${eq.name}` : t('common.loading', { defaultValue: 'Loading…' })}
            </h2>
            {eq?.serial && (
              <p className="text-xs text-content-tertiary">SN: {eq.serial}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-surface-secondary"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X size={16} />
          </button>
        </div>

        {eq && (
          <>
            <div className="grid grid-cols-2 gap-3 p-5 text-sm border-b border-border-light sm:grid-cols-4">
              <KV
                label={t('equipment.col_status', { defaultValue: 'Status' })}
                value={
                  <Badge variant={STATUS_VARIANT[eq.status]} dot>
                    {eq.status}
                  </Badge>
                }
              />
              <KV
                label={t('equipment.col_type', { defaultValue: 'Type' })}
                value={eq.type_code}
              />
              <KV
                label={t('equipment.ownership', { defaultValue: 'Ownership' })}
                value={eq.ownership}
              />
              <KV
                label={t('equipment.col_hours', { defaultValue: 'Hours' })}
                value={`${toNum(eq.hour_meter).toFixed(0)} h`}
              />
            </div>

            <div className="border-b border-border-light px-5">
              <nav className="flex gap-1 -mb-px">
                {(
                  [
                    {
                      id: 'utilization',
                      label: t('equipment.tab_utilization', {
                        defaultValue: 'Utilization',
                      }),
                      icon: Activity,
                    },
                    {
                      id: 'maintenance',
                      label: t('equipment.tab_maintenance', {
                        defaultValue: 'Maintenance',
                      }),
                      icon: Wrench,
                    },
                    {
                      id: 'certifications',
                      label: t('equipment.tab_certifications', {
                        defaultValue: 'Certifications',
                      }),
                      icon: ShieldCheck,
                    },
                    {
                      id: 'damage',
                      label: t('equipment.tab_damage', {
                        defaultValue: 'Damage',
                      }),
                      icon: AlertTriangle,
                    },
                  ] as { id: DrawerTab; label: string; icon: React.ElementType }[]
                ).map((ti) => {
                  const Icon = ti.icon;
                  return (
                    <button
                      key={ti.id}
                      type="button"
                      onClick={() => setTab(ti.id)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
                        tab === ti.id
                          ? 'border-oe-blue text-oe-blue'
                          : 'border-transparent text-content-secondary hover:text-content-primary',
                      )}
                    >
                      <Icon size={12} />
                      {ti.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-5 space-y-3">
              {tab === 'utilization' && (
                <UtilizationTab
                  equipment={eq}
                  telemetry={telemetryQ.data ?? []}
                  loading={telemetryQ.isLoading}
                />
              )}
              {tab === 'maintenance' && (
                <MaintenanceTab
                  rows={wosQ.data ?? []}
                  loading={wosQ.isLoading}
                />
              )}
              {tab === 'certifications' && (
                <CertificationsTab
                  rows={insQ.data ?? []}
                  loading={insQ.isLoading}
                />
              )}
              {tab === 'damage' && (
                <DamageTab rows={damQ.data ?? []} loading={damQ.isLoading} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UtilizationTab({
  equipment,
  telemetry,
  loading,
}: {
  equipment: Equipment;
  telemetry: { id: string; recorded_at: string; fuel_level?: number | string | null; hour_meter?: number | string | null; odometer_km?: number | string | null; engine_status?: string | null }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.hour_meter', { defaultValue: 'Hour meter' })}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {toNum(equipment.hour_meter).toFixed(0)} h
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.odometer', { defaultValue: 'Odometer' })}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {toNum(equipment.odometer_km).toFixed(0)} km
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.last_telemetry', { defaultValue: 'Last reading' })}
          </p>
          <p className="mt-1 text-xs">
            {equipment.last_telemetry_at ? (
              <DateDisplay value={equipment.last_telemetry_at} />
            ) : (
              '—'
            )}
          </p>
        </Card>
      </div>

      {loading && <SkeletonTable rows={4} columns={4} />}
      {!loading && telemetry.length === 0 && (
        <EmptyState
          icon={<Activity size={20} />}
          title={t('equipment.no_telemetry', {
            defaultValue: 'No telemetry recorded',
          })}
        />
      )}
      {!loading && telemetry.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-light">
          <table className="w-full text-xs">
            <thead className="bg-surface-secondary text-content-tertiary uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">
                  {t('equipment.recorded_at', { defaultValue: 'Recorded at' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.col_hours', { defaultValue: 'Hours' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.km', { defaultValue: 'km' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.fuel_level', { defaultValue: 'Fuel %' })}
                </th>
                <th className="px-3 py-2 text-left">
                  {t('equipment.engine_status', {
                    defaultValue: 'Engine',
                  })}
                </th>
              </tr>
            </thead>
            <tbody>
              {telemetry.map((r) => (
                <tr key={r.id} className="border-t border-border-light">
                  <td className="px-3 py-2 text-content-secondary">
                    <DateDisplay value={r.recorded_at} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.hour_meter !== null && r.hour_meter !== undefined
                      ? toNum(r.hour_meter).toFixed(0)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.odometer_km !== null && r.odometer_km !== undefined
                      ? toNum(r.odometer_km).toFixed(0)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.fuel_level !== null && r.fuel_level !== undefined
                      ? `${toNum(r.fuel_level).toFixed(0)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-content-secondary">
                    {r.engine_status || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MaintenanceTab({
  rows,
  loading,
}: {
  rows: { id: string; status: WorkOrderStatus; scheduled_for?: string | null; completed_at?: string | null; technician_id?: string | null; work_summary?: string | null; cost: number | string; currency: string }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) return <SkeletonTable rows={4} columns={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Wrench size={20} />}
        title={t('equipment.no_workorders', {
          defaultValue: 'No maintenance work orders',
        })}
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border-light">
      <table className="w-full text-xs">
        <thead className="bg-surface-secondary text-content-tertiary uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">
              {t('equipment.scheduled_for', { defaultValue: 'Scheduled' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.technician', { defaultValue: 'Technician' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.summary', { defaultValue: 'Summary' })}
            </th>
            <th className="px-3 py-2 text-right">
              {t('equipment.cost', { defaultValue: 'Cost' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.col_status', { defaultValue: 'Status' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-light">
              <td className="px-3 py-2 text-content-secondary">
                {r.scheduled_for || '—'}
              </td>
              <td className="px-3 py-2 text-content-secondary">
                {r.technician_id || '—'}
              </td>
              <td className="px-3 py-2 truncate max-w-[200px]">
                {r.work_summary || '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyDisplay
                  amount={toNum(r.cost)}
                  currency={r.currency || 'EUR'}
                />
              </td>
              <td className="px-3 py-2">
                <Badge variant={WO_STATUS_VARIANT[r.status]} dot>
                  {r.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CertificationsTab({
  rows,
  loading,
}: {
  rows: { id: string; inspection_type: string; inspected_at: string; valid_until: string; inspector_name?: string | null; result: InspectionResult }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) return <SkeletonTable rows={3} columns={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={20} />}
        title={t('equipment.no_certifications', {
          defaultValue: 'No inspections recorded',
        })}
      />
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-x-auto rounded-lg border border-border-light">
      <table className="w-full text-xs">
        <thead className="bg-surface-secondary text-content-tertiary uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">
              {t('equipment.inspection_type', { defaultValue: 'Type' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.inspected_at', { defaultValue: 'Inspected' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.valid_until', { defaultValue: 'Valid until' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.inspector', { defaultValue: 'Inspector' })}
            </th>
            <th className="px-3 py-2 text-left">
              {t('equipment.result', { defaultValue: 'Result' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expired = r.valid_until < today;
            return (
              <tr key={r.id} className="border-t border-border-light">
                <td className="px-3 py-2">{r.inspection_type}</td>
                <td className="px-3 py-2 text-content-secondary">
                  {r.inspected_at}
                </td>
                <td
                  className={clsx(
                    'px-3 py-2',
                    expired ? 'text-status-error font-medium' : 'text-content-secondary',
                  )}
                >
                  {r.valid_until}
                  {expired && (
                    <span className="ml-1 text-[10px] uppercase">
                      {t('equipment.expired', { defaultValue: 'expired' })}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-content-secondary">
                  {r.inspector_name || '—'}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={INSPECTION_VARIANT[r.result]} dot>
                    {r.result}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DamageTab({
  rows,
  loading,
}: {
  rows: { id: string; reported_at: string; severity: DamageSeverity; description: string; repair_cost_estimate?: number | string | null; currency: string; status: string }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) return <SkeletonTable rows={3} columns={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title={t('equipment.no_damage', { defaultValue: 'No damage reports' })}
      />
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id} padding="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-content-tertiary">{r.reported_at}</p>
              <p className="mt-1 text-sm text-content-primary whitespace-pre-wrap">
                {r.description || '—'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={DAMAGE_VARIANT[r.severity]} dot>
                {r.severity}
              </Badge>
              <Badge variant="neutral">{r.status}</Badge>
            </div>
          </div>
          {r.repair_cost_estimate !== null &&
            r.repair_cost_estimate !== undefined && (
              <p className="mt-2 text-xs text-content-secondary">
                {t('equipment.repair_estimate', {
                  defaultValue: 'Repair estimate',
                })}
                :{' '}
                <MoneyDisplay
                  amount={toNum(r.repair_cost_estimate)}
                  currency={r.currency || 'EUR'}
                />
              </p>
            )}
        </Card>
      ))}
    </div>
  );
}

function KV({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-content-tertiary">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-content-primary">{value}</p>
    </div>
  );
}

/* ─── Create modal ─── */

function CreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    type_code: 'other',
    manufacturer: '',
    model: '',
    serial: '',
    ownership: 'owned' as Ownership,
    status: 'active' as EquipmentStatus,
  });

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      addToast({
        type: 'error',
        title: t('equipment.code_name_required', {
          defaultValue: 'Code and name are required',
        }),
      });
      return;
    }
    setBusy(true);
    try {
      await createEquipment({
        code: form.code.trim(),
        name: form.name.trim(),
        type_code: form.type_code.trim() || 'other',
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        serial: form.serial.trim() || undefined,
        ownership: form.ownership,
        status: form.status,
      });
      addToast({
        type: 'success',
        title: t('equipment.created', { defaultValue: 'Equipment created' }),
      });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {t('equipment.new', { defaultValue: 'New Asset' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-surface-secondary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('equipment.col_code', { defaultValue: 'Code' })} *
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={inputCls}
                placeholder="EXC-001"
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.col_type', { defaultValue: 'Type code' })}
              </label>
              <input
                value={form.type_code}
                onChange={(e) => setForm({ ...form, type_code: e.target.value })}
                className={inputCls}
                placeholder="excavator"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {t('equipment.col_name', { defaultValue: 'Name' })} *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('equipment.manufacturer', { defaultValue: 'Manufacturer' })}
              </label>
              <input
                value={form.manufacturer}
                onChange={(e) =>
                  setForm({ ...form, manufacturer: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.model', { defaultValue: 'Model' })}
              </label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {t('equipment.serial', { defaultValue: 'Serial' })}
            </label>
            <input
              value={form.serial}
              onChange={(e) => setForm({ ...form, serial: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('equipment.ownership', { defaultValue: 'Ownership' })}
              </label>
              <select
                value={form.ownership}
                onChange={(e) =>
                  setForm({ ...form, ownership: e.target.value as Ownership })
                }
                className={inputCls}
              >
                {(['owned', 'rented', 'leased'] as Ownership[]).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.col_status', { defaultValue: 'Status' })}
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as EquipmentStatus,
                  })
                }
                className={inputCls}
              >
                {(
                  [
                    'active',
                    'under_maintenance',
                    'decommissioned',
                    'reserved',
                  ] as EquipmentStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={busy}
            icon={busy ? <Loader2 size={14} /> : <Plus size={14} />}
          >
            {t('common.create', { defaultValue: 'Create' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
