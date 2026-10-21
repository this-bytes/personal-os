import { useQuery } from '@tanstack/react-query';
import type { Measures, Resource } from '@personal-os/contracts';
import { Card, CardContent } from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import { useWorkspace } from '../state/workspace';
import { ErrorState, LoadingState } from './ErrorState';

/**
 * The author a resource carries when it has none to name.
 *
 * 'system' is what a row written before the author was recorded says, and
 * what a write with no authenticated actor behind it says. Those rows are in
 * the denominator and can never be in the count, which is what makes the
 * count of the resources an agent made a floor rather than a share.
 */
const NO_AUTHOR = 'system';

/**
 * The product's two measures of itself.
 *
 * The band ships only the counts it can defend. The first measure is the
 * count of the resources that record an agent as their author, over the
 * resources in the workspace, with the count of the resources that record no
 * author at all stated beside it.
 *
 * There is no ratio. A ratio is a claim, and both denominators are known to
 * be polluted, so neither measure is shown as a share. The second measure is
 * not a number at all: the audit trail records that something happened, not
 * what happened.
 */
export function MeasuresBand(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();

  const measures = useQuery<Measures>({
    queryKey: ['measures', activeWorkspaceId],
    queryFn: () => api.get<Measures>('/measures', { workspaceId: activeWorkspaceId ?? undefined }),
    enabled: Boolean(activeWorkspaceId),
  });

  /**
   * The resources that record no author at all.
   *
   * The published measures route carries the count of the resources an agent
   * made and the number of resources in the workspace, and it has no member
   * for this one. The resources list is the published surface that carries
   * each resource's author, so the band reads it there.
   */
  const resources = useQuery<Resource[]>({
    queryKey: ['resources', activeWorkspaceId, undefined],
    queryFn: () =>
      api
        .get<{
          resources: Resource[];
        }>('/resources', { workspaceId: activeWorkspaceId ?? undefined })
        .then((response) => response.resources),
    enabled: Boolean(activeWorkspaceId),
  });

  const measure = measures.data?.agentAuthoredResources;
  const count = measure?.count ?? 0;
  const total = measure?.denominator ?? 0;
  const withoutAuthor = (resources.data ?? []).filter(
    (resource) => resource.createdBy === NO_AUTHOR,
  ).length;

  /**
   * The caveat beside the count.
   *
   * The count is a floor, and it is a floor because of the resources that
   * record no author. If that count could not be loaded, the band says so
   * rather than leaving the caveat out: a floor presented as a share is the
   * lie the published contract warns about.
   */
  const caveat = resources.isError
    ? 'The count of the resources that record no author could not be loaded, so this count is a floor.'
    : withoutAuthor > 0
      ? `${withoutAuthor} of them record no author at all, so the count is a floor and not a share.`
      : null;

  return (
    <section className="space-y-2" aria-labelledby="measures-heading">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2
          id="measures-heading"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          What the product has measured
        </h2>
      </div>

      {measures.isError ? (
        <ErrorState
          title="The measures could not be loaded"
          message={errorMessage(measures.error)}
          onRetry={() => void measures.refetch()}
        />
      ) : null}

      {measures.isLoading ? <LoadingState label="Loading the measures…" /> : null}

      {measure ? (
        <Card>
          <CardContent className="space-y-3 p-3">
            <div>
              <p className="text-xs font-medium text-slate-200">Resources made by an agent</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                {total === 0
                  ? 'This workspace has no resources yet.'
                  : `${count} of ${total} ${total === 1 ? 'resource' : 'resources'} in this workspace record an agent as their author.`}
                {caveat ? ` ${caveat}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-200">Operations performed by an agent</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Not a number yet. The audit trail records that something happened, not what
                happened: every mutating route writes an entry, but the MCP surface writes none, and
                every entry records success regardless.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
