/**
 * Authentication state.
 *
 * The instance is single-owner: the first visit runs setup, every later
 * visit signs in with a session cookie. The bootstrap sequence is
 * `GET /api/auth/status` followed by `GET /api/auth/me`.
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
import { ApiError, api, errorMessage } from '../lib/api';
import type { AuthUser } from '../lib/types';

export type AuthStatus = 'loading' | 'setup_required' | 'authenticated' | 'anonymous' | 'offline';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  setupRequired: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  setup: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setError(null);
    try {
      const statusResponse = await api.get<{ setupRequired: boolean }>('/auth/status');
      setSetupRequired(statusResponse.setupRequired);

      if (statusResponse.setupRequired) {
        setUser(null);
        setStatus('setup_required');
        return;
      }

      try {
        const me = await api.get<{ user: AuthUser }>('/auth/me');
        setUser(me.user);
        setStatus('authenticated');
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          setUser(null);
          setStatus('anonymous');
          return;
        }
        throw cause;
      }
    } catch (cause) {
      setUser(null);
      setError(errorMessage(cause));
      // The instance could not be reached at all, so neither login nor setup
      // is possible until the API comes back.
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await api.post<{ user: AuthUser; expiresAt: string }>('/auth/login', {
      email,
      password,
    });
    setUser(response.user);
    setError(null);
    setStatus('authenticated');
  }, []);

  const setup = useCallback(
    async (input: { email: string; password: string; displayName: string }): Promise<void> => {
      const response = await api.post<{ user: AuthUser; expiresAt: string }>('/auth/setup', input);
      setUser(response.user);
      setSetupRequired(false);
      setError(null);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post<{ ok: boolean }>('/auth/logout');
    } catch {
      // A failed logout still drops the client session.
    }
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, setupRequired, error, refresh, login, setup, logout }),
    [status, user, setupRequired, error, refresh, login, setup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
