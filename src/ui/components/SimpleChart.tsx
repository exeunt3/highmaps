import type { EmbeddedPoint } from '../../types/models';

interface Props {
  points: EmbeddedPoint[];
  width?: number;
  height?: number;
  highlightIds?: Set<string>;
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

export const SimpleChart = ({ points, width = 480, height = 280, highlightIds }: Props) => {
  if (points.length === 0) return <div>No points</div>;
  const projected = project(points, width, height);
  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');

  return (
    <svg width={width} height={height} style={{ border: '1px solid #ccc', background: '#fff' }}>
      <path d={d} fill="none" stroke="#667eea" strokeWidth={2} />
      {projected.map((p) => (
        <circle
          key={p.id}
          cx={p.px}
          cy={p.py}
          r={highlightIds?.has(p.id) ? 4 : 2.5}
          fill={highlightIds?.has(p.id) ? '#ef4444' : '#111827'}
        />
      ))}
    </svg>
  );
};
