import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AtSign, Paperclip, Send, Upload, X } from 'lucide-react';
import { Button, Textarea, cn } from '@personal-os/ui';
import type { MessageDelivery, Participant, Resource, RoutingMode } from '@personal-os/contracts';
import { errorMessage, readFileAsBase64, uploadResourceFile } from '../lib/api';
import { isAPicture } from '../lib/chat';
import { useWorkspace } from '../state/workspace';

interface MentionQuery {
  start: number;
  query: string;
}

/** A resource the owner attached to the message. */
export interface ComposerAttachment {
  resourceId: string;
  displayName: string;
  mimeType?: string;
}

/** How an upload is going. */
interface UploadState {
  /** The name of the file, so the owner can see which one this is about. */
  name: string;
  state: 'uploading' | 'uploaded' | 'failed';
  /** The server's sentence, when the upload failed. */
  message?: string;
}

/** What a message is sent with. */
export interface ComposerSendOptions {
  /**
   * How the message reaches an agent.
   *
   * `queue` is the default and waits for the next turn. `steer` would go
   * into the turn that is running — and the composer refuses to offer it
   * when the runtime cannot take it, because a steer that quietly became a
   * queue is a lie the owner did not agree to.
   */
  delivery: MessageDelivery;
  /** The resources the message points at. */
  attachments: ComposerAttachment[];
}

interface ComposerProps {
  participants: Participant[];
  disabled?: boolean;
  placeholder?: string;
  /** The delivery mode the message will be sent with. */
  delivery?: MessageDelivery;
  /** Whether the runtime can take the message into the running turn. */
  steer?: { available: boolean; reason: string | null };
  /**
   * Whether the room's agents can carry what the owner attaches.
   *
   * A room with no agent that can take one refuses the file, and says which
   * agent cannot take it. A file the owner attaches and the runtime never
   * sees is a file the owner believes was read.
   *
   * A picture is a separate verdict, because a route that takes a file's words
   * is not thereby a route that takes a picture's bytes.
   */
  attachments?: {
    /** Whether the room can carry a file's content. */
    available: boolean;
    /** Why not, when it cannot. */
    reason: string | null;
    /** Whether the room can carry a picture. */
    pictures: boolean;
    /** Why not, when it cannot. */
    pictureReason: string | null;
  };
  /** The resources the owner may attach. */
  attachable?: Resource[];
  /** The conversation's routing mode, for the bar under the composer. */
  routingMode?: RoutingMode;
  /** The chain depth the conversation is at. */
  depth?: number;
  /** The turn budget of the conversation. */
  maxTurns?: number;
  onSend: (text: string, options: ComposerSendOptions) => void | Promise<void>;
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
 * Why the room cannot carry this thing, when it cannot.
 *
 * A file's content and a picture's bytes travel on two capabilities, so the
 * refusal is decided by what the thing is. The reason is the server's own:
 * the room's agents are what decide, and the panel says which agent cannot.
 */
function refusalFor(
  state: ComposerProps['attachments'],
  mimeType: string | undefined,
): string | null {
  if (!state) return null;
  if (isAPicture(mimeType)) {
    if (state.pictures) return null;
    return state.pictureReason ?? 'This room cannot carry a picture.';
  }
  if (state.available) return null;
  return state.reason ?? 'This room cannot carry an attachment.';
}

/**
 * The content type of a resource the owner may attach, when it is a file.
 *
 * The resource's own row knows what its bytes are; the resource's type is the
 * product's word for it, and for an uploaded file that word is "document".
 */
function mimeTypeOf(resource: Resource): string | undefined {
  const data = resource.data as { kind?: unknown; mimeType?: unknown } | undefined;
  if (data?.kind !== 'file') return undefined;
  return typeof data.mimeType === 'string' ? data.mimeType : undefined;
}

/**
 * The message composer.
 *
 * Typing `@` opens an autocomplete over the agent participants of the
 * conversation. The mention is inserted as `@DisplayName`, which is exactly
 * what the server-side routing engine resolves.
 *
 * Two things the prototype had and the panel did not:
 *
 * - The **delivery** of the message is said out loud. A message sent while a
 *   turn is running is either for that turn or for the next one, and the
 *   owner picks. It is never turned into the other one behind their back.
 * - The **budgets** are beside the composer: the routing mode, the depth and
 *   the turn limit, so the limits are visible while the owner types.
 *
 * A file the owner chooses is uploaded, and the resource it becomes is
 * attached exactly as a resource they picked from the workspace would be.
 */
export function Composer({
  participants,
  disabled,
  placeholder = 'Write a message. Use @Name to address an agent.',
  delivery = 'queue',
  steer,
  attachments: attachmentsState,
  attachable = [],
  routingMode,
  depth = 0,
  maxTurns,
  onSend,
}: ComposerProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeWorkspaceId } = useWorkspace();

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

