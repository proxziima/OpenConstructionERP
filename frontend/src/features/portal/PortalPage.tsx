import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Users,
  ShieldCheck,
  FileSearch,
  Plus,
  Search,
  X,
  Copy,
  Send,
  Ban,
  RotateCcw,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Breadcrumb,
  SkeletonTable,
} from '@/shared/ui';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import { useToastStore } from '@/stores/useToastStore';
import { getErrorMessage } from '@/shared/lib/api';
import {
  listPortalUsers,
  listDocumentAccessLog,
  invitePortalUser,
  resendInvite,
  suspendPortalUser,
  reactivatePortalUser,
  grantAccess,
  revokeAccess,
  type PortalUser,
  type PortalRole,
  type PortalUserStatus,
  type DocumentAccessLogEntry,
  type AccessRule,
  type AccessPermission,
} from './api';

type Tab = 'users' | 'access_rules' | 'audit_log';

const ROLES: PortalRole[] = [
  'client',
  'investor',
  'consultant',
  'subcontractor',
  'supplier',
  'building_user',
];

const PERMISSIONS: AccessPermission[] = ['view', 'comment', 'submit', 'sign'];

const STATUS_VARIANT: Record<string, 'neutral' | 'blue' | 'success' | 'warning' | 'error'> = {
  invited: 'blue',
  active: 'success',
  suspended: 'error',
  expired: 'neutral',
};

const ACTION_VARIANT: Record<string, 'neutral' | 'blue' | 'success' | 'warning' | 'error'> = {
  view: 'neutral',
  download: 'blue',
  sign: 'warning',
};

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue';

const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

/* ─── Page ─── */

