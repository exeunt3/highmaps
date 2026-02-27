import type { Dataset } from '../../types/models';

const escapeCsv = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
};

export const datasetToCsv = (dataset: Dataset): string => {
  if (dataset.rows.length === 0) return '';
  const headers = Object.keys(dataset.rows[0]);
  const lines = [headers.join(',')];
  for (const row of dataset.rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }
  return lines.join('\n');
};

export const datasetToJson = (dataset: Dataset): string => JSON.stringify(dataset, null, 2);

export const downloadText = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
