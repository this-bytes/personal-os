import { Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/auth';
import { EventsProvider } from './state/events';
import { queryClient } from './state/queryClient';
import { WorkspaceProvider } from './state/workspace';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ErrorState';
import { LazyRoute } from './components/LazyRoute';
import { Login } from './pages/Login';

/*
 * One chunk per route.
 *
 * The owner opens this panel all day and mostly stays on one screen at a
 * time. Imported eagerly, the browser downloads the agents page, the factory
 * board and the settings screen before the login screen can paint. Loading
 * each page on demand keeps the first paint to the shell plus the route that
 * was actually asked for.
 *
 * The login screen stays eager on purpose: it is the first thing the browser
 * paints, and a lazy import would put a second round trip in front of it to
 * save four kilobytes.
 *
 * The pages behind the login screen are wrapped in `LazyRoute`, which owns
 * the fallback for a chunk that is still on the wire and the error state for
 * a chunk that never arrives.
 */
const loadConversations = () =>
  import('./pages/Conversations').then((page) => ({ default: page.Conversations }));
const loadConversationDetail = () =>
  import('./pages/ConversationDetail').then((page) => ({ default: page.ConversationDetail }));
const loadAgents = () => import('./pages/Agents').then((page) => ({ default: page.Agents }));
const loadFactory = () => import('./pages/Factory').then((page) => ({ default: page.Factory }));
const loadResources = () =>
  import('./pages/Resources').then((page) => ({ default: page.Resources }));
const loadAutomations = () =>
  import('./pages/Automations').then((page) => ({ default: page.Automations }));
const loadSettings = () => import('./pages/Settings').then((page) => ({ default: page.Settings }));

/** Gate that only lets an authenticated owner into the control panel. */
function RequireAuth(): React.JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingState label="Contacting the Personal OS server…" />
      </div>
    );
  }

  if (status === 'setup_required' || status === 'anonymous' || status === 'offline') {
    return <Navigate to="/login" replace />;
  }

  return <OutletWithShell />;
}

function OutletWithShell(): React.JSX.Element {
  return <AppShell />;
}

/**
 * The fallback for a route outside the shell.
 *
 * Every page behind the login screen is wrapped in `LazyRoute`, which carries
 * its own closer boundary. This one catches anything that suspends above
 * those, so that a lazily loaded route can never leave the browser with a
 * blank screen.
 */
function RouteLoading(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <LoadingState label="Loading…" />
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <EventsProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/" element={<Navigate to="/conversations" replace />} />
                    <Route path="/conversations" element={<LazyRoute load={loadConversations} />} />
                    <Route
                      path="/conversations/:conversationId"
                      element={<LazyRoute load={loadConversationDetail} />}
                    />
                    <Route path="/agents" element={<LazyRoute load={loadAgents} />} />
                    <Route path="/factory" element={<LazyRoute load={loadFactory} />} />
                    <Route path="/resources" element={<LazyRoute load={loadResources} />} />
                    <Route path="/automations" element={<LazyRoute load={loadAutomations} />} />
                    <Route path="/settings" element={<LazyRoute load={loadSettings} />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/conversations" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </EventsProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
