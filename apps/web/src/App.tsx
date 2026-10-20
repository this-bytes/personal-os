import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/auth';
import { EventsProvider } from './state/events';
import { queryClient } from './state/queryClient';
import { WorkspaceProvider } from './state/workspace';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ErrorState';
import { Login } from './pages/Login';
import { Conversations } from './pages/Conversations';
import { ConversationDetail } from './pages/ConversationDetail';
import { Agents } from './pages/Agents';
import { Factory } from './pages/Factory';
import { Resources } from './pages/Resources';
import { Automations } from './pages/Automations';
import { Settings } from './pages/Settings';

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

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <EventsProvider>
            <BrowserRouter>
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
            </BrowserRouter>
          </EventsProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
