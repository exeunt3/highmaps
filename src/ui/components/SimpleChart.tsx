import type { PointerEventHandler } from 'react';
import type { EmbeddedPoint } from '../../types/models';

interface ViewPoint extends EmbeddedPoint {
  px: number;
  py: number;
}

interface Props {
  points: EmbeddedPoint[];
  width?: number;
  height?: number;
  highlightIds?: Set<string>;
  selectionBox?: { x: number; y: number; w: number; h: number };
  lassoPath?: Array<{ x: number; y: number }>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
}

export const projectPoints = (points: EmbeddedPoint[], width: number, height: number): ViewPoint[] => {
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

export const SimpleChart = ({
  points,
  width = 1180,
  height = 700,
  highlightIds,
  selectionBox,
  lassoPath,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) => {
  if (points.length === 0) return <div className="empty-state">Paste CSV to begin.</div>;
  const projected = projectPoints(points, width, height);
  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');

  return (
    <svg className="chart-svg" width={width} height={height} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <path d={d} fill="none" stroke="rgba(125, 211, 252, 0.9)" strokeWidth={1.6} />
      {projected.map((p) => (
        <circle
          key={p.id}
          cx={p.px}
          cy={p.py}
          r={highlightIds?.has(p.id) ? 4.2 : 2.1}
          fill={highlightIds?.has(p.id) ? '#fde047' : 'rgba(167, 243, 208, 0.8)'}
          className={highlightIds?.has(p.id) ? 'selected-point' : ''}
        />
      ))}
      {selectionBox && (
        <rect
          x={Math.min(selectionBox.x, selectionBox.x + selectionBox.w)}
          y={Math.min(selectionBox.y, selectionBox.y + selectionBox.h)}
          width={Math.abs(selectionBox.w)}
          height={Math.abs(selectionBox.h)}
          fill="rgba(56, 189, 248, 0.08)"
          stroke="rgba(125, 211, 252, 0.75)"
          strokeDasharray="6 4"
        />
      )}
      {lassoPath && lassoPath.length > 2 && (
        <path
          d={lassoPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'}
          fill="rgba(74, 222, 128, 0.08)"
          stroke="rgba(74, 222, 128, 0.8)"
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
};
