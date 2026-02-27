import type { Dataset, DatasetRow, FieldSchema, FieldType } from '../../types/models';

const toCellValue = (raw: string): string | number | null => {
  const value = raw.trim();
  if (value === '') return null;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && /^-?\d+(\.\d+)?$/.test(value)) return asNumber;
  return value;
};

export const parseCsv = (name: string, content: string): Dataset => {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must include header and at least one data row.');

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: DatasetRow[] = lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(',');
    const row: DatasetRow = { id: `row-${rowIndex + 1}` };
    headers.forEach((header, idx) => {
      row[header] = toCellValue(cells[idx] ?? '');
    });
    return row;
  });

  return {
    id: crypto.randomUUID(),
    name,
    rows,
  };
};

const inferFieldType = (values: Array<string | number | boolean | null>): FieldType => {
  const nonNull = values.filter((v) => v !== null);
  if (nonNull.length === 0) return 'category';
  if (nonNull.every((v) => typeof v === 'number')) return 'number';
  if (nonNull.every((v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)))) return 'time';
  return 'category';
};

export const inferSchema = (dataset: Dataset): FieldSchema => {
  const fieldNames = Object.keys(dataset.rows[0] ?? {}).filter((k) => k !== 'id');
  const fields = fieldNames.map((name) => ({
    name,
    type: inferFieldType(dataset.rows.map((row) => row[name] as string | number | boolean | null)),
  }));

  const indexField = fields.find((field) => field.type === 'time')?.name ?? fields[0]?.name ?? 'id';

  return {
    datasetId: dataset.id,
    indexField,
    fields,
  };
};
