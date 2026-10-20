import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/auth';
import { EventsProvider } from './state/events';
import { queryClient } from './state/queryClient';
import { WorkspaceProvider } from './state/workspace';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ErrorState';
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
 */
const Conversations = lazy(() =>
  import('./pages/Conversations').then((page) => ({ default: page.Conversations })),
);
const ConversationDetail = lazy(() =>
  import('./pages/ConversationDetail').then((page) => ({ default: page.ConversationDetail })),
);
const Agents = lazy(() => import('./pages/Agents').then((page) => ({ default: page.Agents })));
const Factory = lazy(() => import('./pages/Factory').then((page) => ({ default: page.Factory })));
const Resources = lazy(() =>
  import('./pages/Resources').then((page) => ({ default: page.Resources })),
);
const Automations = lazy(() =>
  import('./pages/Automations').then((page) => ({ default: page.Automations })),
);
const Settings = lazy(() =>
  import('./pages/Settings').then((page) => ({ default: page.Settings })),
);

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
 * The fallback for a route whose chunk is still on the wire.
 *
 * `AppShell` renders the closer boundary for every page behind the login
 * screen, so this one only catches a route outside the shell. It exists so
 * that a lazily loaded route can never leave the browser with a blank screen.
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
                    <Route path="/conversations" element={<Conversations />} />
                    <Route path="/conversations/:conversationId" element={<ConversationDetail />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/factory" element={<Factory />} />
                    <Route path="/resources" element={<Resources />} />
                    <Route path="/automations" element={<Automations />} />
                    <Route path="/settings" element={<Settings />} />
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
