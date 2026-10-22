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
import { featureRoutes, landingPath } from './features/registry';

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
 *
 * The routes themselves belong to the features: each feature says which
 * routes it owns, and the panel is built out of those. So a route is added by
 * adding a feature, and this file does not grow.
 */

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
                    <Route path="/" element={<Navigate to={landingPath} replace />} />
                    {featureRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={<LazyRoute load={route.load} />}
                      />
                    ))}
                  </Route>
                  <Route path="*" element={<Navigate to={landingPath} replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </EventsProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
