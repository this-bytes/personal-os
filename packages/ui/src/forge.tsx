import * as React from 'react';
import { cn } from './lib/utils.js';

/**
 * The room's field, the counter band and the constellation.
 *
 * These are the parts the Forge rooms are built from, and they are here
 * because they are not Personal OS's business: they know about shapes and
 * counts, not about agents, threads or tasks. What they draw is passed to
 * them.
 *
 * They take their colours from the token layer through CSS variables rather
 * than from hexes in this file. A colour belongs to the token layer; see
 * `apps/web/src/index.css`.
 */

/** The field behind a room: a slow wash of colour, with nothing on top of it. */
export function AuroraField({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
      style={{
        background:
          'radial-gradient(70% 55% at 18% -8%, color-mix(in oklab, var(--color-structure) 34%, transparent), transparent 68%),' +
          'radial-gradient(55% 45% at 86% -4%, color-mix(in oklab, var(--color-data) 20%, transparent), transparent 70%),' +
          'radial-gradient(90% 70% at 50% 120%, color-mix(in oklab, var(--color-structure) 16%, transparent), transparent 70%)',
      }}
    />
  );
}

/** One number on the band. */
export interface Counter {
  /** The machine-readable name of the counter. */
  key: string;
  /** What the owner reads above the number. */
  label: string;
  /** How many. */
  value: number;
  /**
   * What the number means when it is read.
   *
   * `live` is for work that is happening now or waiting on the owner, `data`
   * is for a number about what has been produced, and `plain` is everything
   * else.
   */
  tone?: 'plain' | 'live' | 'data';
}

/**
 * The band of counts above a room.
 *
 * A counter is a count and never a ratio: the band says how many, and a share
 * is only shown when there is something to divide by.
 */
export function CounterBand({
  counters,
  className,
}: {
  counters: Counter[];
  className?: string;
}): React.JSX.Element {
  return (
    <dl className={cn('flex flex-wrap items-stretch gap-2', className)}>
      {counters.map((counter) => (
        <div
          key={counter.key}
          className={cn(
            'min-w-[7.5rem] rounded-lg border px-3 py-2',
            counter.tone === 'live'
              ? 'border-accent-border bg-accent-surface'
              : counter.tone === 'data'
                ? 'border-slate-800 bg-slate-900/60'
                : 'border-slate-800/70 bg-slate-900/30',
          )}
        >
          <dt
            className={cn(
              'text-[11px] uppercase tracking-wide',
              counter.tone === 'live' ? 'text-accent-text' : 'text-slate-500',
            )}
          >
            {counter.label}
          </dt>
          <dd
            className={cn(
              'text-xl font-semibold tabular-nums',
              counter.tone === 'live' ? 'text-accent-text' : 'text-slate-100',
            )}
          >
            {counter.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One thing in the picture. */
export interface ConstellationNode {
  id: string;
  /** What the owner reads beside it. */
  label: string;
  /** Where it sits, from 0 to 1 on each axis. */
  x: number;
  y: number;
  /** How big it is, as a fraction of the picture's width. */
  radius: number;
  /** The hue it wears, in degrees. A hue is an identity, never a meaning. */
  hue?: number;
  /** Whether it is moving right now. */
  active?: boolean;
  /** Whether it is the shape of a thread rather than the shape of an agent. */
  thread?: boolean;
}

/** A line between two things in the picture. */
export interface ConstellationEdge {
  from: string;
  to: string;
  /** Whether the line carries something that is moving right now. */
  active?: boolean;
}

export interface ConstellationProps {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  /** What the centre of the picture is. */
  coreLabel?: string;
  /**
   * Whether every node is labelled.
   *
   * A picture that has grown stops labelling everything: past a point the
   * labels are the noise and the shape is the information. The caller decides
   * when the picture is big enough, because only the caller knows what the
   * picture means.
   */
  labelled?: boolean;
  /**
   * What happens when a thing in the picture is chosen.
   *
   * The picture does not know where a choice leads, so it only says that one
   * was made.
   */
  onSelect?: (nodeId: string) => void;
  className?: string;
}

/**
 * A picture of a system.
 *
 * The picture is drawn from the positions it is given: the layout is the
 * caller's business, and this draws what the layout says. The same positions
 * always draw the same picture.
 */
export function Constellation({
  nodes,
  edges,
  coreLabel,
  labelled = true,
  onSelect,
  className,
}: ConstellationProps): React.JSX.Element {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const width = 100;
  const height = 62;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={
        coreLabel
          ? `A picture of the system, with ${coreLabel} at the centre.`
          : 'A picture of the system.'
      }
    >
      {edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={`${edge.from}->${edge.to}`}
            x1={from.x * width}
            y1={from.y * height}
            x2={to.x * width}
            y2={to.y * height}
            stroke={edge.active ? 'var(--color-data)' : 'var(--color-slate-700)'}
            strokeWidth={edge.active ? 0.5 : 0.3}
            strokeOpacity={edge.active ? 0.9 : 0.6}
          />
        );
      })}

      {nodes.map((node) => {
        const cx = node.x * width;
        const cy = node.y * height;
        const r = Math.max(1.1, node.radius * width);
        const fill = node.thread ? 'var(--color-slate-800)' : `hsl(${node.hue ?? 200} 68% 58%)`;
        const pickable = onSelect !== undefined;
        return (
          <g
            key={node.id}
            onClick={pickable ? () => onSelect(node.id) : undefined}
            onKeyDown={
              pickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }
                : undefined
            }
            role={pickable ? 'button' : undefined}
            tabIndex={pickable ? 0 : undefined}
            aria-label={pickable ? node.label : undefined}
            className={pickable ? 'cursor-pointer outline-none' : undefined}
          >
            <title>{node.label}</title>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              fillOpacity={node.thread ? 0.9 : 0.85}
              stroke={node.active ? 'var(--color-data)' : 'transparent'}
              strokeWidth={node.active ? 0.6 : 0}
            />
            {labelled ? (
              <text
                x={cx}
                y={cy + r + 2.4}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: 2.1 }}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        );
      })}

      <circle
        cx={width / 2}
        cy={height / 2}
        r={2.6}
        fill="var(--color-slate-100)"
        fillOpacity={0.9}
      />
      {coreLabel ? (
        <text
          x={width / 2}
          y={height / 2 + 6}
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 2.4 }}
        >
          {coreLabel}
        </text>
      ) : null}
    </svg>
  );
}
