import type { Dataset, DerivedDataset, EmbeddedPoint } from '../../types/models';

export interface ExtractorDefinition {
  id: string;
  name: string;
  paramSchema: Record<string, number>;
  preview: (points: EmbeddedPoint[], params: Record<string, number>) => Set<string>;
  materialize: (
    dataset: Dataset,
    points: EmbeddedPoint[],
    params: Record<string, number>,
  ) => DerivedDataset;
}

class ExtractorRegistry {
  private readonly extractors = new Map<string, ExtractorDefinition>();

  registerExtractor(def: ExtractorDefinition): void {
    this.extractors.set(def.id, def);
  }

  get(id: string): ExtractorDefinition {
    const found = this.extractors.get(id);
    if (!found) throw new Error(`Extractor not found: ${id}`);
    return found;
  }

  list(): ExtractorDefinition[] {
    return [...this.extractors.values()];
  }
}

export const extractorRegistry = new ExtractorRegistry();
