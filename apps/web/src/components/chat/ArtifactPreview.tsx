import { FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@personal-os/ui';
import type { Resource } from '@personal-os/contracts';
import { resourceContentUrl } from '../../lib/api';
import { plainText } from './markdownBlocks';

/**
 * The attach block.
 *
 * An artifact or a file in a message is shown the way the prototype showed
 * it: an icon, the name of the thing, and a quiet line that says what it is
 * and which revision of it this is. The content is there to be opened, not
 * to be read in the middle of a transcript.
 */

export interface ArtifactPreviewProps {
  /** The resource the part points at, when the panel has loaded it. */
  resource?: Resource | null;
  /** The name to show when the resource is not loaded. */
  displayName?: string | null;
  /** The kind of part this is. */
  kind?: 'artifact' | 'file' | 'attachment' | 'image';
  /** Where the bytes are, for an image. */
  url?: string | null;
  /** Whether to show the content as well as the name. */
  preview?: boolean;
  className?: string;
}

function when(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

/** Whether a resource is a file the owner uploaded. */
function isFileResource(resource: Resource | null | undefined): boolean {
  const data = resource?.data as { kind?: unknown } | undefined;
  return data?.kind === 'file';
}

export function ArtifactPreview({
  resource,
  displayName,
  kind = 'artifact',
  url,
  preview = false,
  className,
}: ArtifactPreviewProps): React.JSX.Element {
  const title = resource?.title ?? displayName ?? resource?.id ?? 'Untitled';
  const meta = [
    resource?.type ?? kind,
    resource ? `rev ${resource.revision}` : null,
    resource?.updatedAt ? `updated ${when(resource.updatedAt)}` : null,
  ].filter((part): part is string => Boolean(part));

  const isImage = kind === 'image' || (resource?.type ?? '').includes('image');

  /**
   * A file is something the owner can open.
   *
   * The bytes are served by the API, and the link points at that route — the
   * browser never learns where the server keeps them. Only a resource that is
   * a file gets the link: a document that is text has no bytes to open.
   */
  const isFile = isFileResource(resource);
  const contentUrl = resource ? resourceContentUrl(resource.id) : null;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2',
        className,
      )}
    >
      {isImage ? (
        <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
      ) : (
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-100">{title}</p>
        <p className="text-[11px] text-slate-500">{meta.join(' · ')}</p>

        {isImage && url ? (
          <img src={url} alt={title} className="mt-2 max-h-64 rounded border border-slate-800" />
        ) : null}

        {isFile && contentUrl ? (
          <a
            href={contentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
          >
            Open {title}
          </a>
        ) : null}

        {preview && resource ? (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 font-mono text-[10px] text-slate-300">
            {plainText(resource.data).slice(0, 2_000)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
