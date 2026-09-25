import { memo } from "react";

const PALETTE = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f43f5e", // rose
];

const getColorForId = (id = "") => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const LiveCursors = ({ cursors }) => {
  const activeEntries = Object.entries(cursors || {}).filter(
    ([, data]) => data?.x != null && data?.y != null
  );

  if (activeEntries.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {activeEntries.map(([userId, { x, y, user }]) => {
        const color = getColorForId(userId);
        return (
          <div
            key={userId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate3d(${x}px, ${y}px, 0)`,
            }}
          >
            {/* Cursor arrow SVG */}
            <svg
              className="h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
              viewBox="0 0 16 16"
              fill={color}
              stroke="white"
              strokeWidth="1.2"
            >
              <polygon points="0,0 0,14 4,10 7,16 9,15 6,9 12,9" />
            </svg>

            {/* User name tag */}
            <span
              className="ml-3 inline-block -translate-y-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
              style={{ backgroundColor: color }}
            >
              {user?.name || "Teammate"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default memo(LiveCursors);
