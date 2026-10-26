/** The Coach Connect mark: one "C" inside another, facing each other, with a dot between them. */

const GAP_DEGREES = 40;

function openArc(radius: number): string {
  const a = (GAP_DEGREES * Math.PI) / 180;
  const x = (50 + radius * Math.cos(a)).toFixed(2);
  return `M ${x} ${(50 - radius * Math.sin(a)).toFixed(2)} A ${radius} ${radius} 0 1 0 ${x} ${(50 + radius * Math.sin(a)).toFixed(2)}`;
}

export function Logo({ size = 24, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Coach Connect logo">
      <path d={openArc(38)} stroke={color} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d={openArc(21)} stroke={color} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.7} />
      <circle cx={52} cy={50} r={5.5} fill={color} />
    </svg>
  );
}
