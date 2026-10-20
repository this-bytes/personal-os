/**
 * The boundary around a page that arrives in its own chunk.
 *
 * Splitting the client into one chunk per route introduced a failure mode
 * that did not exist when the whole panel shipped as one file: the browser
 * can fail to download the code for a page, and `React.lazy` turns that
 * failure into a thrown error. With no boundary above the route, React
 * unmounts the whole tree and the owner is left looking at a blank page.
 *
 * The boundary sits per route rather than per application so that the shell
 * around it survives the failure. The navigation stays where it was, the
 * owner can leave for a page that did load, and the panel never renders a
 * blank screen.
 */
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { ErrorState, LoadingState } from './ErrorState';

/** How a page that arrives in its own chunk is loaded. */
export type RouteLoader = () => Promise<{ default: ComponentType }>;

interface RouteErrorBoundaryProps {
  /** The route content. */
  children: ReactNode;
  /** How many times the owner has asked for this page to be loaded again. */
  attempt: number;
  /** Ask for the page to be loaded again. */
  onRetry: () => void;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a route that could not be loaded.
 *
 * A class component because an error boundary is the one thing React still
 * only offers this way.
 */
class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  override state: RouteErrorBoundaryState = { error: null };

  // A static lifecycle: React declares it on the component type, not on the
  // class, so it cannot carry an `override` modifier.
  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(): void {
    // The owner already asked for this page once and it failed again. The
    // browser remembers a module that failed to load, so no further attempt
    // in this document can succeed: a new document is the only way forward.
    if (this.props.attempt > 0) {
      window.location.reload();
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.attempt > 0) {
      return (
        <ErrorState title="The page still could not be loaded" message="Reloading the panel…" />
      );
    }

    return (
      <ErrorState
        title="This page could not be loaded"
        message="The browser could not download the code for this page. It may have been renamed by a new deploy, or the request was dropped. The navigation still works: pick another page, or try again."
        onRetry={this.props.onRetry}
      />
    );
  }
}

interface RouteState {
  /** The loader of the page this component is showing. */
  load: RouteLoader;
  /** Counts every change of the page: another route, or another attempt. */
  generation: number;
  /** How many times the owner has retried this page. */
  attempt: number;
  /** The lazy component that loads the page. */
  Component: LazyExoticComponent<ComponentType>;
}

/**
 * A route that loads its page on demand.
 *
 * The page is a separate chunk, so it can arrive late or not at all. Both
 * cases are handled here: a chunk that is still on the wire shows a
 * fallback, and a chunk that cannot be loaded shows the error state with a
 * retry that can actually succeed.
 */
export function LazyRoute({ load }: { load: RouteLoader }): React.JSX.Element {
  const [route, setRoute] = useState<RouteState>(() => ({
    load,
    generation: 0,
    attempt: 0,
    Component: lazy(load),
  }));

  if (route.load !== load) {
    // The router renders every route in the same place, so this component is
    // reused when the owner moves to another page. It has to notice that it
    // is now showing a different page and start over, or the previous page
    // would stay on the screen and the new chunk would never be asked for.
    setRoute({
      load,
      generation: route.generation + 1,
      attempt: 0,
      Component: lazy(load),
    });
  }

  const retry = useCallback(() => {
    setRoute((current) => ({
      load: current.load,
      generation: current.generation + 1,
      attempt: current.attempt + 1,
      // React remembers the rejection of a dynamic import, so the same lazy
      // component would fail the same way forever. A new one turns the retry
      // into a real attempt instead of a replay of the same failure.
      Component: lazy(current.load),
    }));
  }, []);

  const { generation, attempt, Component } = route;

  return (
    <RouteErrorBoundary key={generation} attempt={attempt} onRetry={retry}>
      <Suspense fallback={<LoadingState />}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
  );
}
