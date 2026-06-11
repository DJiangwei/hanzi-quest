'use client';

import { HOME_ROOMS, type HomeRoomId } from '@/lib/home/rooms';

interface Props {
  activeRoom: HomeRoomId;
  onSwitch: (room: HomeRoomId) => void;
}

/**
 * Three room-switching tabs.
 * Each button is ≥44px tall to satisfy touch-target requirements.
 */
export function RoomTabs({ activeRoom, onSwitch }: Props) {
  return (
    <div role="tablist" aria-label="Rooms" className="flex gap-1.5">
      {HOME_ROOMS.map((room) => {
        const isActive = room.id === activeRoom;
        return (
          <button
            key={room.id}
            role="tab"
            aria-selected={isActive}
            data-testid={`room-tab-${room.id}`}
            onClick={() => onSwitch(room.id)}
            className={[
              'flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--color-ocean-700)] text-white shadow-md'
                : 'bg-white/70 text-[var(--color-ocean-800)] hover:bg-white/90',
            ].join(' ')}
          >
            <span className="text-base leading-none">{room.emoji}</span>
            <span className="mt-0.5 text-xs leading-none">{room.nameZh}</span>
          </button>
        );
      })}
    </div>
  );
}
