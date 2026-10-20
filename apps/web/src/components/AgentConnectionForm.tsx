import { useMemo, useState, type FormEvent } from 'react';
import type { AdapterType, Persona } from '@personal-os/contracts';
import { adapterTypeLabels } from '@personal-os/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Switch,
  Textarea,
} from '@personal-os/ui';
import type { AgentConnectionDetail } from '../lib/types';
import { Field } from './Field';

export interface AgentFormInput {
  name: string;
  adapterType: AdapterType;
  config: Record<string, unknown> | null;
  secrets: Record<string, string> | null;
  enabled?: boolean;
  /** The base persona of this agent. `null` means it has none. */
  persona: Persona | null;
}

interface AgentConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentConnectionDetail | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: AgentFormInput) => void;
}

interface FormState {
  name: string;
  role: string;
  personaInstructions: string;
  adapterType: AdapterType;
  command: string;
  args: string;
  cwd: string;
  env: string;
  promptMode: 'stdin' | 'arg' | 'file';
  promptArg: string;
  timeoutSeconds: string;
  baseUrl: string;
  agentCardPath: string;
  messageUrl: string;
  model: string;
  temperature: string;
  maxTokens: string;
  systemPrompt: string;
  path: string;
  method: 'POST' | 'PUT';
  headers: string;
  bodyTemplate: string;
  responseTextPath: string;
  sse: boolean;
  sseTextPath: string;
  authHeader: string;
  authScheme: string;
  apiKeyHeader: string;
  apiKeyScheme: string;
  reply: string;
  delayMs: string;
  apiKey: string;
  authToken: string;
}

const EMPTY: FormState = {
  name: '',
  role: '',
  personaInstructions: '',
  adapterType: 'echo',
  command: '',
  args: '',
  cwd: '',
  env: '',
  promptMode: 'stdin',
  promptArg: '--prompt',
  timeoutSeconds: '600',
  baseUrl: '',
  agentCardPath: '/.well-known/agent-card.json',
  messageUrl: 'message/send',
  model: '',
  temperature: '0.7',
  maxTokens: '4096',
  systemPrompt: '',
  path: '/chat',
  method: 'POST',
  headers: '',
  bodyTemplate: '{"message":"{{message}}","context":"{{context}}"}',
  responseTextPath: 'message',
  sse: false,
  sseTextPath: '',
  authHeader: 'Authorization',
  authScheme: 'Bearer',
  apiKeyHeader: 'Authorization',
  apiKeyScheme: 'Bearer',
  reply: '',
  delayMs: '0',
  apiKey: '',
  authToken: '',
};

/** One entry per line. */
function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** `KEY=VALUE` entries, one per line. */
function parseKeyValues(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of parseLines(value)) {
    const index = line.indexOf('=');
    if (index <= 0) continue;
    out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return out;
}

