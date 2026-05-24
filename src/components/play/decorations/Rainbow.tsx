export function Rainbow() {
  const arc = (r: number, color: string) => (
    <path d={`M ${-r} 0 a ${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke={color} strokeWidth={4} />
  );
  return (
    <g aria-hidden>
      {arc(28, '#e74c3c')}
      {arc(24, '#f39c12')}
      {arc(20, '#f1c40f')}
      {arc(16, '#27ae60')}
      {arc(12, '#3498db')}
      {arc(8,  '#9b59b6')}
    </g>
  );
}
