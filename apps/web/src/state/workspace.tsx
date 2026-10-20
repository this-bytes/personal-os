/**
 * The active workspace.
 *
 * A workspace is the unit of access scoping; every list in the app is
 * filtered by it. The selection is kept in local storage so a reload lands
 * back where the user left off.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Workspace } from '../lib/types';
import { useAuth } from './auth';

const STORAGE_KEY = 'personal-os.active-workspace';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  createWorkspace: (input: { name: string; description?: string }) => Promise<Workspace>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWorkspaceId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { status } = useAuth();
  const [storedId, setStoredId] = useState<string | null>(() => readStoredWorkspaceId());

  const query = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: () => api.get<{ workspaces: Workspace[] }>('/workspaces').then((r) => r.workspaces),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const workspaces = useMemo(() => query.data ?? [], [query.data]);

  const activeWorkspaceId = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (storedId && workspaces.some((workspace) => workspace.id === storedId)) return storedId;
    return workspaces[0]?.id ?? null;
  }, [workspaces, storedId]);

  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== storedId) {
      writeStoredWorkspaceId(activeWorkspaceId);
      setStoredId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, storedId]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    writeStoredWorkspaceId(id);
    setStoredId(id);
  }, []);

  const createWorkspace = useCallback(
    async (input: { name: string; description?: string }): Promise<Workspace> => {
      const response = await api.post<{ workspace: Workspace }>('/workspaces', {
        name: input.name,
        description: input.description ?? '',
      });
      setActiveWorkspaceId(response.workspace.id);
      return response.workspace;
    },
    [setActiveWorkspaceId],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      isLoading: query.isLoading,
      error: query.error instanceof Error ? query.error.message : null,
      createWorkspace,
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      query.isLoading,
      query.error,
      createWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside a WorkspaceProvider.');
  return context;
}
