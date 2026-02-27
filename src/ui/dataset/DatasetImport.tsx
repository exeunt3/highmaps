import { useMemo, useState } from 'react';
import { inferSchema, parseCsv } from '../../core/schema/csv';
import { useGeomodeStore } from '../../state/store';
import type { FieldType, ViewConfig } from '../../types/models';

const SAMPLE_CSV = `date,value,group\n2024-01-01,10,A\n2024-01-02,12,A\n2024-01-03,9,B\n2024-01-04,11,B\n2024-01-05,8,A\n2024-01-06,14,A\n2024-01-07,7,B\n2024-01-08,15,B`;

interface Props {
  onLoaded?: () => void;
}

export const DatasetImport = ({ onLoaded }: Props) => {
  const addDataset = useGeomodeStore((s) => s.addDataset);
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
