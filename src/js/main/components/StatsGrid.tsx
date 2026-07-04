import type { CompositionStats } from '../types/layers';
import { formatNumber } from '../lib/format';

interface StatsGridProps {
  stats: CompositionStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const items = [
    ['Layers', stats.layers],
    ['Text', stats.text],
    ['Shapes', stats.shapes],
    ['Nulls', stats.nulls],
    ['Solids', stats.solids],
    ['Adjustments', stats.adjustments],
    ['Cameras', stats.cameras],
    ['Lights', stats.lights],
    ['Locked', stats.locked],
    ['Hidden', stats.hidden],
    ['Disabled', stats.disabled],
    ['Broken Expressions', stats.brokenExpressions],
  ];

  return (
    <div className="etl-stats-grid">
      {items.map(([label, value]) => (
        <div key={label} className="etl-stat">
          <p className="etl-stat-label">{label}</p>
          <p className="etl-stat-value">{formatNumber(value as number)}</p>
        </div>
      ))}
    </div>
  );
}
