import type { EmbeddedPoint } from '../../types/models';

export interface TransformDefinition {
  id: string;
  name: string;
  paramSchema: Record<string, number>;
  apply: (points: EmbeddedPoint[], params: Record<string, number>) => EmbeddedPoint[];
}

class TransformRegistry {
  private readonly transforms = new Map<string, TransformDefinition>();

  registerTransform(def: TransformDefinition): void {
    this.transforms.set(def.id, def);
  }

  get(id: string): TransformDefinition {
    const found = this.transforms.get(id);
    if (!found) throw new Error(`Transform not found: ${id}`);
    return found;
  }

  list(): TransformDefinition[] {
    return [...this.transforms.values()];
  }
}

export const transformRegistry = new TransformRegistry();
