import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import type { EmbeddedPoint } from '../../types/models';
import { useGeomodeStore, type GeomodeEntry } from '../../state/store';
import { projectPoints, SimpleChart } from '../components/SimpleChart';

const SHAPE_OPTIONS = [
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'wave', label: 'Wave' },
  { id: 'grid', label: 'Grid' },
  { id: 'helix', label: 'Helix' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'torus', label: 'Torus' },
  { id: 'mobius', label: 'Möbius' },
  { id: 'hyperbolic-disk', label: 'Hyperbolic Disk' },
  { id: 'hypersphere-projection', label: 'Hypersphere Projection' },
  { id: 'tesseract-projection', label: 'Tesseract Projection' },
] as const;
const GEOMETRY_MODELS = SHAPE_OPTIONS.map((shape) => shape.label);
type ShapeId = (typeof SHAPE_OPTIONS)[number]['id'];
type GraphLayer = 'emotion' | 'narrative' | 'both';

const INTENTIONS = [
  { label: 'Stabilize weekly baseline', target: 0.75 },
  { label: 'Increase calm frequency', target: 0.8 },
  { label: 'Increase resolution days', target: 0.7 },
  { label: 'Reduce volatility', target: 0.25 },
  { label: 'Balance valence/arousal', target: 0.6 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const shapeProjection = (shapeId: ShapeId, points: EmbeddedPoint[]) => points.map((point, i) => {
  const t = i / Math.max(1, points.length - 1);
  const theta = t * Math.PI * 2;
  const phi = t * Math.PI;

  switch (shapeId) {
    case 'line':
      return { ...point, x: t * 5 - 2.5, y: 0, z: 0 };
    case 'circle':
      return { ...point, x: Math.cos(theta) * 2.2, y: Math.sin(theta) * 2.2, z: 0 };
    case 'spiral': {
      const radius = 0.35 + t * 2.2;
      return { ...point, x: Math.cos(theta * 2.2) * radius, y: Math.sin(theta * 2.2) * radius, z: t * 1.8 - 0.9 };
    }
    case 'wave':
      return { ...point, x: t * 5 - 2.5, y: Math.sin(theta * 2) * 1.8, z: Math.cos(theta * 2) * 0.6 };
    case 'grid': {
      const columns = Math.max(3, Math.round(Math.sqrt(points.length)));
      const row = Math.floor(i / columns);
      const col = i % columns;
      return { ...point, x: (col / Math.max(1, columns - 1)) * 4 - 2, y: (row / Math.max(1, columns - 1)) * 4 - 2, z: 0 };
    }
    case 'helix':
      return { ...point, x: Math.cos(theta * 2) * 1.6, y: t * 4 - 2, z: Math.sin(theta * 2) * 1.6 };
    case 'cylinder': {
      const y = t * 4 - 2;
      return { ...point, x: Math.cos(theta * 3) * 1.7, y, z: Math.sin(theta * 3) * 1.7 };
    }
    case 'sphere':
      return {
        ...point,
        x: Math.cos(theta) * Math.sin(phi) * 2.2,
        y: Math.cos(phi) * 2.2,
        z: Math.sin(theta) * Math.sin(phi) * 2.2,
      };
    case 'torus': {
      const minor = Math.sin(t * Math.PI * 6) * 0.55;
      const major = 1.6 + minor;
      return { ...point, x: Math.cos(theta) * major, y: Math.sin(t * Math.PI * 6) * 0.9, z: Math.sin(theta) * major };
    }
    case 'mobius': {
      const u = theta;
      const v = Math.sin(t * Math.PI * 4) * 0.9;
      return {
        ...point,
        x: (1.8 + (v / 2) * Math.cos(u / 2)) * Math.cos(u),
        y: (1.8 + (v / 2) * Math.cos(u / 2)) * Math.sin(u),
        z: (v / 2) * Math.sin(u / 2) * 2,
      };
    }
    case 'hyperbolic-disk': {
      const r = Math.tanh(t * 1.6) * 2.2;
      return { ...point, x: Math.cos(theta * 2.4) * r, y: Math.sin(theta * 2.4) * r, z: Math.sin(theta * 1.2) * 0.3 };
    }
    case 'hypersphere-projection': {
      const chi = t * Math.PI * 1.5;
      const w = Math.cos(chi);
      return {
        ...point,
        x: Math.cos(theta) * Math.sin(phi) * (1.3 + w),
        y: Math.sin(theta) * Math.sin(phi) * (1.3 + w),
        z: Math.cos(phi) * (1.3 + w),
      };
    }
    case 'tesseract-projection': {
      const corners = [
        [-1, -1, -1, -1], [1, -1, -1, -1], [-1, 1, -1, -1], [1, 1, -1, -1],
        [-1, -1, 1, -1], [1, -1, 1, -1], [-1, 1, 1, -1], [1, 1, 1, -1],
        [-1, -1, -1, 1], [1, -1, -1, 1], [-1, 1, -1, 1], [1, 1, -1, 1],
        [-1, -1, 1, 1], [1, -1, 1, 1], [-1, 1, 1, 1], [1, 1, 1, 1],
      ] as const;
      const idx = Math.floor(t * corners.length) % corners.length;
      const [x, y, z, w] = corners[idx];
      const perspective4d = 1 / (2.4 - w * 0.75);
      return { ...point, x: x * perspective4d * 3, y: y * perspective4d * 3, z: z * perspective4d * 3 };
    }
  }
});

const toEmotionPoints = (entries: GeomodeEntry[]): EmbeddedPoint[] => entries.map((entry, index) => ({
  id: `${entry.id}|emotion`,
  index,
  x: index,
  y: entry.emotion.valence,
  z: entry.emotion.arousal - 2,
}));

const toNarrativePoints = (entries: GeomodeEntry[]): EmbeddedPoint[] => entries.map((entry, index) => ({
  id: `${entry.id}|narrative`,
  index,
  x: index,
  y: entry.narrative.agencyLevel - entry.narrative.conflictLevel,
  z: entry.narrative.closureLevel - 2,
}));

const computeSummary = (entries: GeomodeEntry[]) => {
  if (entries.length === 0) return [];
  const valences = entries.map((entry) => entry.emotion.valence);
  const meanValence = valences.reduce((a, b) => a + b, 0) / valences.length;
  const volatility = valences.slice(1).reduce((acc, value, i) => acc + Math.abs(value - valences[i]), 0) / Math.max(1, valences.length - 1);
  const calmRate = entries.filter((entry) => entry.emotion.primaryEmotion === 'calm').length / entries.length;
  const resolutionRate = entries.filter((entry) => entry.narrative.atoms.includes('resolution')).length / entries.length;

  return [
    meanValence >= 1 ? 'Mean valence is mostly positive.' : meanValence <= -1 ? 'Mean valence is mostly negative.' : 'Mean valence is balanced.',
    volatility > 2 ? `High volatility across last ${Math.min(7, entries.length)} entries.` : 'Volatility is steady.',
    calmRate > 0.4 ? 'Calm appears often in logged days.' : 'Calm appears infrequently in logged days.',
    resolutionRate > 0.35 ? 'Resolution atoms are recurring in narrative tags.' : 'Resolution atoms are still sparse.',
  ];
};

const fitError = (points: Array<{ x: number; y: number }>, model: string) => {
  if (points.length < 4) return 999;
  const centerX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
  const centerY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
  const radii = points.map((p) => Math.hypot(p.x - centerX, p.y - centerY));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  const last = points[points.length - 1];
  const yTrend = last.y - points[0].y;

  switch (model) {
    case 'Line':
      return points.reduce((acc, p, i) => acc + Math.abs(p.y - (points[0].y + (yTrend / points.length) * i)), 0) / points.length;
    case 'Circle':
      return radii.reduce((acc, r) => acc + Math.abs(r - avgR), 0) / points.length;
    case 'Spiral':
      return points.reduce((acc, p, i) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - (i / points.length) * avgR * 1.8), 0) / points.length;
    case 'Wave':
      return points.reduce((acc, p, i) => acc + Math.abs(p.y - (centerY + Math.sin((i / points.length) * Math.PI * 3) * avgR * 0.55)), 0) / points.length;
    case 'Grid':
      return points.reduce((acc, p) => {
        const nearX = Math.abs(p.x - Math.round(p.x / (avgR * 0.35 || 1)) * (avgR * 0.35 || 1));
        const nearY = Math.abs(p.y - Math.round(p.y / (avgR * 0.35 || 1)) * (avgR * 0.35 || 1));
        return acc + Math.min(nearX, nearY);
      }, 0) / points.length;
    case 'Helix':
      return points.reduce((acc, p) => acc + Math.abs(Math.abs(p.x - centerX) - avgR), 0) / points.length;
    case 'Cylinder':
      return points.reduce((acc, p) => acc + Math.abs(Math.abs(p.x - centerX) - avgR * 0.75), 0) / points.length;
    case 'Sphere':
      return radii.reduce((acc, r) => acc + Math.abs(r - avgR * 0.9), 0) / points.length;
    case 'Torus':
      return points.reduce((acc, p) => {
        const r = Math.hypot(p.x - centerX, p.y - centerY);
        return acc + Math.min(Math.abs(r - avgR * 0.65), Math.abs(r - avgR * 1.1));
      }, 0) / points.length;
    case 'Möbius':
      return points.reduce((acc, p, i) => acc + Math.abs((p.y - centerY) - Math.sin((i / points.length) * Math.PI * 2) * (p.x - centerX) * 0.25), 0) / points.length;
    case 'Hyperbolic Disk':
      return points.reduce((acc, p) => acc + Math.abs(Math.hypot(p.x - centerX, p.y - centerY) - avgR * 0.6) * 0.6, 0) / points.length;
    case 'Hypersphere Projection':
      return radii.reduce((acc, r) => acc + Math.abs(r - avgR * 0.82), 0) / points.length;
    case 'Tesseract Projection':
      return points.reduce((acc, p) => {
        const dx = Math.abs(p.x - centerX);
        const dy = Math.abs(p.y - centerY);
        return acc + Math.abs(Math.max(dx, dy) - avgR * 0.95);
      }, 0) / points.length;
    default:
      return 999;
  }
};

export const ExplorerScreen = () => {
  const { entries, intentions, addIntention, removeIntention } = useGeomodeStore();
  const [shapeId, setShapeId] = useState<ShapeId>('line');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number }>();
  const [graphLayer, setGraphLayer] = useState<GraphLayer>('both');
  const [rotation, setRotation] = useState({ yaw: 0.4, pitch: -0.3, roll: 0 });
  const [rotating, setRotating] = useState<{ x: number; y: number }>();
  const [autoSpin, setAutoSpin] = useState(true);

  const basePoints = useMemo(() => {
    if (graphLayer === 'emotion') return toEmotionPoints(entries);
    if (graphLayer === 'narrative') return toNarrativePoints(entries);
    return [...toEmotionPoints(entries), ...toNarrativePoints(entries)];
  }, [entries, graphLayer]);

  const shapedPoints = useMemo(() => shapeProjection(shapeId, basePoints), [shapeId, basePoints]);
  const [zoom, setZoom] = useState(1);
  const chartPoints = useMemo(() => projectPoints(shapedPoints, 1880, 1120, rotation, zoom), [shapedPoints, rotation, zoom]);

  const summaries = useMemo(() => computeSummary(entries), [entries]);
  const geometryMatches = useMemo(() => {
    const projected = chartPoints.map((p) => ({ x: p.px, y: p.py }));
    return GEOMETRY_MODELS.map((model) => {
      const error = fitError(projected, model);
      return { model, confidence: Math.round(clamp(100 - error * 7.5, 8, 98)) };
    }).sort((a, b) => b.confidence - a.confidence);
  }, [chartPoints]);


  useEffect(() => {
    if (!autoSpin || rotating) return;
    const id = window.setInterval(() => {
      setRotation((prev) => ({ ...prev, yaw: prev.yaw + 0.02 }));
    }, 40);
    return () => window.clearInterval(id);
  }, [autoSpin, rotating]);

  const progress = useMemo(() => intentions.map((intent) => {
    let metric = 0.5;
    if (intent.label.includes('calm')) {
      metric = entries.length === 0 ? 0 : entries.filter((e) => e.emotion.primaryEmotion === 'calm').length / entries.length;
    } else if (intent.label.includes('volatility')) {
      const vals = entries.map((e) => e.emotion.valence);
      const vol = vals.slice(1).reduce((acc, value, i) => acc + Math.abs(value - vals[i]), 0) / Math.max(1, vals.length - 1);
      metric = clamp(1 - vol / 6, 0, 1);
    } else if (intent.label.includes('resolution')) {
      metric = entries.length === 0 ? 0 : entries.filter((e) => e.narrative.atoms.includes('resolution')).length / entries.length;
    }
    const distance = Math.abs(metric - intent.target);
    return { ...intent, score: Math.round((1 - distance) * 100) };
  }), [entries, intentions]);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.shiftKey || event.button === 1 || event.button === 2) {
      setRotating({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    setSelectionBox({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: 0, h: 0 });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (rotating) {
      const dx = x - rotating.x;
      const dy = y - rotating.y;
      setRotation((prev) => ({
        ...prev,
        yaw: prev.yaw + dx * 0.015,
        pitch: clamp(prev.pitch + dy * 0.012, -1.3, 1.3),
      }));
      setRotating({ x, y });
      return;
    }
    if (!selectionBox) return;
    setSelectionBox((prev) => prev ? { ...prev, w: x - prev.x, h: y - prev.y } : prev);
  };

  const onPointerUp = () => {
    if (rotating) {
      setRotating(undefined);
      return;
    }
    if (selectionBox) {
      const left = Math.min(selectionBox.x, selectionBox.x + selectionBox.w);
      const right = Math.max(selectionBox.x, selectionBox.x + selectionBox.w);
      const top = Math.min(selectionBox.y, selectionBox.y + selectionBox.h);
      const bottom = Math.max(selectionBox.y, selectionBox.y + selectionBox.h);
      setSelectedIds(new Set(chartPoints.filter((point) => point.px >= left && point.px <= right && point.py >= top && point.py <= bottom).map((point) => point.id)));
    }
    setSelectionBox(undefined);
  };

  return (
    <section className="geomode-shell">
      <header className="top-bar">
        <strong>GEOMODE — Geometry map</strong>
      </header>

      <div className="content-grid">
        <aside className="left-panel panel-block">
          <h3>Timeline cards</h3>
          {entries.map((entry) => (
            <button key={entry.id} className="entry-card" onClick={() => setSelectedIds(new Set([`${entry.id}|emotion`, `${entry.id}|narrative`]))}>
              <span>{entry.date}</span>
              <span>{entry.emotion.primaryEmotion}</span>
            </button>
          ))}
        </aside>

        <section className="center-panel">
          <div className="shape-strip inline">
            {SHAPE_OPTIONS.map((shape) => (
              <button key={shape.id} className={shapeId === shape.id ? 'selected' : ''} onClick={() => setShapeId(shape.id)}>{shape.label}</button>
            ))}
            <button onClick={() => setAutoSpin((prev) => !prev)}>{autoSpin ? 'Pause spin' : 'Auto spin'}</button>
            <span className="hint">Shift+drag/middle-drag = rotate 3D · Click nodes = toggle highlight · Drag box = range highlight</span>
          </div>
          <label>Zoom
            <input type="range" min={1} max={2.4} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
          <label>Graph layer
            <select value={graphLayer} onChange={(event) => setGraphLayer(event.target.value as GraphLayer)}>
              <option value="emotion">Emotion only</option>
              <option value="narrative">Narrative only</option>
              <option value="both">Both together</option>
            </select>
          </label>

          {entries.length > 0 ? (
            <SimpleChart
              width={1880}
              height={1120}
              zoom={zoom}
              points={shapedPoints}
              highlightIds={selectedIds}
              selectionBox={selectionBox}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointClick={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              rotation={rotation}
            />
          ) : <p className="empty-state">No logs yet. Add entries on the Daily log page first.</p>}
        </section>

        <aside className="right-panel">
          <h3>Closest Geometry Matches</h3>
          {geometryMatches.map((match) => <p key={match.model}>✓ {match.model} ({match.confidence}%)</p>)}
          <h3>Pattern summaries</h3>
          {summaries.map((summary) => <p key={summary}>{summary}</p>)}
          <h3>Intentions</h3>
          <div className="intent-grid">
            {INTENTIONS.map((intent) => <button key={intent.label} onClick={() => addIntention(intent.label, intent.target)}>{intent.label}</button>)}
          </div>
          {progress.map((item) => (
            <div key={item.id} className="progress-row">
              <span>{item.label}</span>
              <div><i style={{ width: `${item.score}%` }} /></div>
              <button onClick={() => removeIntention(item.id)}>×</button>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
};
