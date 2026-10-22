import type { ContentPart, Resource } from '@personal-os/contracts';
import { ArtifactPreview } from './ArtifactPreview';
import { Markdown } from './Markdown';

/**
 * The body of a message.
 *
 * An agent's words are Markdown, drawn as text: headings, lists, tables and
 * code blocks, and raw HTML shown as the characters it is. A file or an
 * artifact is an attach block, and a picture is a picture.
 */
export interface MessageBodyProps {
  /** The parts of the message, in the order they were written. */
  parts: ContentPart[];
  /** The resources the message points at, by id. */
  resources: Record<string, Resource>;
  /** The names of the people in the room, so a mention can be marked. */
  mentions: string[];
  /** The hue of a mentioned name, so a mention wears its agent's colour. */
  hueOf?: (name: string) => number | undefined;
}

export function MessageBody({
  parts,
  resources,
  mentions,
  hueOf,
}: MessageBodyProps): React.JSX.Element {
  if (parts.length === 0) {
    return <p className="text-xs italic text-slate-500">No content</p>;
  }
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <Markdown key={`text-${index}`} source={part.text} mentions={mentions} hueOf={hueOf} />
          );
        }
        if (part.type === 'image') {
          return (
            <ArtifactPreview
              key={`${part.type}-${index}`}
              kind="image"
              displayName={part.displayName}
              url={part.url ?? null}
              resource={resources[part.resourceId] ?? null}
            />
          );
        }
        return (
          <ArtifactPreview
            key={`${part.type}-${index}`}
            kind={
              part.type === 'artifact'
                ? 'artifact'
                : part.type === 'attachment'
                  ? 'attachment'
                  : 'file'
            }
            displayName={part.type === 'attachment' ? part.displayName : null}
            resource={resources[part.resourceId] ?? null}
          />
        );
      })}
    </div>
  );
}
