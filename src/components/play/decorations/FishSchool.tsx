export function FishSchool() {
  const fish = (x: number, y: number, scale: number, color: string) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={0} cy={0} rx={6} ry={3} fill={color} />
      <path d="M 6 0 L 10 -3 L 10 3 Z" fill={color} />
      <circle cx={-3} cy={-1} r={0.8} fill="#000" />
    </g>
  );
  return (
    <g aria-hidden>
      {fish(0, 0, 1, '#5fb7d4')}
      {fish(-10, -6, 0.8, '#7ec4d8')}
      {fish(-12, 6, 0.9, '#5fb7d4')}
      {fish(8, -4, 0.7, '#8ac9da')}
    </g>
  );
}