  /**
   * Upload a file, and attach the resource it becomes.
   *
   * The file is read in the browser, sent as base64, and the resource the
   * server answers with is attached exactly as a resource the owner picked
   * from the workspace would be.
   *
   * **A thing the room cannot carry is refused before it is uploaded.** A
   * picture the runtime never sees is a picture the owner believes was shown,
   * and the room's agents are what decide. The refusal is said in the
   * server's own words.
   */
  const handleFile = async (file: File): Promise<void> => {
    const refusal = refusalFor(attachmentsState, file.type);
    if (refusal) {
      setUpload({ name: file.name, state: 'failed', message: refusal });
      return;
    }
    setUpload({ name: file.name, state: 'uploading' });
    try {
      const contentBase64 = await readFileAsBase64(file);
      const resource = await uploadResourceFile({
        workspaceId: activeWorkspaceId ?? '',
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
      });
      setAttachments((current) =>
        current.some((item) => item.resourceId === resource.id)
          ? current
          : [
              ...current,
              {
                resourceId: resource.id,
                displayName: resource.title,
                mimeType: file.type,
              },
            ],
      );
      setUpload({ name: file.name, state: 'uploaded' });
    } catch (error) {
      // The server's sentence, as it is. A client that reworded it would be
      // telling the owner something the server knows better.
      setUpload({ name: file.name, state: 'failed', message: errorMessage(error) });
    }
  };

  const submit = async (): Promise<void> => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || busy) return;
    if (delivery === 'steer' && steer && !steer.available) return;
    setBusy(true);
    try {
      await onSend(trimmed, { delivery, attachments });
      setText('');
      setCaret(0);
      setMention(null);
      setAttachments([]);
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
  const steerBlocked = delivery === 'steer' && steer !== undefined && !steer.available;
  /**
   * Whether the room can carry nothing at all.
   *
   * A room that can take a file but not a picture still offers the upload: the
   * refusal is decided by what the owner picked, and said when they pick it.
   */
  const nothingCanBeCarried =
    attachmentsState !== undefined && !attachmentsState.available && !attachmentsState.pictures;

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

      {pickerOpen ? (
        <div className="absolute bottom-full right-0 z-20 mb-1.5 w-72 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <div className="border-b border-slate-800 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            Attach a resource
          </div>
          {attachable.length === 0 ? (
            <p className="px-2.5 py-2 text-[11px] text-slate-400">
              There is no resource to attach yet. You can upload a file instead.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {attachable.map((resource) => (
                <li key={resource.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setAttachments((current) =>
                        current.some((item) => item.resourceId === resource.id)
                          ? current
                          : [
                              ...current,
                              {
                                resourceId: resource.id,
                                displayName: resource.title,
                                mimeType: mimeTypeOf(resource) ?? resource.type,
                              },
                            ],
                      );
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                    <span className="font-mono text-[10px] text-slate-500">{resource.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 shadow-xs transition-colors focus-within:border-slate-600">
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 px-2 pt-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.resourceId}
                className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300"
              >
                <Paperclip className="h-3 w-3 text-slate-500" />
                <span className="max-w-[16rem] truncate">{attachment.displayName}</span>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.displayName}`}
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.resourceId !== attachment.resourceId),
                    )
                  }
                  className="text-slate-500 hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {upload ? (
          <p
            className={cn(
              'px-2 pt-2 text-[11px]',
              upload.state === 'failed' ? 'text-red-300' : 'text-slate-500',
            )}
          >
            {upload.state === 'uploading' ? `Uploading ${upload.name}…` : null}
            {upload.state === 'uploaded' ? `Uploaded ${upload.name}.` : null}
            {upload.state === 'failed' ? upload.message : null}
          </p>
        ) : null}

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
          className="min-h-[72px] resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-hidden"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPickerOpen((open) => !open)}
              aria-label="Attach a resource"
              title={
                nothingCanBeCarried
                  ? (attachmentsState?.reason ?? 'This room cannot carry an attachment.')
                  : 'Attach a resource that already exists'
              }
              disabled={disabled || nothingCanBeCarried}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label="Choose a file to upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // The input is cleared, so the same file can be chosen again.
                event.target.value = '';
                if (file) void handleFile(file);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload a file"
              title={
                nothingCanBeCarried
                  ? (attachmentsState?.reason ?? 'This room cannot carry an attachment.')
                  : 'Upload a file from this machine'
              }
              disabled={
                disabled ||
                !activeWorkspaceId ||
                upload?.state === 'uploading' ||
                nothingCanBeCarried
              }
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={
              disabled ||
              busy ||
              steerBlocked ||
              (text.trim().length === 0 && attachments.length === 0)
            }
            aria-label={delivery === 'steer' ? 'Send into the running turn' : 'Send message'}
            title={steerBlocked ? (steer?.reason ?? 'This message cannot be steered.') : undefined}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{delivery === 'steer' ? 'Steer' : 'Send'}</span>
          </Button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
        {routingMode ? (
          <span className="rounded border border-slate-800 px-1.5 py-px font-mono text-slate-500">
            {routingMode}
          </span>
        ) : null}
        <span className="font-mono">depth {depth}</span>
        {maxTurns !== undefined ? <span className="font-mono">max {maxTurns} turns</span> : null}
        {nothingCanBeCarried && attachmentsState?.reason ? (
          <span className="text-slate-500">{attachmentsState.reason}</span>
        ) : null}
        <span>Enter sends · Shift+Enter adds a line · type @ to address a participant</span>
      </div>
    </div>
  );
}