/** `Key: Value` entries, one per line. */
function parseHeaders(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of parseLines(value)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return out;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Build the adapter configuration for the selected adapter type. */
export function buildAdapterConfig(type: AdapterType, form: FormState): Record<string, unknown> {
  switch (type) {
    case 'cli':
      return {
        command: form.command.trim(),
        args: parseLines(form.args),
        ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
        env: parseKeyValues(form.env),
        promptMode: form.promptMode,
        promptArg: form.promptArg.trim() || '--prompt',
        timeoutSeconds: toNumber(form.timeoutSeconds, 600),
      };
    case 'acp':
      return {
        command: form.command.trim(),
        args: parseLines(form.args),
        ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
        env: parseKeyValues(form.env),
        timeoutSeconds: toNumber(form.timeoutSeconds, 900),
      };
    case 'a2a':
      return {
        baseUrl: form.baseUrl.trim(),
        agentCardPath: form.agentCardPath.trim() || '/.well-known/agent-card.json',
        messageUrl: form.messageUrl.trim() || 'message/send',
        timeoutSeconds: toNumber(form.timeoutSeconds, 600),
      };
    case 'http':
      return {
        baseUrl: form.baseUrl.trim(),
        path: form.path.trim() || '/chat',
        method: form.method,
        headers: parseHeaders(form.headers),
        bodyTemplate: form.bodyTemplate,
        responseTextPath: form.responseTextPath.trim() || 'message',
        sse: form.sse,
        ...(form.sse && form.sseTextPath.trim() ? { sseTextPath: form.sseTextPath.trim() } : {}),
        authHeader: form.authHeader.trim() || 'Authorization',
        authScheme: form.authScheme.trim() || 'Bearer',
        timeoutSeconds: toNumber(form.timeoutSeconds, 600),
      };
    case 'model':
      return {
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        temperature: toNumber(form.temperature, 0.7),
        maxTokens: toNumber(form.maxTokens, 4096),
        ...(form.systemPrompt.trim() ? { systemPrompt: form.systemPrompt } : {}),
        apiKeyHeader: form.apiKeyHeader.trim() || 'Authorization',
        apiKeyScheme: form.apiKeyScheme.trim() || 'Bearer',
        timeoutSeconds: toNumber(form.timeoutSeconds, 600),
      };
    case 'echo':
    default:
      return {
        ...(form.reply.trim() ? { reply: form.reply } : {}),
        delayMs: toNumber(form.delayMs, 0),
      };
  }
}

/** Which credential field a given adapter type accepts. */
function secretFieldFor(type: AdapterType): 'apiKey' | 'authToken' | null {
  if (type === 'model') return 'apiKey';
  if (type === 'a2a' || type === 'http') return 'authToken';
  return null;
}

/**
 * The add / edit form for an agent connection.
 *
 * The configuration fields follow the selected adapter type. Credentials
 * never travel inside the configuration: they are sent as `secrets`, stored
 * server-side, and are never returned by the API.
 */
export function AgentConnectionForm({
  open,
  onOpenChange,
  agent,
  busy,
  error,
  onSubmit,
}: AgentConnectionFormProps): React.JSX.Element {
  const isEdit = Boolean(agent);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [replaceConfig, setReplaceConfig] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const secretField = useMemo(() => secretFieldFor(form.adapterType), [form.adapterType]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = (): void => {
    setForm(
      agent
        ? {
            ...EMPTY,
            name: agent.name,
            adapterType: agent.adapterType,
            role: agent.persona?.role ?? '',
            personaInstructions: agent.persona?.instructions ?? '',
          }
        : EMPTY,
    );
    setReplaceConfig(false);
    setLocalError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setLocalError(null);

    if (!form.name.trim()) {
      setLocalError('A connection needs a name.');
      return;
    }

    if (form.role.trim().length > 200) {
      setLocalError('The role is one line of up to 200 characters.');
      return;
    }

    if (form.personaInstructions.trim().length > 8_000) {
      setLocalError('The standing instructions are limited to 8,000 characters.');
      return;
    }

    let config: Record<string, unknown> | null = null;
    if (!isEdit || replaceConfig) {
      if (form.adapterType === 'cli' || form.adapterType === 'acp') {
        if (!form.command.trim()) {
          setLocalError('A command is required for this adapter.');
          return;
        }
      }
      if (
        form.adapterType === 'a2a' ||
        form.adapterType === 'http' ||
        form.adapterType === 'model'
      ) {
        if (!form.baseUrl.trim()) {
          setLocalError('A base URL is required for this adapter.');
          return;
        }
      }
      if (form.adapterType === 'model' && !form.model.trim()) {
        setLocalError('A model name is required for this adapter.');
        return;
      }
      config = buildAdapterConfig(form.adapterType, form);
    }

    const secrets: Record<string, string> = {};
    if (secretField === 'apiKey' && form.apiKey.trim()) secrets['apiKey'] = form.apiKey.trim();
    if (secretField === 'authToken' && form.authToken.trim()) {
      secrets['authToken'] = form.authToken.trim();
    }

    // The persona is optional in both directions: no role and no
    // instructions means the agent has no persona of its own.
    const role = form.role.trim();
    const instructions = form.personaInstructions.trim();
    const persona: Persona | null =
      role.length > 0 || instructions.length > 0
        ? {
            ...(role.length > 0 ? { role } : {}),
            ...(instructions.length > 0 ? { instructions } : {}),
          }
        : null;

    onSubmit({
      name: form.name.trim(),
      adapterType: form.adapterType,
      config,
      secrets: Object.keys(secrets).length > 0 ? secrets : null,
      persona,
      ...(isEdit ? { enabled: agent?.enabled ?? true } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${agent?.name}` : 'Add an agent connection'}</DialogTitle>
          <DialogDescription>
            A connection points at one agent. The server probes it on save and reports the real
            capabilities.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="agent-name">
              <Input
                id="agent-name"
                required
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Researcher"
              />
            </Field>

            <Field label="Adapter type" htmlFor="agent-adapter">
              <Select
                id="agent-adapter"
                value={form.adapterType}
                disabled={isEdit}
                onChange={(event) => set('adapterType', event.target.value as AdapterType)}
              >
                {(Object.keys(adapterTypeLabels) as AdapterType[]).map((type) => (
                  <option key={type} value={type}>
                    {adapterTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Persona
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Role"
                htmlFor="agent-persona-role"
                hint="One line, shown to you. Up to 200 characters."
              >
                <Input
                  id="agent-persona-role"
                  maxLength={200}
                  value={form.role}
                  onChange={(event) => set('role', event.target.value)}
                  placeholder="Research assistant"
                />
              </Field>
            </div>
            <Field
              label="Standing instructions"
              htmlFor="agent-persona-instructions"
              hint="Shown to the agent at the head of its turn. Up to 8,000 characters."
            >
              <Textarea
                id="agent-persona-instructions"
                maxLength={8_000}
                value={form.personaInstructions}
                onChange={(event) => set('personaInstructions', event.target.value)}
                placeholder="Answer with sources. Say so when you do not know."
              />
            </Field>
            <p className="text-[11px] leading-snug text-slate-500">
              The persona is what this agent is. A conversation can replace it for one participant,
              and the panel always shows which one is in force.
            </p>
          </div>

          {isEdit ? (
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-indigo-500"
                  checked={replaceConfig}
                  onChange={(event) => setReplaceConfig(event.target.checked)}
                />
                <span>
                  Replace the stored configuration.
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    The stored configuration is never sent to the browser, so it cannot be edited in
                    place. Replacing it also drops the stored credential — re-enter it below.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {!isEdit || replaceConfig ? (
            <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {adapterTypeLabels[form.adapterType]} configuration
              </p>

              {form.adapterType === 'echo' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Reply" htmlFor="echo-reply" hint="Text the agent answers with.">
                    <Input
                      id="echo-reply"
                      value={form.reply}
                      onChange={(event) => set('reply', event.target.value)}
                      placeholder="pong"
                    />
                  </Field>
                  <Field label="Delay (ms)" htmlFor="echo-delay">
                    <Input
                      id="echo-delay"
                      type="number"
                      min={0}
                      value={form.delayMs}
                      onChange={(event) => set('delayMs', event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {form.adapterType === 'cli' || form.adapterType === 'acp' ? (
                <>
                  <Field label="Command" htmlFor="agent-command">
                    <Input
                      id="agent-command"
                      value={form.command}
                      onChange={(event) => set('command', event.target.value)}
                      placeholder={form.adapterType === 'cli' ? 'claude' : 'acp-agent'}
                    />
                  </Field>
                  <Field label="Arguments" htmlFor="agent-args" hint="One argument per line.">
                    <Textarea
                      id="agent-args"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.args}
                      onChange={(event) => set('args', event.target.value)}
                      placeholder={'--print\n--model\nlocal'}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Working directory" htmlFor="agent-cwd">
                      <Input
                        id="agent-cwd"
                        value={form.cwd}
                        onChange={(event) => set('cwd', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field label="Timeout (seconds)" htmlFor="agent-timeout">
                      <Input
                        id="agent-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Environment" htmlFor="agent-env" hint="KEY=VALUE, one per line.">
                    <Textarea
                      id="agent-env"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.env}
                      onChange={(event) => set('env', event.target.value)}
                    />
                  </Field>
                  {form.adapterType === 'cli' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Prompt mode" htmlFor="agent-prompt-mode">
                        <Select
                          id="agent-prompt-mode"
                          value={form.promptMode}
                          onChange={(event) =>
                            set('promptMode', event.target.value as FormState['promptMode'])
                          }
                        >
                          <option value="stdin">stdin</option>
                          <option value="arg">argument</option>
                          <option value="file">file</option>
                        </Select>
                      </Field>
                      <Field label="Prompt argument" htmlFor="agent-prompt-arg">
                        <Input
                          id="agent-prompt-arg"
                          value={form.promptArg}
                          onChange={(event) => set('promptArg', event.target.value)}
                        />
                      </Field>
                    </div>
                  ) : null}
                </>
              ) : null}

              {form.adapterType === 'a2a' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Base URL" htmlFor="agent-base-url">
                    <Input
                      id="agent-base-url"
                      value={form.baseUrl}
                      onChange={(event) => set('baseUrl', event.target.value)}
                      placeholder="https://agent.example.com"
                    />
                  </Field>
                  <Field label="Timeout (seconds)" htmlFor="agent-timeout">
                    <Input
                      id="agent-timeout"
                      type="number"
                      min={1}
                      value={form.timeoutSeconds}
                      onChange={(event) => set('timeoutSeconds', event.target.value)}
                    />
                  </Field>
                  <Field label="Agent card path" htmlFor="agent-card-path">
                    <Input
                      id="agent-card-path"
                      value={form.agentCardPath}
                      onChange={(event) => set('agentCardPath', event.target.value)}
                    />
                  </Field>
                  <Field label="Message URL" htmlFor="agent-message-url">
                    <Input
                      id="agent-message-url"
                      value={form.messageUrl}
                      onChange={(event) => set('messageUrl', event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {form.adapterType === 'http' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Base URL" htmlFor="agent-base-url">
                      <Input
                        id="agent-base-url"
                        value={form.baseUrl}
                        onChange={(event) => set('baseUrl', event.target.value)}
                        placeholder="https://gateway.example.com"
                      />
                    </Field>
                    <Field label="Path" htmlFor="agent-path">
                      <Input
                        id="agent-path"
                        value={form.path}
                        onChange={(event) => set('path', event.target.value)}
                      />
                    </Field>
                    <Field label="Method" htmlFor="agent-method">
                      <Select
                        id="agent-method"
                        value={form.method}
                        onChange={(event) => set('method', event.target.value as 'POST' | 'PUT')}
                      >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </Select>
                    </Field>
                    <Field label="Timeout (seconds)" htmlFor="agent-timeout">
                      <Input
                        id="agent-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Body template" htmlFor="agent-body">
                    <Textarea
                      id="agent-body"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.bodyTemplate}
                      onChange={(event) => set('bodyTemplate', event.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Response text path" htmlFor="agent-response-path">
                      <Input
                        id="agent-response-path"
                        value={form.responseTextPath}
                        onChange={(event) => set('responseTextPath', event.target.value)}
                      />
                    </Field>
                    <Field label="SSE text path" htmlFor="agent-sse-path">
                      <Input
                        id="agent-sse-path"
                        value={form.sseTextPath}
                        onChange={(event) => set('sseTextPath', event.target.value)}
                        placeholder="(only for SSE)"
                      />
                    </Field>
                  </div>
                  <Field label="Headers" htmlFor="agent-headers" hint="Key: Value, one per line.">
                    <Textarea
                      id="agent-headers"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.headers}
                      onChange={(event) => set('headers', event.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <Switch checked={form.sse} onCheckedChange={(checked) => set('sse', checked)} />
                    The endpoint answers with a server-sent event stream
                  </label>
                </>
              ) : null}

              {form.adapterType === 'model' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Base URL" htmlFor="agent-base-url">
                      <Input
                        id="agent-base-url"
                        value={form.baseUrl}
                        onChange={(event) => set('baseUrl', event.target.value)}
                        placeholder="https://api.example.com/v1"
                      />
                    </Field>
                    <Field label="Model" htmlFor="agent-model">
                      <Input
                        id="agent-model"
                        value={form.model}
                        onChange={(event) => set('model', event.target.value)}
                        placeholder="gpt-4o-mini"
                      />
                    </Field>
                    <Field label="Temperature" htmlFor="agent-temperature">
                      <Input
                        id="agent-temperature"
                        type="number"
                        step={0.1}
                        min={0}
                        max={2}
                        value={form.temperature}
                        onChange={(event) => set('temperature', event.target.value)}
                      />
                    </Field>
                    <Field label="Max tokens" htmlFor="agent-max-tokens">
                      <Input
                        id="agent-max-tokens"
                        type="number"
                        min={1}
                        value={form.maxTokens}
                        onChange={(event) => set('maxTokens', event.target.value)}
                      />
                    </Field>
                    <Field label="Timeout (seconds)" htmlFor="agent-timeout">
                      <Input
                        id="agent-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="System prompt" htmlFor="agent-system-prompt">
                    <Textarea
                      id="agent-system-prompt"
                      className="min-h-[70px]"
                      value={form.systemPrompt}
                      onChange={(event) => set('systemPrompt', event.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          ) : null}

          {secretField ? (
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="pos-field-label">Credential</p>
              <Field
                label={secretField === 'apiKey' ? 'API key' : 'Auth token'}
                htmlFor="agent-secret"
                hint="Sent to the server as a secret. It is encrypted at rest and is never returned by the API — leave it empty to keep the current value."
              >
                <Input
                  id="agent-secret"
                  type="password"
                  value={secretField === 'apiKey' ? form.apiKey : form.authToken}
                  onChange={(event) =>
                    secretField === 'apiKey'
                      ? set('apiKey', event.target.value)
                      : set('authToken', event.target.value)
                  }
                  placeholder={secretField === 'apiKey' ? 'sk-…' : 'token…'}
                />
              </Field>
            </div>
          ) : null}

          {localError ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {localError}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create connection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
