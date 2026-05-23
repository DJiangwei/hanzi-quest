export function PirateFlag() {
  return (
    <g aria-hidden>
      <line x1={0} y1={-24} x2={0} y2={20} stroke="#3a1f0c" strokeWidth={2} />
      <path d="M 0 -24 L 28 -22 L 28 -6 L 0 -8 Z" fill="#1a1a1a" stroke="#000" strokeWidth={1} />
      <circle cx={12} cy={-15} r={4} fill="#fff" />
      <circle cx={10.5} cy={-16} r={0.8} fill="#1a1a1a" />
      <circle cx={13.5} cy={-16} r={0.8} fill="#1a1a1a" />
      <line x1={6} y1={-11} x2={18} y2={-9} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={6} y1={-9} x2={18} y2={-11} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}
