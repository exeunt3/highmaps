import { useMemo, useState } from 'react';
import { buildEmbedding } from '../../core/embedding/buildEmbedding';
import { extractorRegistry } from '../../core/extractors/registry';
import { transformRegistry } from '../../core/transforms/registry';
import { useGeomodeStore } from '../../state/store';
import { InfoTip } from '../components/InfoTip';
import { SimpleChart } from '../components/SimpleChart';

export const ExplorerScreen = () => {
  const {
    datasets,
    schemas,
    viewConfigs,
    selectedDatasetId,
    setSelectedDataset,
    transformConfig,
    setTransformConfig,
    extractorConfig,
    setExtractorConfig,
    addDerivedDataset,
  } = useGeomodeStore();
  const [morph, setMorph] = useState(1);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) ?? datasets[0];
  const schema = selectedDataset ? schemas[selectedDataset.id] : undefined;
  const viewConfig = selectedDataset ? viewConfigs[selectedDataset.id] : undefined;

  const baselinePoints = useMemo(() => {
    if (!selectedDataset || !schema || !viewConfig) return [];
    return buildEmbedding(selectedDataset, schema, viewConfig);
  }, [selectedDataset, schema, viewConfig]);

  const transformDef = transformRegistry.get(transformConfig.transformId);
  const transformedPoints = useMemo(
    () => transformDef.apply(baselinePoints, transformConfig.params),
    [baselinePoints, transformDef, transformConfig.params],
  );

  const morphedPoints = useMemo(
    () => baselinePoints.map((p, i) => {
      const t = transformedPoints[i] ?? p;
      return {
        ...p,
        x: p.x * (1 - morph) + t.x * morph,
        y: p.y * (1 - morph) + t.y * morph,
      };
    }),
    [baselinePoints, transformedPoints, morph],
  );

  const extractorDef = extractorRegistry.get(extractorConfig.extractorId);
  const previewSelection = useMemo(
    () => extractorDef.preview(transformedPoints, extractorConfig.params),
    [transformedPoints, extractorConfig, extractorDef],
  );

  const runExtraction = () => {
    if (!selectedDataset) return;
    const derived = extractorDef.materialize(selectedDataset, transformedPoints, extractorConfig.params);
    addDerivedDataset(derived);
  };

  if (!selectedDataset || !schema || !viewConfig) {
    return <section><h2>2) Explore and Filter</h2><p>Add a dataset first to unlock this step.</p></section>;
  }

  return (
    <section>
      <h2>2) Explore and Filter</h2>
      <p className="section-subtitle">
        Compare your original data with a transformed view, then choose which points to keep.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label>
            Active dataset
            <InfoTip content="Choose which uploaded dataset to explore. Everything on this screen updates immediately." />
          </label>
          <select value={selectedDataset.id} onChange={(e) => setSelectedDataset(e.target.value)}>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
          <h4>
            Original shape
            <InfoTip content="This chart is the baseline embedding before any transformation. It helps you compare before vs after." />
          </h4>
          <SimpleChart points={baselinePoints} />
        </div>

        <div>
          <label>
            Transformation recipe
            <InfoTip content="A transform remaps each point's position. Tune the numeric settings below to see different geometric patterns." />
          </label>
          <select
            value={transformConfig.transformId}
            onChange={(e) => {
              const next = transformRegistry.get(e.target.value);
              setTransformConfig({ transformId: next.id, params: { ...next.paramSchema } });
            }}
          >
            {transformRegistry.list().map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {Object.entries(transformDef.paramSchema).map(([key]) => (
            <label key={key} style={{ display: 'block' }}>
              {key}
              <input
                type="number"
                value={transformConfig.params[key] ?? 0}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  params: { ...transformConfig.params, [key]: Number(e.target.value) },
                })}
              />
            </label>
          ))}
          <label style={{ display: 'block' }}>
            Blend original vs transformed: {morph.toFixed(2)}
            <InfoTip content="0.00 keeps the original chart. 1.00 shows the fully transformed chart. Values in between animate a smooth transition." />
            <input type="range" min={0} max={1} step={0.01} value={morph} onChange={(e) => setMorph(Number(e.target.value))} />
          </label>
          <h4>
            Working view (red points are selected)
            <InfoTip content="This is what the extractor sees. Red points match your current extraction rule and will be included in the derived dataset." />
          </h4>
          <SimpleChart points={morphedPoints} highlightIds={previewSelection} />
        </div>
      </div>

      <h3>
        Build a derived dataset
        <InfoTip content="An extractor decides which points to keep based on the transformed coordinates. Use this to create focused subsets." />
      </h3>
      <label>
        Selection rule
        <InfoTip content="Pick a rule, then tweak its parameters. The chart highlights matching points in red before you commit." />
      </label>
      <select
        value={extractorConfig.extractorId}
        onChange={(e) => {
          const next = extractorRegistry.get(e.target.value);
          setExtractorConfig({ extractorId: next.id, params: { ...next.paramSchema } });
        }}
      >
        {extractorRegistry.list().map((extractor) => (
          <option key={extractor.id} value={extractor.id}>{extractor.name}</option>
        ))}
      </select>
      {Object.entries(extractorDef.paramSchema).map(([key]) => (
        <label key={key} style={{ display: 'block' }}>
          {key}
          <input
            type="number"
            value={extractorConfig.params[key] ?? 0}
            onChange={(e) => setExtractorConfig({
              ...extractorConfig,
              params: { ...extractorConfig.params, [key]: Number(e.target.value) },
            })}
          />
        </label>
      ))}
      <button onClick={runExtraction}>Create derived dataset from selected points</button>
    </section>
  );
};
