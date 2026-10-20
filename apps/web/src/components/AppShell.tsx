import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bot,
  Cog,
  Database,
  Factory,
  LogOut,
  Menu,
  MessagesSquare,
  Radio,
  Workflow,
  X,
} from 'lucide-react';
import { Button, Select } from '@personal-os/ui';
import { cn } from '@personal-os/ui';
import { useAuth } from '../state/auth';
import { useServerEvents } from '../state/events';
import { useWorkspace } from '../state/workspace';
import { LoadingState } from './ErrorState';

const NAV_ITEMS = [
  { to: '/conversations', label: 'Conversations', icon: MessagesSquare },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/factory', label: 'Factory', icon: Factory },
  { to: '/resources', label: 'Resources', icon: Database },
  { to: '/automations', label: 'Automations', icon: Workflow },
  { to: '/settings', label: 'Settings', icon: Cog },
];

function StreamIndicator(): React.JSX.Element {
  const { status } = useServerEvents();
  const tone =
    status === 'open'
      ? 'bg-emerald-400'
      : status === 'reconnecting'
        ? 'bg-amber-400'
        : status === 'error'
          ? 'bg-red-400'
          : 'bg-slate-600';
  const label =
    status === 'open'
      ? 'live'
      : status === 'reconnecting'
        ? 'reconnecting'
        : status === 'error'
          ? 'offline'
          : 'idle';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400"
      title={`Event stream: ${label}`}
    >
      <Radio className={cn('h-3 w-3', status === 'open' && 'text-emerald-400')} />
      <span className={cn('h-1.5 w-1.5 rounded-full', tone)} />
      {label}
    </span>
  );
}

export function AppShell(): React.JSX.Element {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { status: streamStatus } = useServerEvents();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full min-h-screen bg-slate-950 text-slate-100">
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-800 bg-slate-950 transition-transform md:static md:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/20 text-[13px] font-bold text-indigo-300">
              P
            </div>
            <span className="text-sm font-semibold tracking-tight">Personal OS</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-indigo-500/15 font-medium text-indigo-200'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <StreamIndicator />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs uppercase tracking-wide text-slate-500 sm:inline">
              Workspace
            </span>
            <Select
              aria-label="Active workspace"
              className="h-8 max-w-[15rem] text-xs"
              value={activeWorkspaceId ?? ''}
              onChange={(event) => setActiveWorkspaceId(event.target.value)}
            >
              {workspaces.length === 0 ? <option value="">No workspace</option> : null}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {streamStatus === 'reconnecting' || streamStatus === 'error' ? (
              <span className="hidden rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-[11px] text-amber-300 sm:inline">
                live updates interrupted
              </span>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight text-slate-200">
                {user?.displayName ?? 'Owner'}
              </p>
              <p className="text-[11px] leading-tight text-slate-500">{user?.email ?? ''}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleLogout()}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {/*
            The pages behind the login screen arrive as separate chunks. The
            boundary sits around the page content rather than around the whole
            shell, so a route that is still loading shows a fallback in place
            of the page while the navigation stays where it was.
          */}
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
