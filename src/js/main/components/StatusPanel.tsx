import type { CompositionInfo } from '../types/layers';

interface StatusPanelProps {
  comp: CompositionInfo | null;
  status: string;
  error?: string;
  cepAvailable: boolean;
  compact?: boolean;
  elapsedMs?: number;
  isSearching?: boolean;
}

export function StatusPanel({ comp, status, error, cepAvailable, compact = false, elapsedMs = 0, isSearching = false }: StatusPanelProps) {
  const elapsedLabel = isSearching ? 'Searching...' : elapsedMs > 0 ? `${elapsedMs} ms` : '';

  if (compact) {
    return (
      <div className={`etl-status ${error ? 'etl-status--error' : ''}`}>
        {isSearching ? <span className="etl-spinner" /> : null}
        <div className="etl-status-main">
          <p className="etl-status-text">
            {error || status}
          </p>
        </div>
        {elapsedLabel ? <span className="etl-status-tag">{elapsedLabel}</span> : null}
      </div>
    );
  }

  return (
    <div className={`etl-status ${error ? 'etl-status--error' : ''}`}>
      <div className={`etl-status-dot ${error ? 'etl-status-dot--error' : ''}`} />
      <div className="etl-status-main">
        <p className="etl-status-text">{error || status}</p>
        <p className="etl-status-sub">{comp ? comp.name : 'No active composition'}</p>
      </div>
      {isSearching ? <span className="etl-spinner" /> : null}
      {elapsedLabel ? <p className="etl-status-tag">{elapsedLabel}</p> : null}
      <p className="etl-status-tag">{cepAvailable ? 'AE' : 'Preview'}</p>
    </div>
  );
}
