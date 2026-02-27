import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { buildEmbedding } from '../../core/embedding/buildEmbedding';
import { datasetToCsv, downloadText } from '../../core/derive/export';
import { useGeomodeStore } from '../../state/store';
import type { EmbeddedPoint } from '../../types/models';
import { projectPoints, SimpleChart } from '../components/SimpleChart';
import { DatasetImport } from '../dataset/DatasetImport';

const SHAPES = [
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'helix', label: 'Helix' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'torus', label: 'Torus' },
  { id: 'grid', label: 'Grid' },
  { id: 'wave', label: 'Wave' },
  { id: 'lissajous', label: 'Lissajous' },
  { id: 'epicycloid', label: 'Epicycloid' },
  { id: 'poincare', label: 'Poincaré Disk' },
  { id: 'hyperboloid', label: 'Hyperboloid' },
] as const;

const inPolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
};

const shapeProjection = (shapeId: string, points: EmbeddedPoint[], control: number) => {
  const period = Math.max(3, 8 + control * 4);
  const scale = 1 + control * 0.3;

  return points.map((point, i) => {
    const t = i / Math.max(1, points.length - 1);
    const theta = (Math.PI * 2 * i) / period;

    switch (shapeId) {
      case 'line':
        return { ...point, x: t * 10 - 5, y: 0, z: Math.sin(theta * 0.35) * 0.8 };
      case 'circle':
        return { ...point, x: Math.cos(theta) * scale, y: Math.sin(theta) * scale, z: Math.sin(theta * 1.4) * 1.1 };
      case 'spiral': {
        const r = 0.3 + t * 2.4 * scale;
        return { ...point, x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: t * 5 - 2.5 };
      }
      case 'helix':
        return { ...point, x: Math.cos(theta) * scale, y: t * 5 - 2.5 + Math.sin(theta * 0.4) * 0.6, z: Math.sin(theta) * scale * 1.4 };
      case 'sphere': {
        const phi = Math.PI * t;
        return {
          ...point,
          x: Math.cos(theta) * Math.sin(phi) * 2,
          y: Math.cos(phi) * 2,
          z: Math.sin(theta) * Math.sin(phi) * 2,
        };
      }
      case 'torus': {
        const phi = (Math.PI * 2 * i) / Math.max(points.length, 1);
        const ring = 1.4 + 0.65 * Math.cos(theta * 0.8);
        return { ...point, x: ring * Math.cos(phi), y: ring * Math.sin(phi), z: Math.sin(theta * 0.8) * 1.6 };
      }
      case 'grid': {
        const cols = Math.max(3, Math.round(8 + control * 2));
        const row = Math.floor(i / cols);
        const col = i % cols;
        return {
          ...point,
          x: col - cols / 2,
          y: row * 0.75 - 4,
          z: Math.sin(col * 0.7) * 0.8 + Math.cos(row * 0.6) * 0.8,
        };
      }
      case 'wave':
        return {
          ...point,
          x: t * 12 - 6,
          y: Math.sin(theta) * (1.2 + control * 0.2),
          z: Math.cos(theta * 0.55) * (1.4 + control * 0.15),
        };
      case 'lissajous': {
        const a = 3 + Math.round(control);
        const b = 2 + Math.round(control * 1.6);
        const delta = Math.PI / (2.4 + control * 0.4);
        return {
          ...point,
          x: Math.sin(a * theta + delta) * (1.8 + control * 0.25),
          y: Math.sin(b * theta) * (1.8 + control * 0.25),
          z: Math.sin((a + b) * theta * 0.35) * 2,
        };
      }
      case 'epicycloid': {
        const k = 3 + Math.round(control * 1.2);
        const r = 0.55 + control * 0.1;
        const R = r * k;
        const phi = theta * 0.65;
        const x = (R + r) * Math.cos(phi) - r * Math.cos(((R + r) / r) * phi);
        const y = (R + r) * Math.sin(phi) - r * Math.sin(((R + r) / r) * phi);
        return { ...point, x: x * 0.45, y: y * 0.45, z: Math.cos(phi * 1.6) * 1.8 };
      }
      case 'poincare': {
        const radial = Math.tanh(t * (2.1 + control * 0.35));
        const angle = theta * (1.4 + control * 0.15) + Math.sin(theta * 0.35) * 0.3;
        return {
          ...point,
          x: radial * Math.cos(angle) * 2.4,
          y: radial * Math.sin(angle) * 2.4,
          z: (1 - radial * radial) * 2.2 - 1,
        };
      }
      case 'hyperboloid': {
        const v = t * 2.2 - 1.1;
        const cosh = (Math.exp(v) + Math.exp(-v)) / 2;
        const sinh = (Math.exp(v) - Math.exp(-v)) / 2;
        const tube = 0.4 + cosh * (0.3 + control * 0.03);
        return {
          ...point,
          x: Math.cos(theta * 0.75) * tube,
          y: sinh * 1.55,
          z: Math.sin(theta * 0.75) * tube,
        };
      }
      default:
        return point;
    }
  });
};

