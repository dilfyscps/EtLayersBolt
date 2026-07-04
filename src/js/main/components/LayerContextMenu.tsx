import type { LayerRecord } from '../types/layers';

interface LayerContextMenuProps {
  layer: LayerRecord;
  x: number;
  y: number;
  isFavorite: boolean;
  onAction(action: string, value?: string): void;
  onFavorite(): void;
  onClose(): void;
}

const labelChoices = [
  { name: 'None', value: '0' },
  { name: 'Red', value: '1' },
  { name: 'Yellow', value: '2' },
  { name: 'Blue', value: '8' },
  { name: 'Purple', value: '10' },
  { name: 'Orange', value: '11' },
  { name: 'Cyan', value: '14' },
];

export function LayerContextMenu({ layer, x, y, isFavorite, onAction, onFavorite, onClose }: LayerContextMenuProps) {
  const run = (action: string, value = '') => {
    onAction(action, value);
    onClose();
  };

  return (
    <div className="etl-menu-backdrop" onClick={onClose}>
      <div
        className="etl-menu"
        style={{ left: Math.min(x, window.innerWidth - 208), top: Math.min(y, window.innerHeight - 320) }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="etl-menu-title">{layer.name}</p>
        {[
          ['Reveal in Timeline', 'revealTimeline'],
          ['Reveal in Project', 'revealProject'],
          ['Rename', 'rename'],
          ['Duplicate', 'duplicate'],
          ['Delete', 'delete'],
          [layer.locked ? 'Unlock' : 'Lock', 'lock'],
          [layer.solo ? 'Unsolo' : 'Solo', 'solo'],
          [layer.shy ? 'Unshy' : 'Shy', 'shy'],
        ].map(([label, action]) => (
          <button
            key={action}
            type="button"
            onClick={() => {
              if (action === 'rename') {
                const nextName = window.prompt('Rename layer', layer.name);
                if (nextName) {
                  run(action, nextName);
                }
                return;
              }

              run(action);
            }}
            className="etl-menu-item"
          >
            {label}
          </button>
        ))}
        <div className="etl-menu-separator" />
        <button type="button" onClick={onFavorite} className="etl-menu-item">
          {isFavorite ? 'Remove Favorite' : 'Favorite'}
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(layer.name);
            onClose();
          }}
          className="etl-menu-item"
        >
          Copy Layer Name
        </button>
        <div className="etl-menu-separator" />
        <p className="etl-section-meta">Change Label</p>
        <div className="etl-menu-grid">
          {labelChoices.map((label) => (
            <button
              key={label.value}
              type="button"
              onClick={() => run('label', label.value)}
              className="etl-menu-item"
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
