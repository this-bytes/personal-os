import { useEffect, useState, type FormEvent } from 'react';
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
  Textarea,
} from '@personal-os/ui';
import type { Automation, AutomationAction, AutomationTrigger } from '@personal-os/contracts';
import { triggerableEventTypes } from '@personal-os/contracts';
import type { AgentConnectionDetail, Resource } from '../lib/types';
import { Field } from './Field';

export interface AutomationFormInput {
  title: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

interface AutomationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: Automation | null;
  agents: AgentConnectionDetail[];
  resources: Resource[];
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: AutomationFormInput) => void;
}

const TRIGGER_TYPES: Array<{ value: AutomationTrigger['type']; label: string }> = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'event', label: 'Event' },
  { value: 'manual', label: 'Manual' },
];

const ACTION_TYPES: Array<{ value: AutomationAction['type']; label: string }> = [
  { value: 'agent.prompt', label: 'Prompt an agent' },
  { value: 'resource.refresh', label: 'Refresh a resource' },
  { value: 'http.request', label: 'HTTP request' },
];

/**
 * Create or edit an automation.
 *
 * The trigger decides when the automation fires, the action decides what
 * happens. A schedule needs either a cron expression or an interval.
 */
export function AutomationForm({
  open,
  onOpenChange,
  automation,
  agents,
  resources,
  busy,
  error,
  onSubmit,
}: AutomationFormProps): React.JSX.Element {
  const isEdit = Boolean(automation);

  const [title, setTitle] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>('schedule');
  const [cron, setCron] = useState('');
  const [everyMinutes, setEveryMinutes] = useState('');
  const [eventName, setEventName] = useState('');
  const [actionType, setActionType] = useState<AutomationAction['type']>('agent.prompt');
  const [agentConnectionId, setAgentConnectionId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<AutomationAction['method']>('GET');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (automation) {
      setTitle(automation.title);
      setTriggerType(automation.trigger.type);
      setCron(automation.trigger.cron ?? '');
      setEveryMinutes(
        automation.trigger.everyMinutes === undefined
          ? ''
          : String(automation.trigger.everyMinutes),
      );
      setEventName(automation.trigger.event ?? '');
      setActionType(automation.action.type);
      setAgentConnectionId(automation.action.agentConnectionId ?? '');
      setPrompt(automation.action.prompt ?? '');
      setResourceId(automation.action.resourceId ?? '');
      setUrl(automation.action.url ?? '');
      setMethod(automation.action.method);
    } else {
      setTitle('');
      setTriggerType('schedule');
      setCron('');
      setEveryMinutes('60');
      setEventName('');
      setActionType('agent.prompt');
      setAgentConnectionId('');
      setPrompt('');
      setResourceId('');
      setUrl('');
      setMethod('GET');
    }
  }, [open, automation]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setLocalError(null);

    if (!title.trim()) {
      setLocalError('A title is required.');
      return;
    }

    const trigger: AutomationTrigger = { type: triggerType };
    if (triggerType === 'schedule') {
      if (cron.trim()) trigger.cron = cron.trim();
      else if (everyMinutes.trim()) trigger.everyMinutes = Number(everyMinutes);
      else {
        setLocalError('A schedule trigger needs a cron expression or an interval.');
        return;
      }
    }
    if (triggerType === 'event') {
      if (!eventName.trim()) {
        setLocalError('An event trigger needs an event name.');
        return;
      }
      trigger.event = eventName.trim();
    }

    const action: AutomationAction = { type: actionType, method };
    if (actionType === 'agent.prompt') {
      if (!agentConnectionId) {
        setLocalError('This action needs an agent connection.');
        return;
      }
      action.agentConnectionId = agentConnectionId;
      action.prompt = prompt;
    }
    if (actionType === 'resource.refresh') {
      if (!resourceId) {
        setLocalError('This action needs a resource.');
        return;
      }
      action.resourceId = resourceId;
    }
    if (actionType === 'http.request') {
      if (!url.trim()) {
        setLocalError('This action needs a URL.');
        return;
      }
      action.url = url.trim();
    }

    onSubmit({ title: title.trim(), trigger, action });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${automation?.title}` : 'New automation'}</DialogTitle>
          <DialogDescription>
            Automations are disabled when they are created. Enable them once the trigger and the
            action are right.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Title" htmlFor="automation-title">
            <Input
              id="automation-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nightly research sweep"
            />
          </Field>

          <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <p className="pos-field-label">Trigger</p>
            <div className="space-y-3">
              <Select
                aria-label="Trigger type"
                value={triggerType}
                onChange={(event) =>
                  setTriggerType(event.target.value as AutomationTrigger['type'])
                }
              >
                {TRIGGER_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>

              {triggerType === 'schedule' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cron" htmlFor="automation-cron" hint="Five fields, or leave empty.">
                    <Input
                      id="automation-cron"
                      value={cron}
                      onChange={(event) => setCron(event.target.value)}
                      placeholder="0 3 * * *"
                    />
                  </Field>
                  <Field label="Every N minutes" htmlFor="automation-interval">
                    <Input
                      id="automation-interval"
                      type="number"
                      min={1}
                      value={everyMinutes}
                      onChange={(event) => setEveryMinutes(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {triggerType === 'event' ? (
                <Field
                  label="Event"
                  htmlFor="automation-event"
                  hint="The automation runs whenever this event is published."
                >
                  <Select
                    id="automation-event"
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                  >
                    <option value="">Choose an event…</option>
                    {triggerableEventTypes.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <p className="pos-field-label">Action</p>
            <div className="space-y-3">
              <Select
                aria-label="Action type"
                value={actionType}
                onChange={(event) => setActionType(event.target.value as AutomationAction['type'])}
              >
                {ACTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>

              {actionType === 'agent.prompt' ? (
                <>
                  <Field label="Agent connection" htmlFor="automation-agent">
                    <Select
                      id="automation-agent"
                      value={agentConnectionId}
                      onChange={(event) => setAgentConnectionId(event.target.value)}
                    >
                      <option value="">Choose an agent…</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Prompt"
                    htmlFor="automation-prompt"
                    hint="Supports {{context}}, {{event}}, {{eventType}} and {{title}} placeholders."
                  >
                    <Textarea
                      id="automation-prompt"
                      className="min-h-[70px]"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                    />
                  </Field>
                </>
              ) : null}

              {actionType === 'resource.refresh' ? (
                <Field label="Resource" htmlFor="automation-resource">
                  <Select
                    id="automation-resource"
                    value={resourceId}
                    onChange={(event) => setResourceId(event.target.value)}
                  >
                    <option value="">Choose a resource…</option>
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {actionType === 'http.request' ? (
                <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                  <Field label="Method" htmlFor="automation-method">
                    <Select
                      id="automation-method"
                      value={method}
                      onChange={(event) =>
                        setMethod(event.target.value as AutomationAction['method'])
                      }
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </Select>
                  </Field>
                  <Field label="URL" htmlFor="automation-url">
                    <Input
                      id="automation-url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://example.com/hook"
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </div>

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
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create automation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
