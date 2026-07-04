import type { BatchCaseMode, BatchRenameOptions, LayerRecord } from '../types/layers';
import { Button } from './Button';

interface BatchRenamePanelProps {
  layers: LayerRecord[];
  selectedLayerIds: string[];
  options: BatchRenameOptions;
  onChange(options: BatchRenameOptions): void;
  onApply(): void;
  disabled?: boolean;
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function previewBatchName(name: string, options: BatchRenameOptions, index: number) {
  let nextName = name;

  if (options.search) {
    if (options.useRegex) {
      try {
        nextName = nextName.replace(new RegExp(options.search, 'g'), options.replace);
      } catch {
        nextName = name;
      }
    } else {
      nextName = nextName.split(options.search).join(options.replace);
    }
  }

  if (options.caseMode === 'uppercase') {
    nextName = nextName.toUpperCase();
  } else if (options.caseMode === 'lowercase') {
    nextName = nextName.toLowerCase();
  } else if (options.caseMode === 'title') {
    nextName = titleCase(nextName);
  }

  nextName = `${options.prefix}${nextName}${options.suffix}`;

  if (options.startNumber > 0) {
    nextName = `${nextName} ${options.startNumber + index}`;
  }

  return nextName;
}

export function BatchRenamePanel({ layers, selectedLayerIds, options, onChange, onApply, disabled }: BatchRenamePanelProps) {
  const targetLayers = options.applyTo === 'selected'
    ? layers.filter((layer) => selectedLayerIds.includes(layer.id))
    : layers;
  const previewLayers = targetLayers.slice(0, 5);

  const update = (patch: Partial<BatchRenameOptions>) => onChange({ ...options, ...patch });

  return (
    <div className="etl-form-stack">
      <div className="etl-form-grid">
        <input value={options.search} onChange={(event) => update({ search: event.target.value })} placeholder="Find" className="etl-input" />
        <input value={options.replace} onChange={(event) => update({ replace: event.target.value })} placeholder="Replace" className="etl-input" />
        <input value={options.prefix} onChange={(event) => update({ prefix: event.target.value })} placeholder="Prefix" className="etl-input" />
        <input value={options.suffix} onChange={(event) => update({ suffix: event.target.value })} placeholder="Suffix" className="etl-input" />
      </div>

      <div className="etl-form-grid">
        <label className="etl-check-row">
          <input type="checkbox" checked={options.useRegex} onChange={(event) => update({ useRegex: event.target.checked })} />
          Regex
        </label>
        <input type="number" min={0} value={options.startNumber} onChange={(event) => update({ startNumber: Number(event.target.value) || 0 })} placeholder="Start #" className="etl-input" />
      </div>

      <div className="etl-form-grid">
        <select value={options.caseMode} onChange={(event) => update({ caseMode: event.target.value as BatchCaseMode })} className="etl-select">
          <option value="none">Keep Case</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="title">Title Case</option>
        </select>
        <select value={options.applyTo} onChange={(event) => update({ applyTo: event.target.value as BatchRenameOptions['applyTo'] })} className="etl-select">
          <option value="selected">Selected</option>
          <option value="results">Search Results</option>
        </select>
      </div>

      <div className="etl-info-block">
        <div className="etl-preview-head">
          <p className="etl-section-meta">Live Preview</p>
          <p className="etl-muted">{targetLayers.length} target{targetLayers.length === 1 ? '' : 's'}</p>
        </div>
        <div className="etl-preview-list">
          {previewLayers.length === 0 ? (
            <p className="etl-muted">Select layers or choose Search Results.</p>
          ) : (
            previewLayers.map((layer, index) => (
              <div key={layer.id} className="etl-preview-row">
                <p className="etl-muted">{layer.name}</p>
                <p className="etl-strong">{previewBatchName(layer.name, options, index)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <Button tone="primary" className="etl-button--full" disabled={disabled || targetLayers.length === 0} onClick={onApply}>
        Apply Batch Rename
      </Button>
    </div>
  );
}
