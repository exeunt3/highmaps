import type { EmbeddedPoint } from '../../types/models';
import { transformRegistry } from './registry';

transformRegistry.registerTransform({
  id: 'identity',
  name: 'Identity',
  paramSchema: {},
  apply: (points) => points.map((point) => ({ ...point })),
});

transformRegistry.registerTransform({
  id: 'spiral_wrap_2d',
  name: 'Spiral Wrap 2D',
  paramSchema: {
    period: 7,
    tightness: 1,
    radius_scale: 1,
  },
  apply: (points: EmbeddedPoint[], params: Record<string, number>) => {
    const period = Math.max(1, params.period ?? 7);
    const tightness = params.tightness ?? 1;
    const radiusScale = params.radius_scale ?? 1;

    return points.map((point, i) => {
      const theta = 2 * Math.PI * (i / period) * tightness;
      const radius = radiusScale * (i / period);
      return {
        ...point,
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
      };
    });
  },
});
