import type { EmbeddedPoint } from '../../types/models';

interface Props {
  points: EmbeddedPoint[];
  width?: number;
  height?: number;
  highlightIds?: Set<string>;
  colorMode?: 'cool' | 'vivid';
}

const project = (points: EmbeddedPoint[], width: number, height: number) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  return points.map((p) => {
    const x = ((p.x - minX) / (maxX - minX || 1)) * (width - 30) + 15;
    const y = height - (((p.y - minY) / (maxY - minY || 1)) * (height - 30) + 15);
    return { ...p, px: x, py: y };
  });
};

export const SimpleChart = ({ points, width = 480, height = 280, highlightIds, colorMode = 'cool' }: Props) => {
  if (points.length === 0) return <div className="empty-state">No points</div>;
  const projected = project(points, width, height);
  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');
  const strokeColor = colorMode === 'vivid' ? '#f472b6' : '#22d3ee';
  const pointColor = colorMode === 'vivid' ? '#fef08a' : '#c4b5fd';

  return (
    <svg width={width} height={height} style={{ border: '1px solid rgba(148, 163, 184, 0.3)', background: 'rgba(2, 6, 23, 0.85)', borderRadius: 14 }}>
      <defs>
        <linearGradient id={`line-grad-${colorMode}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorMode === 'vivid' ? '#f472b6' : '#22d3ee'} />
          <stop offset="100%" stopColor={colorMode === 'vivid' ? '#facc15' : '#8b5cf6'} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="rgba(15, 23, 42, 0.35)" rx={14} />
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <line key={t} x1={15} x2={width - 15} y1={height * t} y2={height * t} stroke="rgba(148, 163, 184, 0.12)" />
      ))}
      <path d={d} fill="none" stroke={`url(#line-grad-${colorMode})`} strokeWidth={2.5} />
      {projected.map((p) => (
        <circle
          key={p.id}
          cx={p.px}
          cy={p.py}
          r={highlightIds?.has(p.id) ? 5 : 3}
          fill={highlightIds?.has(p.id) ? '#fb7185' : pointColor}
          style={{ filter: 'drop-shadow(0 0 6px rgba(251, 113, 133, 0.35))' }}
        />
      ))}
      <circle cx={projected[projected.length - 1]?.px} cy={projected[projected.length - 1]?.py} r={5} fill={strokeColor} />
    </svg>
  );
};
