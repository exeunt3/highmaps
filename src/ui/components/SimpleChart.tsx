import type { PointerEventHandler } from 'react';
import type { EmbeddedPoint } from '../../types/models';

interface ViewPoint extends EmbeddedPoint {
  px: number;
  py: number;
  depth: number;
  glow: number;
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
  onPointClick?: (id: string) => void;
  rotation?: { yaw: number; pitch: number; roll?: number };
}

const rotatePoint = (
  point: EmbeddedPoint,
  rotation: { yaw: number; pitch: number; roll?: number },
) => {
  const yaw = rotation.yaw;
  const pitch = rotation.pitch;
  const roll = rotation.roll ?? 0;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);

  const x1 = point.x * cosY - (point.z ?? 0) * sinY;
  const z1 = point.x * sinY + (point.z ?? 0) * cosY;
  const y2 = point.y * cosP - z1 * sinP;
  const z2 = point.y * sinP + z1 * cosP;
  const x3 = x1 * cosR - y2 * sinR;
  const y3 = x1 * sinR + y2 * cosR;

  return { ...point, x: x3, y: y3, z: z2 };
};

export const projectPoints = (
  points: EmbeddedPoint[],
  width: number,
  height: number,
  rotation: { yaw: number; pitch: number; roll?: number } = { yaw: 0, pitch: 0, roll: 0 },
): ViewPoint[] => {
  const rotated = points.map((point) => rotatePoint(point, rotation));
  const xs = rotated.map((p) => p.x);
  const ys = rotated.map((p) => p.y);
  const zs = rotated.map((p) => p.z ?? 0);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const minZ = Math.min(...zs, -1);
  const maxZ = Math.max(...zs, 1);
  const cx = width / 2;
  const cy = height / 2;

  const paddedWidth = width * 0.86;
  const paddedHeight = height * 0.82;

  const projected = rotated.map((p) => {
    const nx = ((p.x - minX) / (maxX - minX || 1)) * 2 - 1;
    const ny = ((p.y - minY) / (maxY - minY || 1)) * 2 - 1;
    const depth = ((p.z ?? 0) - minZ) / (maxZ - minZ || 1);
    const perspective = 0.72 + depth * 0.5;
    const x = cx + nx * (paddedWidth * 0.5) * perspective;
    const y = cy - ny * (paddedHeight * 0.5) * perspective;
    return { ...p, px: x, py: y, depth, glow: 0.4 + depth * 0.6 };
  });

  const minPx = Math.min(...projected.map((p) => p.px));
  const maxPx = Math.max(...projected.map((p) => p.px));
  const minPy = Math.min(...projected.map((p) => p.py));
  const maxPy = Math.max(...projected.map((p) => p.py));
  const availableW = width * 0.92;
  const availableH = height * 0.9;
  const spanX = Math.max(1, maxPx - minPx);
  const spanY = Math.max(1, maxPy - minPy);
  const fitScale = Math.min(availableW / spanX, availableH / spanY, 1.2);
  const centerPx = (minPx + maxPx) / 2;
  const centerPy = (minPy + maxPy) / 2;

  return projected.map((point) => ({
    ...point,
    px: cx + (point.px - centerPx) * fitScale,
    py: cy + (point.py - centerPy) * fitScale,
  }));
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
  onPointClick,
  rotation,
}: Props) => {
  if (points.length === 0) return <div className="empty-state">Paste CSV to begin.</div>;
  const projected = projectPoints(points, width, height, rotation);
  const depthSorted = [...projected].sort((a, b) => a.depth - b.depth);
  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');
  const hasBothSeries = points.some((point) => point.id.includes('|emotion')) && points.some((point) => point.id.includes('|narrative'));

  return (
    <svg className="chart-svg" width={width} height={height} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onContextMenu={(event) => event.preventDefault()}>
      <defs>
        <radialGradient id="chartGlow" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.15)" />
          <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#chartGlow)" />
      <path d={d} fill="none" stroke="rgba(56, 189, 248, 0.35)" strokeWidth={1.1} strokeLinecap="round" />
      {hasBothSeries && <text x={18} y={26} fill="#7dd3fc" fontSize={12}>Emotion points</text>}
      {hasBothSeries && <text x={18} y={44} fill="#f0abfc" fontSize={12}>Narrative points</text>}
      {depthSorted.map((p) => {
        const selected = highlightIds?.has(p.id);
        const radius = selected ? 5.2 : 2 + p.depth * 2.4;
        const fill = selected
          ? '#fde047'
          : p.id.includes('|narrative')
            ? `rgba(${Math.round(240 - p.depth * 20)}, ${Math.round(130 + p.depth * 30)}, ${Math.round(230 + p.depth * 20)}, ${0.5 + p.depth * 0.45})`
            : `rgba(${Math.round(140 + p.depth * 80)}, ${Math.round(210 + p.depth * 30)}, ${Math.round(255 - p.depth * 35)}, ${0.5 + p.depth * 0.45})`;
        return (
          <g key={p.id} style={{ opacity: selected ? 1 : 0.58 + p.depth * 0.4 }}>
            <circle cx={p.px} cy={p.py} r={radius + p.glow * 2.5} fill="rgba(56, 189, 248, 0.12)" />
            <circle
              cx={p.px}
              cy={p.py}
              r={radius}
              fill={fill}
              stroke={selected ? 'rgba(254, 249, 195, 0.9)' : `rgba(186, 230, 253, ${0.35 + p.depth * 0.4})`}
              strokeWidth={selected ? 1.4 : 0.8}
              className={selected ? 'selected-point' : ''}
              onClick={() => onPointClick?.(p.id)}
            />
          </g>
        );
      })}
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
