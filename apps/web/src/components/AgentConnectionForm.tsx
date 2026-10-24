import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AdapterPreset, AdapterType, Persona } from '@personal-os/contracts';
import { adapterTypeLabels } from '@personal-os/contracts';
import { CircleCheck, Info } from 'lucide-react';
import {
  Badge,
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
import { findPreset, presetsForType } from '../lib/presets';
import { Field } from './Field';

export interface AgentFormInput {
  name: string;
  adapterType: AdapterType;
  config: Record<string, unknown> | null;
  secrets: Record<string, string> | null;
  enabled?: boolean;
  /** The base persona of this agent. `null` means it has none. */
  persona: Persona | null;
  /**
   * The preset this connection was started from.
   *
   * The server applies it as the base the configuration is laid over, and
   * takes its persona when the owner wrote none.
   */
  presetId?: string | null;
}

interface AgentConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentConnectionDetail | null;
  busy?: boolean;
  error?: string | null;
  /** The preset catalogue. Without it the form still works, template-free. */
  presets?: AdapterPreset[];
  /** The preset to start from, when the owner chose one before opening. */
  initialPresetId?: string | null;
  onSubmit: (input: AgentFormInput) => void;
}

export interface FormState {
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
  mcpTransport: 'stdio' | 'http';
  mcpUrl: string;
  mcpToolName: string;
  mcpArgumentTemplate: string;
  mcpAllowedTools: string;
  mcpProtocolVersion: string;
  codexSandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  codexModel: string;
  codexEphemeral: boolean;
  codexSkipGitRepoCheck: boolean;
  /**
   * The App Server keeps its thread unless it is told not to.
   *
   * The command line route and the App Server route disagree about the
   * default — one keeps a session by default and the other throws it away —
   * so they do not share one field.
   */
  codexAppServerEphemeral: boolean;
  /** When the App Server may ask the owner for permission. */
  codexApprovalPolicy: 'untrusted' | 'on-request' | 'never';
  /** The provider Pi asks for, in Pi's own `provider/model` form. */
  piProvider: string;
  /** The model Pi asks for. */
  piModel: string;
  /**
   * Whether Pi keeps its session on disk after the turn.
   *
   * A kept session is a session the next turn resumes, so this is the same
   * question the App Server's own row asks — asked of the file Pi keeps.
   */
  piEphemeral: boolean;
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
  mcpTransport: 'stdio',
  mcpUrl: '',
  mcpToolName: '',
  mcpArgumentTemplate: '{"message":"{{message}}"}',
  mcpAllowedTools: '',
  mcpProtocolVersion: '2025-06-18',
  codexSandbox: 'read-only',
  codexModel: '',
  codexEphemeral: true,
  codexSkipGitRepoCheck: true,
  codexAppServerEphemeral: false,
  codexApprovalPolicy: 'on-request',
  piProvider: '',
  piModel: '',
  piEphemeral: false,
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
    case 'mcp':
      return {
        transport: form.mcpTransport,
        ...(form.mcpTransport === 'stdio'
          ? {
              command: form.command.trim(),
              args: parseLines(form.args),
              ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
              env: parseKeyValues(form.env),
            }
          : { url: form.mcpUrl.trim() }),
        protocolVersion: form.mcpProtocolVersion.trim() || '2025-06-18',
        toolName: form.mcpToolName.trim(),
        argumentTemplate: form.mcpArgumentTemplate.trim() || '{"message":"{{message}}"}',
        allowedTools: parseLines(form.mcpAllowedTools),
        timeoutSeconds: toNumber(form.timeoutSeconds, 600),
      };
    case 'codex':
      return {
        command: form.command.trim(),
        args: parseLines(form.args),
        ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
        env: parseKeyValues(form.env),
        sandbox: form.codexSandbox,
        skipGitRepoCheck: form.codexSkipGitRepoCheck,
        ephemeral: form.codexEphemeral,
        ...(form.codexModel.trim() ? { model: form.codexModel.trim() } : {}),
        timeoutSeconds: toNumber(form.timeoutSeconds, 900),
      };
    case 'codex-app-server':
      return {
        command: form.command.trim(),
        args: parseLines(form.args),
        ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
        env: parseKeyValues(form.env),
        sandbox: form.codexSandbox,
        approvalPolicy: form.codexApprovalPolicy,
        ephemeral: form.codexAppServerEphemeral,
        ...(form.codexModel.trim() ? { model: form.codexModel.trim() } : {}),
        timeoutSeconds: toNumber(form.timeoutSeconds, 900),
      };
    case 'pi':
      return {
        command: form.command.trim(),
        args: parseLines(form.args),
        ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
        env: parseKeyValues(form.env),
        ...(form.piProvider.trim() ? { provider: form.piProvider.trim() } : {}),
        ...(form.piModel.trim() ? { model: form.piModel.trim() } : {}),
        // The session is kept unless the owner says otherwise, because a kept
        // session is what the next turn resumes.
        ephemeral: form.piEphemeral,
        timeoutSeconds: toNumber(form.timeoutSeconds, 900),
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
  if (type === 'a2a' || type === 'http' || type === 'mcp') return 'authToken';
  return null;
}

/**
 * The form fields a preset fills in.
 *
 * A preset's configuration is the shape the server stores; the form's state
 * is flat, one field per input. This is the one place the two are
 * translated, so the rest of the form never has to know a preset exists.
 */
export function formValuesFromPreset(preset: AdapterPreset): Partial<FormState> {
  const config = preset.config as unknown as Record<string, unknown>;
  const text = (key: string, fallback = ''): string =>
    typeof config[key] === 'string' ? (config[key] as string) : fallback;
  const count = (key: string, fallback: number): number =>
    typeof config[key] === 'number' ? (config[key] as number) : fallback;
  const list = (key: string): string[] =>
    Array.isArray(config[key]) ? (config[key] as unknown[]).map((value) => String(value)) : [];
  const keyValues = (key: string): string[] => {
    const value = config[key];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value as Record<string, unknown>).map(
      ([name, item]) => `${name}=${String(item)}`,
    );
  };
  const headerLines = (key: string): string[] => {
    const value = config[key];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value as Record<string, unknown>).map(
      ([name, item]) => `${name}: ${String(item)}`,
    );
  };

  switch (preset.adapterType) {
    case 'cli': {
      const mode = text('promptMode', 'stdin');
      return {
        command: text('command'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        promptMode: mode === 'arg' || mode === 'file' ? mode : 'stdin',
        promptArg: text('promptArg', '--prompt'),
        timeoutSeconds: String(count('timeoutSeconds', 600)),
      };
    }
    case 'acp':
      return {
        command: text('command'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        timeoutSeconds: String(count('timeoutSeconds', 900)),
      };
    case 'a2a':
      return {
        baseUrl: text('baseUrl'),
        agentCardPath: text('agentCardPath', '/.well-known/agent-card.json'),
        messageUrl: text('messageUrl', 'message/send'),
        timeoutSeconds: String(count('timeoutSeconds', 600)),
      };
    case 'http':
      return {
        baseUrl: text('baseUrl'),
        path: text('path', '/chat'),
        method: text('method', 'POST') === 'PUT' ? 'PUT' : 'POST',
        headers: headerLines('headers').join('\n'),
        bodyTemplate: text('bodyTemplate', '{"message":"{{message}}","context":"{{context}}"}'),
        responseTextPath: text('responseTextPath', 'message'),
        sse: config['sse'] === true,
        sseTextPath: text('sseTextPath'),
        authHeader: text('authHeader', 'Authorization'),
        authScheme: text('authScheme', 'Bearer'),
        timeoutSeconds: String(count('timeoutSeconds', 600)),
      };
    case 'model':
      return {
        baseUrl: text('baseUrl'),
        model: text('model'),
        temperature: String(count('temperature', 0.7)),
        maxTokens: String(count('maxTokens', 4096)),
        systemPrompt: text('systemPrompt'),
        apiKeyHeader: text('apiKeyHeader', 'Authorization'),
        apiKeyScheme: text('apiKeyScheme', 'Bearer'),
        timeoutSeconds: String(count('timeoutSeconds', 600)),
      };
    case 'mcp':
      return {
        mcpTransport: text('transport', 'stdio') === 'http' ? 'http' : 'stdio',
        command: text('command'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        mcpUrl: text('url'),
        mcpProtocolVersion: text('protocolVersion', '2025-06-18'),
        mcpToolName: text('toolName'),
        mcpArgumentTemplate: text('argumentTemplate', '{"message":"{{message}}"}'),
        mcpAllowedTools: list('allowedTools').join('\n'),
        timeoutSeconds: String(count('timeoutSeconds', 600)),
      };
    case 'codex': {
      const sandbox = text('sandbox', 'read-only');
      return {
        command: text('command'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        codexSandbox:
          sandbox === 'workspace-write' || sandbox === 'danger-full-access' ? sandbox : 'read-only',
        codexModel: text('model'),
        codexEphemeral: config['ephemeral'] !== false,
        codexSkipGitRepoCheck: config['skipGitRepoCheck'] !== false,
        timeoutSeconds: String(count('timeoutSeconds', 900)),
      };
    }
    case 'codex-app-server': {
      const sandbox = text('sandbox', 'read-only');
      const approvalPolicy = text('approvalPolicy', 'on-request');
      return {
        command: text('command'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        codexSandbox:
          sandbox === 'workspace-write' || sandbox === 'danger-full-access' ? sandbox : 'read-only',
        codexApprovalPolicy:
          approvalPolicy === 'untrusted' || approvalPolicy === 'never'
            ? approvalPolicy
            : 'on-request',
        codexModel: text('model'),
        codexAppServerEphemeral: config['ephemeral'] === true,
        timeoutSeconds: String(count('timeoutSeconds', 900)),
      };
    }
    case 'pi':
      return {
        command: text('command', 'pi'),
        args: list('args').join('\n'),
        cwd: text('cwd'),
        env: keyValues('env').join('\n'),
        piProvider: text('provider'),
        piModel: text('model'),
        piEphemeral: config['ephemeral'] === true,
        timeoutSeconds: String(count('timeoutSeconds', 900)),
      };
    case 'echo':
    default:
      return {
        reply: text('reply'),
        delayMs: String(count('delayMs', 0)),
      };
  }
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
  presets = [],
  initialPresetId = null,
  onSubmit,
}: AgentConnectionFormProps): React.JSX.Element {
  const isEdit = Boolean(agent);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [replaceConfig, setReplaceConfig] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  /** The template the owner is starting from, if any. */
  const [presetId, setPresetId] = useState('');

  const secretField = useMemo(() => secretFieldFor(form.adapterType), [form.adapterType]);

  const available = useMemo(
    () => presetsForType(presets, form.adapterType),
    [presets, form.adapterType],
  );
  const selected = useMemo(() => findPreset(presets, presetId), [presets, presetId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /**
   * Lay a template into the form: its configuration, and the persona it
   * starts the agent with. Every field stays editable afterwards.
   */
  const applyPreset = (preset: AdapterPreset): void => {
    setForm((current) => ({
      ...current,
      adapterType: preset.adapterType,
      ...formValuesFromPreset(preset),
      role: preset.persona.role ?? current.role,
      personaInstructions: preset.persona.instructions ?? current.personaInstructions,
    }));
    setPresetId(preset.id);
  };

  const reset = (): void => {
    const preset = agent ? undefined : findPreset(presets, initialPresetId);
    setForm(
      agent
        ? {
            ...EMPTY,
            name: agent.name,
            adapterType: agent.adapterType,
            role: agent.persona?.role ?? '',
            personaInstructions: agent.persona?.instructions ?? '',
          }
        : preset
          ? {
              ...EMPTY,
              adapterType: preset.adapterType,
              ...formValuesFromPreset(preset),
              role: preset.persona.role ?? '',
              personaInstructions: preset.persona.instructions ?? '',
            }
          : EMPTY,
    );
    setPresetId(preset?.id ?? '');
    setReplaceConfig(false);
    setLocalError(null);
  };

  // A template the owner chose on the page is laid into the form when the
  // form opens. The effect watches the id and not the catalogue, so a
  // catalogue that reloads cannot overwrite what the owner has edited.
  useEffect(() => {
    if (!open || isEdit || !initialPresetId) return;
    const preset = findPreset(presets, initialPresetId);
    if (preset) applyPreset(preset);
  }, [open, initialPresetId]);

  /** The owner chose a template, or chose none. */
  const handlePresetChange = (value: string): void => {
    setPresetId(value);
    if (!value) return;
    const preset = findPreset(presets, value);
    if (preset) applyPreset(preset);
  };

  /**
   * The owner chose an adapter type. A template belongs to one type, so a
   * template of another type stops being the template.
   */
  const handleAdapterTypeChange = (type: AdapterType): void => {
    setForm((current) => ({ ...current, adapterType: type }));
    const current_ = findPreset(presets, presetId);
    if (current_ && current_.adapterType !== type) setPresetId('');
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
      if (
        form.adapterType === 'cli' ||
        form.adapterType === 'acp' ||
        form.adapterType === 'codex' ||
        form.adapterType === 'codex-app-server' ||
        form.adapterType === 'pi'
      ) {
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
      if (form.adapterType === 'mcp') {
        if (form.mcpTransport === 'stdio' && !form.command.trim()) {
          setLocalError('A command is required to start the MCP server.');
          return;
        }
        if (form.mcpTransport === 'http' && !form.mcpUrl.trim()) {
          setLocalError('A URL is required to reach the MCP server.');
          return;
        }
        if (!form.mcpToolName.trim()) {
          setLocalError('A tool name is required: a turn calls one tool.');
          return;
        }
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
      // The template the connection was started from, so the server can lay
      // it under the configuration as well.
      presetId: presetId.length > 0 ? presetId : null,
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
                onChange={(event) => handleAdapterTypeChange(event.target.value as AdapterType)}
              >
                {(Object.keys(adapterTypeLabels) as AdapterType[]).map((type) => (
                  <option key={type} value={type}>
                    {adapterTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!isEdit && available.length > 0 ? (
            <div className="space-y-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Start from a template
              </p>
              <Field
                label="Template"
                htmlFor="agent-preset"
                hint="A template fills the fields below. Every field stays editable, and a template is only a starting point."
              >
                <Select
                  id="agent-preset"
                  value={presetId}
                  onChange={(event) => handlePresetChange(event.target.value)}
                >
                  <option value="">No template — fill the fields yourself</option>
                  {available.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {selected ? (
                <div className="space-y-2">
                  <p className="text-xs leading-snug text-slate-300">{selected.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selected.verified ? (
                      <Badge variant="success">
                        <CircleCheck className="h-3 w-3" />
                        demonstrated here
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <Info className="h-3 w-3" />
                        not demonstrated
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">
                    {selected.verified
                      ? 'This template has been demonstrated in this repository.'
                      : 'A starting template. What the agent actually supports is discovered when the connection is probed.'}
                  </p>

                  {selected.evidence ? (
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
                      <p className="pos-field-label">What the demonstration rests on</p>
                      <p className="text-[11px] leading-snug text-slate-400">
                        {selected.evidence.runtime}
                        {selected.evidence.version ? ` ${selected.evidence.version}` : ''} —{' '}
                        {selected.evidence.demonstratedOn}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">
                        {selected.evidence.observed}
                      </p>
                    </div>
                  ) : null}

                  {selected.requires.length > 0 ? (
                    <div>
                      <p className="pos-field-label">What you still have to supply</p>
                      <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-slate-400">
                        {selected.requires.map((requirement) => (
                          <li key={requirement}>{requirement}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.credential ? (
                    <p className="text-[11px] leading-snug text-slate-500">
                      This connection needs a{' '}
                      {selected.credential === 'apiKey' ? 'API key' : 'auth token'}. Enter it in the
                      credential field below: it is encrypted at rest and never returned.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

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

              {form.adapterType === 'codex' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Command" htmlFor="codex-command">
                      <Input
                        id="codex-command"
                        value={form.command}
                        onChange={(event) => set('command', event.target.value)}
                        placeholder="codex"
                      />
                    </Field>
                    <Field label="Arguments" htmlFor="codex-args" hint="One argument per line.">
                      <Input
                        id="codex-args"
                        value={form.args}
                        onChange={(event) => set('args', event.target.value)}
                        placeholder="(none)"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Working directory"
                      htmlFor="codex-cwd"
                      hint="Where Codex works. Empty means the server's own directory."
                    >
                      <Input
                        id="codex-cwd"
                        value={form.cwd}
                        onChange={(event) => set('cwd', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field
                      label="Sandbox"
                      htmlFor="codex-sandbox"
                      hint="What Codex is allowed to do to your files."
                    >
                      <Select
                        id="codex-sandbox"
                        value={form.codexSandbox}
                        onChange={(event) =>
                          set('codexSandbox', event.target.value as FormState['codexSandbox'])
                        }
                      >
                        <option value="read-only">read-only — cannot change files</option>
                        <option value="workspace-write">workspace-write — may change files</option>
                        <option value="danger-full-access">danger-full-access — no boundary</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Model"
                      htmlFor="codex-model"
                      hint="Empty means Codex's own choice."
                    >
                      <Input
                        id="codex-model"
                        value={form.codexModel}
                        onChange={(event) => set('codexModel', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field label="Timeout (seconds)" htmlFor="codex-timeout">
                      <Input
                        id="codex-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Environment"
                    htmlFor="codex-env"
                    hint="KEY=VALUE, one per line. Codex signs in with its own account, so no credential belongs here."
                  >
                    <Textarea
                      id="codex-env"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.env}
                      onChange={(event) => set('env', event.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-start gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-indigo-500"
                        checked={form.codexEphemeral}
                        onChange={(event) => set('codexEphemeral', event.target.checked)}
                      />
                      <span>
                        Keep no session on disk
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          A kept session lets Codex carry on where it left off. Turned on, the
                          session is thrown away when the turn ends.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-indigo-500"
                        checked={form.codexSkipGitRepoCheck}
                        onChange={(event) => set('codexSkipGitRepoCheck', event.target.checked)}
                      />
                      <span>
                        Run outside a git repository
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          Codex refuses to work outside a repository unless it is told it may.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {form.adapterType === 'codex-app-server' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Command"
                      htmlFor="codex-app-server-command"
                      hint="The Codex executable. The App Server is started from it."
                    >
                      <Input
                        id="codex-app-server-command"
                        value={form.command}
                        onChange={(event) => set('command', event.target.value)}
                        placeholder="codex"
                      />
                    </Field>
                    <Field
                      label="Arguments"
                      htmlFor="codex-app-server-args"
                      hint="One argument per line, placed before the app-server subcommand."
                    >
                      <Input
                        id="codex-app-server-args"
                        value={form.args}
                        onChange={(event) => set('args', event.target.value)}
                        placeholder="(none)"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Working directory"
                      htmlFor="codex-app-server-cwd"
                      hint="Where Codex works. Empty means the server's own directory."
                    >
                      <Input
                        id="codex-app-server-cwd"
                        value={form.cwd}
                        onChange={(event) => set('cwd', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field
                      label="Sandbox"
                      htmlFor="codex-app-server-sandbox"
                      hint="What Codex is allowed to do to your files."
                    >
                      <Select
                        id="codex-app-server-sandbox"
                        value={form.codexSandbox}
                        onChange={(event) =>
                          set('codexSandbox', event.target.value as FormState['codexSandbox'])
                        }
                      >
                        <option value="read-only">read-only — cannot change files</option>
                        <option value="workspace-write">workspace-write — may change files</option>
                        <option value="danger-full-access">danger-full-access — no boundary</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Permission requests"
                      htmlFor="codex-app-server-approval-policy"
                      hint="When Codex may ask you for permission before it acts."
                    >
                      <Select
                        id="codex-app-server-approval-policy"
                        value={form.codexApprovalPolicy}
                        onChange={(event) =>
                          set(
                            'codexApprovalPolicy',
                            event.target.value as FormState['codexApprovalPolicy'],
                          )
                        }
                      >
                        <option value="untrusted">untrusted — ask before anything</option>
                        <option value="on-request">on-request — ask when it wants to act</option>
                        <option value="never">never — decide for itself</option>
                      </Select>
                    </Field>
                    <Field
                      label="Model"
                      htmlFor="codex-app-server-model"
                      hint="Empty means Codex's own choice."
                    >
                      <Input
                        id="codex-app-server-model"
                        value={form.codexModel}
                        onChange={(event) => set('codexModel', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Timeout (seconds)" htmlFor="codex-app-server-timeout">
                      <Input
                        id="codex-app-server-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                    <Field
                      label="Environment"
                      htmlFor="codex-app-server-env"
                      hint="KEY=VALUE, one per line. Codex signs in with its own account, so no credential belongs here."
                    >
                      <Textarea
                        id="codex-app-server-env"
                        className="min-h-[60px] font-mono text-xs"
                        value={form.env}
                        onChange={(event) => set('env', event.target.value)}
                      />
                    </Field>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-indigo-500"
                      checked={form.codexAppServerEphemeral}
                      onChange={(event) => set('codexAppServerEphemeral', event.target.checked)}
                    />
                    <span>
                      Keep no session on disk
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        A kept session lets the next turn go back into the same thread. Turned on,
                        the thread is thrown away when the turn ends, and the conversation starts
                        afresh every time.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {form.adapterType === 'pi' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Command"
                      htmlFor="pi-command"
                      hint="The Pi executable. Pi is started from it and speaks its own protocol."
                    >
                      <Input
                        id="pi-command"
                        value={form.command}
                        onChange={(event) => set('command', event.target.value)}
                        placeholder="pi"
                      />
                    </Field>
                    <Field
                      label="Arguments"
                      htmlFor="pi-args"
                      hint="One argument per line, before Pi's own --mode."
                    >
                      <Input
                        id="pi-args"
                        value={form.args}
                        onChange={(event) => set('args', event.target.value)}
                        placeholder="(none)"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Working directory"
                      htmlFor="pi-cwd"
                      hint="Where Pi works. Empty means the server's own directory."
                    >
                      <Input
                        id="pi-cwd"
                        value={form.cwd}
                        onChange={(event) => set('cwd', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field
                      label="Timeout (seconds)"
                      htmlFor="pi-timeout"
                      hint="How long one turn may take before it is given up on."
                    >
                      <Input
                        id="pi-timeout"
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Provider"
                      htmlFor="pi-provider"
                      hint="Which provider Pi asks, in Pi's own provider/model form. Empty lets Pi choose."
                    >
                      <Input
                        id="pi-provider"
                        value={form.piProvider}
                        onChange={(event) => set('piProvider', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                    <Field
                      label="Model"
                      htmlFor="pi-model"
                      hint="Which model Pi asks for. Empty lets Pi choose."
                    >
                      <Input
                        id="pi-model"
                        value={form.piModel}
                        onChange={(event) => set('piModel', event.target.value)}
                        placeholder="(optional)"
                      />
                    </Field>
                  </div>
                  <Field
                    label="Environment"
                    htmlFor="pi-env"
                    hint="KEY=VALUE, one per line. Pi signs in with its own account, so no credential belongs here."
                  >
                    <Textarea
                      id="pi-env"
                      className="min-h-[60px] font-mono text-xs"
                      value={form.env}
                      onChange={(event) => set('env', event.target.value)}
                    />
                  </Field>
                  <label className="flex items-start gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-indigo-500"
                      checked={form.piEphemeral}
                      onChange={(event) => set('piEphemeral', event.target.checked)}
                    />
                    <span>
                      Keep no session on disk
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        A kept session lets the next turn go back into the same session. Turned on,
                        Pi's session is thrown away when the turn ends, and the conversation starts
                        afresh every time.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {form.adapterType === 'mcp' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Transport" htmlFor="mcp-transport">
                      <Select
                        id="mcp-transport"
                        value={form.mcpTransport}
                        onChange={(event) =>
                          set('mcpTransport', event.target.value as 'stdio' | 'http')
                        }
                      >
                        <option value="stdio">stdio (a command the server starts)</option>
                        <option value="http">http (a URL the server answers on)</option>
                      </Select>
                    </Field>
                    <Field label="Tool a turn calls" htmlFor="mcp-tool-name">
                      <Input
                        id="mcp-tool-name"
                        value={form.mcpToolName}
                        onChange={(event) => set('mcpToolName', event.target.value)}
                        placeholder="message_bot"
                      />
                    </Field>
                  </div>

                  {form.mcpTransport === 'http' ? (
                    <Field label="Server URL" htmlFor="mcp-url">
                      <Input
                        id="mcp-url"
                        value={form.mcpUrl}
                        onChange={(event) => set('mcpUrl', event.target.value)}
                        placeholder="https://mcp.example.com/mcp"
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label="Command" htmlFor="mcp-command">
                        <Input
                          id="mcp-command"
                          value={form.command}
                          onChange={(event) => set('command', event.target.value)}
                          placeholder="npx"
                        />
                      </Field>
                      <Field label="Arguments" htmlFor="mcp-args" hint="One argument per line.">
                        <Input
                          id="mcp-args"
                          value={form.args}
                          onChange={(event) => set('args', event.target.value)}
                          placeholder="-y&#10;@modelcontextprotocol/server-example"
                        />
                      </Field>
                      <Field
                        label="Environment"
                        htmlFor="mcp-env"
                        hint="KEY=VALUE entries, one per line. The server's own environment is not inherited."
                      >
                        <Input
                          id="mcp-env"
                          value={form.env}
                          onChange={(event) => set('env', event.target.value)}
                        />
                      </Field>
                    </>
                  )}

                  <Field
                    label="Argument template"
                    htmlFor="mcp-argument-template"
                    hint="JSON. {{message}} is the owner's message, {{context}} the conversation so far."
                  >
                    <Input
                      id="mcp-argument-template"
                      value={form.mcpArgumentTemplate}
                      onChange={(event) => set('mcpArgumentTemplate', event.target.value)}
                    />
                  </Field>

                  <Field
                    label="Allowed tools"
                    htmlFor="mcp-allowed-tools"
                    hint="One per line. Empty means the tool named above, and nothing else."
                  >
                    <Input
                      id="mcp-allowed-tools"
                      value={form.mcpAllowedTools}
                      onChange={(event) => set('mcpAllowedTools', event.target.value)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Protocol version" htmlFor="mcp-protocol-version">
                      <Input
                        id="mcp-protocol-version"
                        value={form.mcpProtocolVersion}
                        onChange={(event) => set('mcpProtocolVersion', event.target.value)}
                      />
                    </Field>
                    <Field label="Timeout (seconds)" htmlFor="mcp-timeout">
                      <Input
                        id="mcp-timeout"
                        type="number"
                        min={1}
                        value={form.timeoutSeconds}
                        onChange={(event) => set('timeoutSeconds', event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
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
