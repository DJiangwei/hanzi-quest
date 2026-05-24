export function Hibiscus() {
  return (
    <g aria-hidden>
      {[0, 72, 144, 216, 288].map((rot) => (
        <ellipse
          key={rot}
          cx={0}
          cy={-10}
          rx={6}
          ry={10}
          fill="#ff6b9d"
          stroke="#c9356b"
          strokeWidth={1}
          transform={`rotate(${rot})`}
        />
      ))}
      <circle cx={0} cy={0} r={3} fill="#ffd966" stroke="#c98a00" strokeWidth={1} />
      <line x1={0} y1={6} x2={0} y2={20} stroke="#2e7d32" strokeWidth={2} />
      <path d="M 0 14 q -8 -2 -10 6 q 8 -2 10 -6 z" fill="#46a05a" stroke="#2e7d32" strokeWidth={1} />
    </g>
  );
}
