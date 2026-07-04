import type { LayerType } from '../types/layers';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatLayerType(type: LayerType): string {
  const labels: Record<LayerType, string> = {
    text: 'Text',
    shape: 'Shape',
    nullLayer: 'Null',
    solid: 'Solid',
    adjustment: 'Adjustment',
    camera: 'Camera',
    light: 'Light',
    other: 'Layer',
    unknown: 'Layer',
  };

  return labels[type];
}
