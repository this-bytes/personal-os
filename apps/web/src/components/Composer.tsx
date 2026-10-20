import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AtSign, Send } from 'lucide-react';
import { Button, Textarea, cn } from '@personal-os/ui';
import type { Participant } from '@personal-os/contracts';

interface MentionQuery {
  start: number;
  query: string;
}

interface ComposerProps {
  participants: Participant[];
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
}

/** Find an `@token` that ends exactly at the caret. */
function mentionAt(text: string, caret: number): MentionQuery | null {
  const upto = text.slice(0, caret);
  const match = /@([\p{L}\p{N}._-]*)$/u.exec(upto);
  if (!match) return null;
  const token = match[0];
  return { start: caret - token.length, query: match[1] ?? '' };
}

/**
 * The message composer.
 *
 * Typing `@` opens an autocomplete over the agent participants of the
 * conversation. The mention is inserted as `@DisplayName`, which is exactly
 * what the server-side routing engine resolves.
 */
export function Composer({
  participants,
  disabled,
  placeholder = 'Write a message. Use @Name to address an agent.',
  onSend,
}: ComposerProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const candidates = useMemo(() => {
    const agents = participants.filter(
      (participant): participant is Participant & { agentConnectionId: string } =>
        participant.type === 'agent' && typeof participant.agentConnectionId === 'string',
    );
    const query = mention?.query.toLowerCase() ?? '';
    if (!query) return agents;
    return agents.filter((participant) => {
      const name = participant.displayName.toLowerCase();
      return name.startsWith(query) || name.includes(query);
    });
  }, [participants, mention]);

  useEffect(() => {
    setHighlight(0);
  }, [mention?.query, mention?.start]);

  const update = (value: string, position: number): void => {
    setText(value);
    setCaret(position);
    setMention(mentionAt(value, position));
  };

  const insert = (name: string): void => {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const next = `${before}@${name} ${after}`;
    const position = before.length + name.length + 2;
    setText(next);
    setCaret(position);
    setMention(null);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(position, position);
    });
  };

  const submit = async (): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSend(trimmed);
      setText('');
      setCaret(0);
      setMention(null);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mention && candidates.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % candidates.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((current) => (current - 1 + candidates.length) % candidates.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const candidate = candidates[highlight];
        if (candidate) insert(candidate.displayName);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const dropdownOpen = mention !== null && candidates.length > 0;

  return (
    <div className="relative">
      {dropdownOpen ? (
        <div className="absolute bottom-full left-0 z-20 mb-1.5 w-full max-w-sm overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <div className="border-b border-slate-800 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            Mention an agent
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {candidates.map((candidate, index) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insert(candidate.displayName);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs',
                    index === highlight ? 'bg-indigo-500/20 text-indigo-100' : 'text-slate-300',
                  )}
                >
                  <AtSign className="h-3 w-3" />
                  <span className="min-w-0 flex-1 truncate">{candidate.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) =>
            update(event.target.value, event.target.selectionStart ?? event.target.value.length)
          }
          onKeyUp={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onClick={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={handleKeyDown}
          className="min-h-[72px] resize-y"
        />
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={disabled || busy || text.trim().length === 0}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        Enter sends · Shift+Enter adds a line · type @ to address a participant
      </p>
    </div>
  );
}
