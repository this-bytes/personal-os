import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@personal-os/ui';
import type { Participant, Persona } from '@personal-os/contracts';
import { Field } from './Field';

interface PersonaOverrideDialogProps {
  /** The participant whose persona is being edited. `null` closes the dialog. */
  participant: Participant | null;
  /** The connection's base persona — what an override replaces. */
  base?: Persona;
  busy?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (override: Persona | null) => void;
}

/**
 * The persona of one agent participant in one conversation.
 *
 * An override replaces the connection's base whole: a conversation that sets
 * only a role does not silently keep the connection's instructions, because a
 * half-overridden persona is a stranger.
 */
export function PersonaOverrideDialog({
  participant,
  base,
  busy,
  error,
  onOpenChange,
  onSubmit,
}: PersonaOverrideDialogProps): React.JSX.Element {
  const [role, setRole] = useState(participant?.personaOverride?.role ?? '');
  const [instructions, setInstructions] = useState(
    participant?.personaOverride?.instructions ?? '',
  );

  const override = role.trim().length > 0 || instructions.trim().length > 0;
  const hasOverride = Boolean(participant?.personaOverride);

  return (
    <Dialog open={participant !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Persona · {participant?.displayName}</DialogTitle>
          <DialogDescription>
            This persona applies to {participant?.displayName} in this conversation only. It
            replaces the connection's base persona whole — a role here does not keep the
            connection's instructions.
          </DialogDescription>
        </DialogHeader>

        {base ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
            The connection's base persona is{' '}
            <span className="text-slate-200">{base.role ?? 'no role'}</span>. An override replaces
            it.
          </p>
        ) : null}

        <div className="space-y-4">
          <Field
            label="Role"
            htmlFor="persona-override-role"
            hint="One line, shown to you. Up to 200 characters."
          >
            <Input
              id="persona-override-role"
              maxLength={200}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Research assistant"
            />
          </Field>

          <Field
            label="Standing instructions"
            htmlFor="persona-override-instructions"
            hint="Shown to the agent at the head of its turn. Up to 8,000 characters."
          >
            <Textarea
              id="persona-override-instructions"
              maxLength={8_000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Answer with sources. Say so when you do not know."
            />
          </Field>
        </div>

        {error ? (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {hasOverride ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onSubmit(null)}>
              Clear the override
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => {
              const trimmedRole = role.trim();
              const trimmedInstructions = instructions.trim();
              if (!override) {
                onSubmit(null);
                return;
              }
              onSubmit({
                ...(trimmedRole.length > 0 ? { role: trimmedRole } : {}),
                ...(trimmedInstructions.length > 0 ? { instructions: trimmedInstructions } : {}),
              });
            }}
          >
            Save the override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
