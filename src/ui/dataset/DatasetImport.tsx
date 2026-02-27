import { useMemo, useState } from 'react';
import { inferSchema, parseCsv } from '../../core/schema/csv';
import { NARRATIVE_ATOMS, PRIMARY_EMOTIONS, useGeomodeStore } from '../../state/store';
import type { FieldType, ViewConfig } from '../../types/models';

const SAMPLE_CSV = `date,value,group\n2024-01-01,10,A\n2024-01-02,12,A\n2024-01-03,9,B\n2024-01-04,11,B\n2024-01-05,8,A\n2024-01-06,14,A\n2024-01-07,7,B\n2024-01-08,15,B`;

interface Props {
  onLoaded?: () => void;
}

const DATE_KEYS = ['date', 'day', 'timestamp', 'time'];

const toNumber = (value: string | number | boolean | null | undefined, fallback = 0) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

export const DatasetImport = ({ onLoaded }: Props) => {
  const addDataset = useGeomodeStore((s) => s.addDataset);
  const upsertEntry = useGeomodeStore((s) => s.upsertEntry);
  const [name, setName] = useState('My Data');
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [error, setError] = useState<string>();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, FieldType>>({});
  const [indexFieldOverride, setIndexFieldOverride] = useState<string>('');

  const preview = useMemo(() => {
    try {
      const dataset = parseCsv(name || 'My Data', csvText);
      return inferSchema(dataset);
    } catch {
      return undefined;
    }
  }, [name, csvText]);

  const importDataset = () => {
    try {
      const dataset = parseCsv(name || 'My Data', csvText);
      const inferred = inferSchema(dataset);

      const schema = {
        ...inferred,
        indexField: indexFieldOverride || inferred.indexField,
        fields: inferred.fields.map((field) => ({
          ...field,
          type: typeOverrides[field.name] ?? field.type,
        })),
      };

      const firstNumeric = schema.fields.find((f) => f.type === 'number')?.name;
      const firstTime = schema.fields.find((f) => f.type === 'time')?.name;
      const firstField = schema.fields[0]?.name ?? 'id';

      const viewConfig: ViewConfig = {
        datasetId: dataset.id,
        embeddingDim: 2,
        xField: firstTime ?? schema.indexField ?? firstField,
        yField: firstNumeric ?? firstField,
      };

      addDataset(dataset, schema, viewConfig);

      const fields = schema.fields.map((field) => field.name);
      const dateField = DATE_KEYS.find((key) => fields.includes(key)) ?? schema.indexField;
      const emotionField = fields.find((field) => /emotion/i.test(field));
      const narrativeField = fields.find((field) => /narrative|atom|story/i.test(field));
      const noteField = fields.find((field) => /note|text|journal|entry/i.test(field));

      dataset.rows.forEach((row, index) => {
        const dateRaw = row[dateField];
        const fallbackDate = new Date(Date.now() + index * 86_400_000).toISOString().slice(0, 10);
        const date = typeof dateRaw === 'string' && dateRaw.trim() ? dateRaw.slice(0, 10) : fallbackDate;

        const emotionRaw = emotionField ? row[emotionField] : undefined;
        const primaryEmotion = typeof emotionRaw === 'string' && PRIMARY_EMOTIONS.includes(emotionRaw as typeof PRIMARY_EMOTIONS[number])
          ? emotionRaw as typeof PRIMARY_EMOTIONS[number]
          : 'calm';

        const narrativeRaw = narrativeField ? row[narrativeField] : undefined;
        const atom = typeof narrativeRaw === 'string' && NARRATIVE_ATOMS.includes(narrativeRaw as typeof NARRATIVE_ATOMS[number])
          ? narrativeRaw as typeof NARRATIVE_ATOMS[number]
          : 'beginning';

        const noteRaw = noteField ? row[noteField] : undefined;
        const note = typeof noteRaw === 'string' ? noteRaw.slice(0, 240) : '';

        upsertEntry(date, {
          emotion: {
            primaryEmotion,
            valence: toNumber(row.valence, 0),
            arousal: toNumber(row.arousal, 2),
            energy: toNumber(row.energy, 2),
            clarity: toNumber(row.clarity, 2),
            sociality: toNumber(row.sociality, 0),
            note,
          },
          narrative: {
            atoms: [atom],
            conflictLevel: toNumber(row.conflictLevel, 0),
            agencyLevel: toNumber(row.agencyLevel, 0),
            closureLevel: toNumber(row.closureLevel, 0),
          },
          groupId: typeof row.group === 'string' ? row.group : undefined,
        });
      });

      setError(undefined);
      onLoaded?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="load-overlay" role="dialog" aria-label="Load CSV">
      <div className="load-card">
        <h2>Load CSV</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={10} placeholder="Paste CSV here" />
        <div className="load-actions">
          <button onClick={importDataset}>Show View</button>
          <button className="ghost" onClick={() => setShowAdvanced((prev) => !prev)}>Advanced ▾</button>
        </div>

        {showAdvanced && preview && (
          <div className="load-field-grid">
            {preview.fields.map((field) => (
              <div key={field.name} className="load-field-row">
                <span>{field.name}</span>
                <select
                  value={typeOverrides[field.name] ?? field.type}
                  onChange={(e) => setTypeOverrides((prev) => ({ ...prev, [field.name]: e.target.value as FieldType }))}
                >
                  <option value="number">number</option>
                  <option value="category">category</option>
                  <option value="time">time</option>
                </select>
                <label>
                  <input
                    type="radio"
                    name="indexField"
                    checked={(indexFieldOverride || preview.indexField) === field.name}
                    onChange={() => setIndexFieldOverride(field.name)}
                  />
                  order
                </label>
              </div>
            ))}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
};