export const ExplorerScreen = () => {
  const {
    datasets,
    schemas,
    viewConfigs,
    selectedDatasetId,
    addDerivedDataset,
    derivedDatasets,
  } = useGeomodeStore();

  const [shapeId, setShapeId] = useState<(typeof SHAPES)[number]['id']>('spiral');
  const [shapeOpen, setShapeOpen] = useState(false);
  const [showLoad, setShowLoad] = useState(datasets.length === 0);
  const [sliceMode, setSliceMode] = useState(false);
  const [control, setControl] = useState(1);
  const [hintVisible, setHintVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cyclePrompt, setCyclePrompt] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number }>();
  const [lassoPath, setLassoPath] = useState<Array<{ x: number; y: number }>>([]);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) ?? datasets[0];
  const schema = selectedDataset ? schemas[selectedDataset.id] : undefined;
  const viewConfig = selectedDataset ? viewConfigs[selectedDataset.id] : undefined;

  const baselinePoints = useMemo(() => {
    if (!selectedDataset || !schema || !viewConfig) return [];
    return buildEmbedding(selectedDataset, schema, viewConfig);
  }, [schema, selectedDataset, viewConfig]);

  const projectedPoints = useMemo(
    () => shapeProjection(shapeId, baselinePoints, control),
    [shapeId, baselinePoints, control],
  );

  const chartPoints = useMemo(() => projectPoints(projectedPoints, 1180, 700), [projectedPoints]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setControl((prev) => Math.max(0.4, Math.min(4, prev + Math.sign(event.deltaY) * -0.12)));
    setHintVisible(true);
    window.clearTimeout((handleWheel as unknown as { timer?: number }).timer);
    (handleWheel as unknown as { timer?: number }).timer = window.setTimeout(() => setHintVisible(false), 1200);
  };

  const selectFromRectangle = (box: { x: number; y: number; w: number; h: number }) => {
    const left = Math.min(box.x, box.x + box.w);
    const right = Math.max(box.x, box.x + box.w);
    const top = Math.min(box.y, box.y + box.h);
    const bottom = Math.max(box.y, box.y + box.h);
    return new Set(chartPoints.filter((p) => p.px >= left && p.px <= right && p.py >= top && p.py <= bottom).map((p) => p.id));
  };

  const selectCluster = (x: number, y: number) => {
    const nearest = [...chartPoints].sort((a, b) => {
      const da = Math.hypot(a.px - x, a.py - y);
      const db = Math.hypot(b.px - x, b.py - y);
      return da - db;
    });
    const radius = Math.max(20, Math.min(70, Math.hypot((nearest[0]?.px ?? x) - x, (nearest[0]?.py ?? y) - y) * 4));
    return new Set(nearest.filter((p) => Math.hypot(p.px - x, p.py - y) <= radius).map((p) => p.id));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!sliceMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    startRef.current = { x, y };
    drawingRef.current = true;
    setSelectionBox({ x, y, w: 0, h: 0 });
    setLassoPath([{ x, y }]);
    setCyclePrompt(false);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!sliceMode || !drawingRef.current || !startRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const start = startRef.current;
    setSelectionBox({ x: start.x, y: start.y, w: x - start.x, h: y - start.y });
    setLassoPath((prev) => [...prev, { x, y }]);
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!sliceMode || !startRef.current) return;
    drawingRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const start = startRef.current;
    const drag = Math.hypot(x - start.x, y - start.y);
    const path = [...lassoPath, { x, y }];

    let next = new Set<string>();
    if (drag < 10) {
      next = selectCluster(x, y);
      if (shapeId === 'spiral') {
        const period = Math.max(3, Math.round(8 + control * 4));
        const nearest = [...chartPoints].sort((a, b) => Math.hypot(a.px - x, a.py - y) - Math.hypot(b.px - x, b.py - y))[0];
        if (nearest && nearest.index > period) {
          const phase = nearest.index % period;
          next = new Set(chartPoints.filter((p) => p.index % period === phase).map((p) => p.id));
          setCyclePrompt(true);
        }
      }
    } else {
      const complexity = path.length > 8 && path.some((p, i) => i > 1 && Math.abs((path[i - 1].x - path[i - 2].x) - (p.x - path[i - 1].x)) > 4);
      if (complexity) {
        next = new Set(chartPoints.filter((p) => inPolygon(p.px, p.py, path)).map((p) => p.id));
      } else if (selectionBox) {
        next = selectFromRectangle(selectionBox);
      }
    }

    setSelectedIds(next);
    setSelectionBox(undefined);
    setLassoPath([]);
    startRef.current = null;
  };

  const extractSelection = () => {
    if (!selectedDataset || selectedIds.size === 0) return;
    const rows = selectedDataset.rows.filter((row) => selectedIds.has(row.id));
    addDerivedDataset({
      id: crypto.randomUUID(),
      sourceDatasetId: selectedDataset.id,
      extractorId: 'phase_trace',
      name: `${selectedDataset.name} slice`,
      rows,
    });
  };

  const activeDerived = derivedDatasets[derivedDatasets.length - 1];

  return (
    <section className="one-screen" onWheel={handleWheel}>
      <header className="top-bar">
        <button onClick={() => setShowLoad(true)}>Load CSV</button>
        <button onClick={() => setShapeOpen((prev) => !prev)}>Shape</button>
        <button className={sliceMode ? 'active' : ''} onClick={() => setSliceMode((prev) => !prev)}>Slice</button>
      </header>

      {shapeOpen && (
        <div className="shape-strip">
          {SHAPES.map((shape) => (
            <button key={shape.id} className={shape.id === shapeId ? 'selected' : ''} onClick={() => setShapeId(shape.id)}>
              <span className={`mini-shape ${shape.id}`} aria-hidden="true" />
              {shape.label}
            </button>
          ))}
        </div>
      )}

      {showLoad && <DatasetImport onLoaded={() => setShowLoad(false)} />}

      <div className="canvas-wrap">
        {hintVisible && <div className="floating-hint">Scroll to adjust</div>}
        {cyclePrompt && <div className="floating-hint cycle">Repeated cycle detected — Extract?</div>}
        {projectedPoints.length > 0 ? (
          <SimpleChart
            points={projectedPoints}
            highlightIds={selectedIds}
            selectionBox={selectionBox}
            lassoPath={lassoPath}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        ) : (
          <p className="empty-state">Load CSV to see your view.</p>
        )}
      </div>

      <footer className="bottom-bar">
        <span>{selectedIds.size} points selected</span>
        <button onClick={extractSelection} disabled={selectedIds.size === 0}>Extract</button>
        <button onClick={() => activeDerived && downloadText(`${activeDerived.name}.csv`, datasetToCsv(activeDerived), 'text/csv')} disabled={!activeDerived}>Export</button>
      </footer>
    </section>
  );
};
