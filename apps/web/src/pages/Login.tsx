import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@personal-os/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../state/auth';
import { ErrorState, LoadingState } from '../components/ErrorState';
import { Field } from '../components/Field';

export function Login(): React.JSX.Element {
  const { status, setupRequired, error, login, setup, refresh } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'setup' | 'login'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'setup_required') setMode('setup');
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingState label="Contacting the Personal OS server…" />
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/conversations" replace />;
  }

  if (status === 'offline') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md">
          <ErrorState
            title="The Personal OS server is unreachable"
            message={error ?? 'The API did not answer. Start the server and try again.'}
            onRetry={() => void refresh()}
          />
        </div>
      </div>
    );
  }

  const isSetup = mode === 'setup';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (isSetup) {
        await setup({ email, password, displayName: displayName.trim() || 'Owner' });
      } else {
        await login(email, password);
      }
      navigate('/conversations', { replace: true });
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-bold text-indigo-300">
            P
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Personal OS</h1>
            <p className="text-xs text-slate-500">Self-hosted agent control panel</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              {isSetup ? (
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
              ) : (
                <KeyRound className="h-4 w-4 text-indigo-400" />
              )}
              <h2 className="text-sm font-semibold">
                {isSetup ? 'Create the owner account' : 'Sign in'}
              </h2>
            </div>

            {isSetup ? (
              <p className="mb-4 text-xs leading-relaxed text-slate-400">
                This instance has no owner yet. The account you create here owns every workspace and
                is the only identity that can reach the control panel.
              </p>
            ) : null}

            <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              {isSetup ? (
                <Field label="Display name" htmlFor="displayName">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Owner"
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </Field>

              <Field
                label="Password"
                htmlFor="password"
                hint={isSetup ? 'At least 8 characters.' : undefined}
              >
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={isSetup ? 8 : 1}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                />
              </Field>

              {formError ? (
                <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                  {formError}
                </p>
              ) : null}

              <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                {busy ? 'Working…' : isSetup ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            {setupRequired && !isSetup ? (
              <p className="mt-3 text-[11px] text-slate-500">
                This instance still needs an owner account.{' '}
                <button
                  type="button"
                  className="text-indigo-400 underline-offset-2 hover:underline"
                  onClick={() => setMode('setup')}
                >
                  Set it up
                </button>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-[11px] text-slate-600">
          Session is stored in an HttpOnly cookie. The API never exposes credentials to the browser.
        </p>
      </div>
    </div>
  );
}
