interface AboutModalProps {
  version: string;
  onClose(): void;
}

export function AboutModal({ version, onClose }: AboutModalProps) {
  return (
    <div className="etl-modal-backdrop" onClick={onClose}>
      <div
        className="etl-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="etl-modal-head">
          <div className="etl-brand">
            <p className="etl-title">EtLayers</p>
            <p className="etl-section-meta">Version {version}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="etl-close"
            aria-label="Close About"
          >
            X
          </button>
        </div>

        <div className="etl-info-block">
          <p className="etl-strong">Built by Etvrnity</p>
          <p className="etl-muted">
            A premium After Effects panel for layer search, navigation, organization, and project inspection.
          </p>
        </div>
      </div>
    </div>
  );
}
