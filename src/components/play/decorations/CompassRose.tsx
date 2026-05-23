export function CompassRose() {
  return (
    <g aria-hidden>
      <circle cx={0} cy={0} r={20} fill="#fff4d4" stroke="#a05028" strokeWidth={2} />
      <path d="M 0 -18 L 4 0 L 0 18 L -4 0 Z" fill="#a05028" />
      <path d="M -18 0 L 0 4 L 18 0 L 0 -4 Z" fill="#c9745a" />
      <circle cx={0} cy={0} r={2.5} fill="#3a1f0c" />
      <text x={0} y={-22} textAnchor="middle" fontSize={8} fontWeight={700} fill="#3a1f0c" fontFamily="system-ui, sans-serif">N</text>
    </g>
  );
}
