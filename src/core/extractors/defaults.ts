import type { DatasetRow } from '../../types/models';
import { extractorRegistry } from './registry';

extractorRegistry.registerExtractor({
  id: 'phase_trace',
  name: 'Phase Trace',
  paramSchema: {
    period: 7,
    phase: 6,
  },
  preview: (points, params) => {
    const period = Math.max(1, Math.floor(params.period ?? 7));
    const phase = Math.max(0, Math.floor(params.phase ?? 0));
    const selected = new Set<string>();
    points.forEach((point, i) => {
      if (i % period === phase) selected.add(point.id);
    });
    return selected;
  },
  materialize: (dataset, points, params) => {
    const period = Math.max(1, Math.floor(params.period ?? 7));
    const phase = Math.max(0, Math.floor(params.phase ?? 0));
    const selectedIds = new Set<string>();
    points.forEach((point, i) => {
      if (i % period === phase) selectedIds.add(point.id);
    });

    const orderedRows = points
      .map((point) => dataset.rows.find((row) => row.id === point.id))
      .filter((row): row is DatasetRow => Boolean(row));

    const rows = orderedRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => selectedIds.has(row.id))
      .map(({ row, i }) => ({
        ...row,
        source_row_id: row.id,
        cycle_number: Math.floor(i / period),
        phase,
      }));

    return {
      id: crypto.randomUUID(),
      name: `${dataset.name} - phase trace`,
      sourceDatasetId: dataset.id,
      extractorId: 'phase_trace',
      rows,
    };
  },
});