export function PortalPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<{
    token: string;
    expires_at: string;
    email: string;
  } | null>(null);

  // Access rules are per-user — we keep them in component state because the
  // backend exposes only "grant" + "revoke", not a list endpoint. UI tracks
  // grants made during this session.
  const [sessionRules, setSessionRules] = useState<AccessRule[]>([]);

  const usersQ = useQuery({
    queryKey: ['portal', 'users', statusFilter],
    queryFn: () =>
      listPortalUsers({
        limit: 200,
        status: statusFilter || undefined,
      }),
  });

  const auditQ = useQuery({
    queryKey: ['portal', 'audit', selectedUser?.id],
    queryFn: () =>
      listDocumentAccessLog({
        portal_user_id: selectedUser?.id,
        limit: 200,
      }),
    enabled: tab === 'audit_log' || !!selectedUser,
  });

  const filteredUsers = useMemo(() => {
    const items = usersQ.data?.items ?? [];
    const s = search.toLowerCase();
    return items.filter((u) => {
      if (!s) return true;
      return (
        u.email.toLowerCase().includes(s) ||
        (u.full_name || '').toLowerCase().includes(s) ||
        u.portal_role.toLowerCase().includes(s)
      );
    });
  }, [usersQ.data, search]);

  const filteredAudit = useMemo(() => {
    const items = auditQ.data ?? [];
    const s = search.toLowerCase();
    return items.filter((e) => {
      if (!s) return true;
      return (
        e.document_type.toLowerCase().includes(s) ||
        e.action.toLowerCase().includes(s) ||
        e.document_id.toLowerCase().includes(s)
      );
    });
  }, [auditQ.data, search]);

  const isLoading =
    (tab === 'users' && usersQ.isLoading) ||
    (tab === 'audit_log' && auditQ.isLoading);

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: t('portal.title', { defaultValue: 'Customer / Buyer Portal' }) }]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">
            {t('portal.title', { defaultValue: 'Customer / Buyer Portal' })}
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            {t('portal.subtitle', {
              defaultValue:
                'Invite external customers and buyers, manage scoped access to documents, and audit who saw what.',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'access_rules' && (
            <Button
              variant="secondary"
              icon={<Plus size={14} />}
              onClick={() => setGrantOpen(true)}
            >
              {t('portal.grant_access', { defaultValue: 'Grant Access' })}
            </Button>
          )}
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => setInviteOpen(true)}
          >
            {t('portal.invite_user', { defaultValue: 'Invite User' })}
          </Button>
        </div>
      </div>

      {lastInviteLink && (
        <MagicLinkBanner
          email={lastInviteLink.email}
          token={lastInviteLink.token}
          expiresAt={lastInviteLink.expires_at}
          onDismiss={() => setLastInviteLink(null)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-border-light">
        <nav className="flex gap-1 -mb-px">
          {(
            [
              { id: 'users', label: t('portal.users', { defaultValue: 'Users' }), icon: Users },
              {
                id: 'access_rules',
                label: t('portal.access_rules', { defaultValue: 'Access Rules' }),
                icon: ShieldCheck,
              },
              {
                id: 'audit_log',
                label: t('portal.audit_log', { defaultValue: 'Audit Log' }),
                icon: FileSearch,
              },
            ] as { id: Tab; label: string; icon: React.ElementType }[]
          ).map((tabItem) => {
            const Icon = tabItem.icon;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => {
                  setTab(tabItem.id);
                  setSearch('');
                  setStatusFilter('');
                }}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  tab === tabItem.id
                    ? 'border-oe-blue text-oe-blue'
                    : 'border-transparent text-content-secondary hover:text-content-primary',
                )}
              >
                <Icon size={14} />
                {tabItem.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters */}
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
        {tab === 'users' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={clsx(inputCls, 'max-w-[200px]')}
          >
            <option value="">
              {t('common.all_statuses', { defaultValue: 'All statuses' })}
            </option>
            {(['invited', 'active', 'suspended', 'expired'] as PortalUserStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Body */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={5} />
          </div>
        ) : tab === 'users' ? (
          <UserTable
            rows={filteredUsers}
            onSelect={setSelectedUser}
            onInvite={() => setInviteOpen(true)}
          />
        ) : tab === 'access_rules' ? (
          <AccessRuleTable
            rows={sessionRules}
            users={usersQ.data?.items ?? []}
            onGrant={() => setGrantOpen(true)}
            onRevoke={(ruleId) =>
              setSessionRules((rules) => rules.filter((r) => r.id !== ruleId))
            }
          />
        ) : (
          <AuditLogTable rows={filteredAudit} users={usersQ.data?.items ?? []} />
        )}
      </Card>

      {/* Detail Drawer */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          auditEntries={(auditQ.data ?? []).filter(
            (e) => e.portal_user_id === selectedUser.id,
          )}
          onClose={() => setSelectedUser(null)}
          onResent={(link) => {
            setLastInviteLink({
              email: selectedUser.email,
              token: link.token,
              expires_at: link.expires_at,
            });
          }}
        />
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={(email, token, expires_at) => {
            setLastInviteLink({ email, token, expires_at });
          }}
        />
      )}

      {/* Grant modal */}
      {grantOpen && (
        <GrantAccessModal
          users={usersQ.data?.items ?? []}
          onClose={() => setGrantOpen(false)}
          onGranted={(rule) => setSessionRules((r) => [rule, ...r])}
        />
      )}
    </div>
  );
}

/* ─── Banner: magic-link shown once ─── */

function MagicLinkBanner({
  email,
  token,
  expiresAt,
  onDismiss,
}: {
  email: string;
  token: string;
  expiresAt: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      addToast({
        type: 'success',
        title: t('portal.link_copied', { defaultValue: 'Magic link copied' }),
      });
    } catch {
      addToast({
        type: 'error',
        title: t('portal.copy_failed', { defaultValue: 'Could not copy to clipboard' }),
      });
    }
  };
  return (
    <Card padding="sm" className="border-oe-blue/30 bg-oe-blue-subtle/40">
      <div className="flex items-start gap-3">
        <Send size={18} className="mt-0.5 text-oe-blue" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-content-primary">
            {t('portal.magic_link_for', { defaultValue: 'Magic link for' })}{' '}
            <span className="font-mono">{email}</span>
          </p>
          <p className="mt-0.5 text-xs text-content-secondary">
            {t('portal.magic_link_warning', {
              defaultValue:
                'Shown once — copy and send to the user manually. Email delivery is not wired up yet.',
            })}{' '}
            ·{' '}
            {t('portal.expires_at', { defaultValue: 'Expires' })}{' '}
            <DateDisplay value={expiresAt} />
          </p>
          <code className="mt-2 block w-full truncate rounded bg-surface-secondary px-2 py-1.5 font-mono text-xs">
            {token}
          </code>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" icon={<Copy size={12} />} onClick={copy}>
            {t('common.copy', { defaultValue: 'Copy' })}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {t('common.dismiss', { defaultValue: 'Dismiss' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Tables ─── */

function UserTable({
  rows,
  onSelect,
  onInvite,
}: {
  rows: PortalUser[];
  onSelect: (u: PortalUser) => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title={t('portal.empty_users', { defaultValue: 'No portal users yet' })}
        description={t('portal.empty_users_desc', {
          defaultValue:
            'Invite a customer, investor or subcontractor to give them scoped read access to project documents.',
        })}
        action={{
          label: t('portal.invite_user', { defaultValue: 'Invite User' }),
          onClick: onInvite,
        }}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2.5 text-left">
              {t('portal.email', { defaultValue: 'Email' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.full_name', { defaultValue: 'Name' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.role', { defaultValue: 'Role' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.status', { defaultValue: 'Status' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.last_login', { defaultValue: 'Last login' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              onClick={() => onSelect(u)}
              className="border-t border-border-light hover:bg-surface-secondary cursor-pointer"
            >
              <td className="px-4 py-2 font-mono text-xs text-content-secondary truncate max-w-[260px]">
                {u.email}
              </td>
              <td className="px-4 py-2 font-medium text-content-primary truncate max-w-[200px]">
                {u.full_name || '—'}
              </td>
              <td className="px-4 py-2 text-xs">
                <Badge variant="neutral">{u.portal_role}</Badge>
              </td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[u.status] ?? 'neutral'} dot>
                  {u.status}
                </Badge>
              </td>
              <td className="px-4 py-2 text-xs text-content-secondary">
                {u.last_login_at ? <DateDisplay value={u.last_login_at} /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessRuleTable({
  rows,
  users,
  onGrant,
  onRevoke,
}: {
  rows: AccessRule[];
  users: PortalUser[];
  onGrant: () => void;
  onRevoke: (ruleId: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const userById = useMemo(() => {
    const m = new Map<string, PortalUser>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const revokeMut = useMutation({
    mutationFn: (ruleId: string) => revokeAccess(ruleId),
    onSuccess: (_, ruleId) => {
      onRevoke(ruleId);
      qc.invalidateQueries({ queryKey: ['portal'] });
      addToast({
        type: 'success',
        title: t('portal.access_revoked', { defaultValue: 'Access rule revoked' }),
      });
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={22} />}
        title={t('portal.empty_rules', { defaultValue: 'No access rules granted in this session' })}
        description={t('portal.empty_rules_desc', {
          defaultValue:
            'Grant a portal user view / comment / submit / sign permission on a specific document, project or development.',
        })}
        action={{
          label: t('portal.grant_access', { defaultValue: 'Grant Access' }),
          onClick: onGrant,
        }}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2.5 text-left">
              {t('portal.user', { defaultValue: 'User' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.resource_type', { defaultValue: 'Resource Type' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.resource_id', { defaultValue: 'Resource ID' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.permission', { defaultValue: 'Permission' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.expires', { defaultValue: 'Expires' })}
            </th>
            <th className="px-4 py-2.5 text-right">
              {t('common.actions', { defaultValue: 'Actions' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const u = userById.get(r.portal_user_id);
            return (
              <tr key={r.id} className="border-t border-border-light">
                <td className="px-4 py-2 font-mono text-xs text-content-secondary truncate max-w-[220px]">
                  {u?.email ?? r.portal_user_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2 text-xs">
                  <Badge variant="neutral">{r.resource_type}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-content-secondary truncate max-w-[200px]">
                  {r.resource_id}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="blue">{r.permission}</Badge>
                </td>
                <td className="px-4 py-2 text-xs text-content-secondary">
                  {r.expires_at ? <DateDisplay value={r.expires_at} /> : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Ban size={12} />}
                    loading={revokeMut.isPending && revokeMut.variables === r.id}
                    onClick={() => revokeMut.mutate(r.id)}
                  >
                    {t('common.revoke', { defaultValue: 'Revoke' })}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditLogTable({
  rows,
  users,
}: {
  rows: DocumentAccessLogEntry[];
  users: PortalUser[];
}) {
  const { t } = useTranslation();
  const userById = useMemo(() => {
    const m = new Map<string, PortalUser>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch size={22} />}
        title={t('portal.empty_audit', { defaultValue: 'No document access yet' })}
        description={t('portal.empty_audit_desc', {
          defaultValue:
            'Every view, download and signature event from invited portal users will be recorded here, with IP and timestamp.',
        })}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2.5 text-left">
              {t('portal.user', { defaultValue: 'User' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.document_type', { defaultValue: 'Document Type' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.document_id', { defaultValue: 'Document ID' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.action', { defaultValue: 'Action' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.ip', { defaultValue: 'IP' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('portal.when', { defaultValue: 'When' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const u = userById.get(e.portal_user_id);
            return (
              <tr key={e.id} className="border-t border-border-light">
                <td className="px-4 py-2 font-mono text-xs text-content-secondary truncate max-w-[220px]">
                  {u?.email ?? e.portal_user_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2 text-xs">
                  <Badge variant="neutral">{e.document_type}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-content-secondary truncate max-w-[180px]">
                  {e.document_id}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={ACTION_VARIANT[e.action] ?? 'neutral'}>{e.action}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-content-secondary">
                  {e.ip_address ?? '—'}
                </td>
                <td className="px-4 py-2 text-xs text-content-secondary">
                  {e.occurred_at ? <DateDisplay value={e.occurred_at} /> : <DateDisplay value={e.created_at} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── User detail drawer ─── */

function UserDrawer({
  user,
  auditEntries,
  onClose,
  onResent,
}: {
  user: PortalUser;
  auditEntries: DocumentAccessLogEntry[];
  onClose: () => void;
  onResent: (link: { token: string; expires_at: string }) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const resendMut = useMutation({
    mutationFn: () => resendInvite(user.id),
    onSuccess: (data) => {
      addToast({
        type: 'success',
        title: t('portal.invite_resent', { defaultValue: 'Invite resent' }),
      });
      onResent({
        token: data.magic_link_token,
        expires_at: data.magic_link_expires_at,
      });
      qc.invalidateQueries({ queryKey: ['portal', 'users'] });
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  const suspendMut = useMutation({
    mutationFn: () => suspendPortalUser(user.id),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: t('portal.suspended', { defaultValue: 'User suspended' }),
      });
      qc.invalidateQueries({ queryKey: ['portal', 'users'] });
      onClose();
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  const reactivateMut = useMutation({
    mutationFn: () => reactivatePortalUser(user.id),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: t('portal.reactivated', { defaultValue: 'User reactivated' }),
      });
      qc.invalidateQueries({ queryKey: ['portal', 'users'] });
      onClose();
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-surface-elevated px-5 py-3">
          <h2 className="text-base font-semibold truncate">{user.email}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-surface-secondary"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field
              label={t('portal.full_name', { defaultValue: 'Name' })}
              value={user.full_name || '—'}
            />
            <Field
              label={t('portal.role', { defaultValue: 'Role' })}
              value={<Badge variant="neutral">{user.portal_role}</Badge>}
            />
            <Field
              label={t('portal.status', { defaultValue: 'Status' })}
              value={
                <Badge variant={STATUS_VARIANT[user.status] ?? 'neutral'} dot>
                  {user.status}
                </Badge>
              }
            />
            <Field
              label={t('portal.language', { defaultValue: 'Language' })}
              value={user.language}
            />
            <Field
              label={t('portal.timezone', { defaultValue: 'Timezone' })}
              value={user.timezone}
            />
            <Field
              label={t('portal.invited_at', { defaultValue: 'Invited' })}
              value={user.invited_at ? <DateDisplay value={user.invited_at} /> : '—'}
            />
            <Field
              label={t('portal.last_login', { defaultValue: 'Last login' })}
              value={
                user.last_login_at ? <DateDisplay value={user.last_login_at} /> : '—'
              }
            />
            <Field
              label={t('portal.failed_logins', { defaultValue: 'Failed logins' })}
              value={user.failed_login_count}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border-light pt-4">
            <Button
              variant="secondary"
              icon={<Send size={14} />}
              loading={resendMut.isPending}
              onClick={() => resendMut.mutate()}
            >
              {t('portal.resend_invite', { defaultValue: 'Resend invite' })}
            </Button>
            {user.status === 'suspended' ? (
              <Button
                variant="secondary"
                icon={<RotateCcw size={14} />}
                loading={reactivateMut.isPending}
                onClick={() => reactivateMut.mutate()}
              >
                {t('portal.reactivate', { defaultValue: 'Reactivate' })}
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={<Ban size={14} />}
                loading={suspendMut.isPending}
                onClick={() => suspendMut.mutate()}
              >
                {t('portal.suspend', { defaultValue: 'Suspend' })}
              </Button>
            )}
          </div>

          {auditEntries.length > 0 && (
            <div className="border-t border-border-light pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary mb-2">
                {t('portal.recent_access', { defaultValue: 'Recent document access' })}
              </p>
              <ul className="space-y-1.5">
                {auditEntries.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-xs">
                    <Badge variant={ACTION_VARIANT[e.action] ?? 'neutral'} size="sm">
                      {e.action}
                    </Badge>
                    <span className="font-mono text-content-secondary">
                      {e.document_type}
                    </span>
                    <span className="font-mono text-content-tertiary truncate">
                      {e.document_id.slice(0, 8)}
                    </span>
                    <span className="ml-auto text-content-tertiary">
                      <DateDisplay value={e.occurred_at ?? e.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className="mt-0.5 text-sm text-content-primary">{value}</p>
    </div>
  );
}

/* ─── Invite modal ─── */

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (email: string, token: string, expires_at: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [form, setForm] = useState<{
    email: string;
    full_name: string;
    portal_role: PortalRole;
    language: string;
    timezone: string;
    redirect_path: string;
  }>({
    email: '',
    full_name: '',
    portal_role: 'client',
    language: 'en',
    timezone: 'UTC',
    redirect_path: '',
  });

  const inviteMut = useMutation({
    mutationFn: () =>
      invitePortalUser({
        email: form.email,
        full_name: form.full_name || undefined,
        portal_role: form.portal_role,
        language: form.language,
        timezone: form.timezone,
        redirect_path: form.redirect_path || null,
      }),
    onSuccess: (data) => {
      addToast({
        type: 'success',
        title: t('portal.invited_ok', { defaultValue: 'User invited' }),
      });
      onInvited(form.email, data.magic_link_token, data.magic_link_expires_at);
      qc.invalidateQueries({ queryKey: ['portal', 'users'] });
      onClose();
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  const canSubmit = form.email.trim().length > 3 && form.email.includes('@');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {t('portal.invite_user', { defaultValue: 'Invite User' })}
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
          <div>
            <label className={labelCls}>
              {t('portal.email', { defaultValue: 'Email' })} *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
              placeholder="customer@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('portal.full_name', { defaultValue: 'Full name' })}
            </label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('portal.role', { defaultValue: 'Role' })} *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, portal_role: r })}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    form.portal_role === r
                      ? 'border-oe-blue bg-oe-blue text-content-inverse'
                      : 'border-border bg-surface-primary text-content-secondary hover:border-oe-blue/50',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('portal.language', { defaultValue: 'Language' })}
              </label>
              <input
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className={inputCls}
                maxLength={10}
                placeholder="en"
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('portal.timezone', { defaultValue: 'Timezone' })}
              </label>
              <input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className={inputCls}
                placeholder="UTC"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {t('portal.redirect_path', { defaultValue: 'Redirect path (optional)' })}
            </label>
            <input
              value={form.redirect_path}
              onChange={(e) => setForm({ ...form, redirect_path: e.target.value })}
              className={inputCls}
              placeholder="/projects/abc/documents"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={inviteMut.isPending}
            icon={<Send size={14} />}
            onClick={() => inviteMut.mutate()}
          >
            {t('portal.send_invite', { defaultValue: 'Send invite' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Grant access modal ─── */

function GrantAccessModal({
  users,
  onClose,
  onGranted,
}: {
  users: PortalUser[];
  onClose: () => void;
  onGranted: (rule: AccessRule) => void;
}) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [form, setForm] = useState({
    portal_user_id: users[0]?.id ?? '',
    resource_type: 'project',
    resource_id: '',
    permission: 'view' as AccessPermission,
    expires_at: '',
  });

  const grantMut = useMutation({
    mutationFn: () =>
      grantAccess({
        portal_user_id: form.portal_user_id,
        resource_type: form.resource_type,
        resource_id: form.resource_id,
        permission: form.permission,
        expires_at: form.expires_at || null,
      }),
    onSuccess: (rule) => {
      addToast({
        type: 'success',
        title: t('portal.access_granted', { defaultValue: 'Access granted' }),
      });
      onGranted(rule);
      onClose();
    },
    onError: (err) => addToast({ type: 'error', title: getErrorMessage(err) }),
  });

  const canSubmit =
    form.portal_user_id && form.resource_type && form.resource_id.length > 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {t('portal.grant_access', { defaultValue: 'Grant Access' })}
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
          <div>
            <label className={labelCls}>
              {t('portal.user', { defaultValue: 'Portal user' })} *
            </label>
            <select
              value={form.portal_user_id}
              onChange={(e) => setForm({ ...form, portal_user_id: e.target.value })}
              className={inputCls}
            >
              <option value="">— {t('common.select', { defaultValue: 'Select' })} —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.portal_role})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('portal.resource_type', { defaultValue: 'Resource type' })} *
              </label>
              <select
                value={form.resource_type}
                onChange={(e) => setForm({ ...form, resource_type: e.target.value })}
                className={inputCls}
              >
                <option value="project">project</option>
                <option value="development">development</option>
                <option value="document">document</option>
                <option value="ticket">ticket</option>
                <option value="invoice">invoice</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {t('portal.permission', { defaultValue: 'Permission' })}
              </label>
              <select
                value={form.permission}
                onChange={(e) =>
                  setForm({ ...form, permission: e.target.value as AccessPermission })
                }
                className={inputCls}
              >
                {PERMISSIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {t('portal.resource_id', { defaultValue: 'Resource ID (UUID)' })} *
            </label>
            <input
              value={form.resource_id}
              onChange={(e) => setForm({ ...form, resource_id: e.target.value })}
              className={inputCls}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('portal.expires', { defaultValue: 'Expires (optional)' })}
            </label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={grantMut.isPending}
            icon={<Plus size={14} />}
            onClick={() => grantMut.mutate()}
          >
            {t('portal.grant', { defaultValue: 'Grant' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
