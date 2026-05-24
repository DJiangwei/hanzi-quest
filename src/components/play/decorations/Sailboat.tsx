export function Sailboat() {
  return (
    <g aria-hidden>
      <path d="M -22 6 L 22 6 L 16 18 L -16 18 Z" fill="#8b4513" stroke="#5a2d0c" strokeWidth={1.5} />
      <line x1={0} y1={6} x2={0} y2={-26} stroke="#3a1f0c" strokeWidth={2} />
      <path d="M 0 -26 L 16 4 L 0 4 Z" fill="var(--color-sunset-400)" stroke="#a05028" strokeWidth={1.5} />
      <path d="M 0 -22 L -12 2 L 0 2 Z" fill="#fff4d4" stroke="#a05028" strokeWidth={1.5} />
      <path d="M 0 -26 L 6 -22 L 0 -20 Z" fill="#e74c3c" />
    </g>
  );
}
