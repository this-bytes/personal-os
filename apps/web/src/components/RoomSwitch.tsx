import { NavLink } from 'react-router-dom';
import { cn } from '@personal-os/ui';
import type { FeatureRoom } from '@personal-os/contracts';

/**
 * The room switch.
 *
 * The panel has rooms: places where work is looked at or decided. The switch
 * says which room the owner is in, and it is the way between them.
 *
 * It lives here rather than in the shared primitives because it is a link,
 * and the shared primitives do not know about the router: they draw, and the
 * application decides where a click leads.
 */
export function RoomSwitch({ rooms }: { rooms: FeatureRoom[] }): React.JSX.Element | null {
  if (rooms.length < 2) return null;

  return (
    <nav
      aria-label="Rooms"
      className="flex items-center gap-0.5 rounded-md border border-slate-800 bg-slate-900/60 p-0.5"
    >
      {rooms.map((room) => (
        <NavLink
          key={room.id}
          to={room.path}
          className={({ isActive }) =>
            cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-indigo-500/15 text-indigo-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            )
          }
        >
          {room.label}
        </NavLink>
      ))}
    </nav>
  );
}
