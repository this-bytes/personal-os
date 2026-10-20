import { ChevronRight } from 'lucide-react';
import { Badge } from '@personal-os/ui';
import type { Resource } from '@personal-os/contracts';

interface ResourceListProps {
  resources: Resource[];
  onOpen: (resource: Resource) => void;
}

function preview(data: unknown): string {
  try {
    const text = JSON.stringify(data, null, 2);
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch {
    return String(data);
  }
}

/** The resources of one workspace, newest first. */
export function ResourceList({ resources, onOpen }: ResourceListProps): React.JSX.Element {
  return (
    <ul className="space-y-1.5">
      {resources.map((resource) => (
        <li key={resource.id}>
          <button
            type="button"
            onClick={() => onOpen(resource)}
            className="group flex w-full items-start gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-slate-100">
                  {resource.title}
                </span>
                <Badge variant="outline">{resource.type}</Badge>
                <Badge variant="default">rev {resource.revision}</Badge>
              </div>
              <pre className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-slate-500">
                {preview(resource.data)}
              </pre>
            </div>
            <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" />
          </button>
        </li>
      ))}
    </ul>
  );
}
