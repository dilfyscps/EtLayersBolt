import { Button } from './Button';

export interface EtLayersPreferences {
  autoRefreshInterval: number;
  defaultIncludePrecomps: boolean;
  compactResults: boolean;
  animations: boolean;
  accentColor: string;
  searchBehavior: 'contains' | 'startsWith';
  rememberUiState: boolean;
  showBridgeStatus: boolean;
  updateEndpoint: string;
}

interface SettingsPanelProps {
  preferences: EtLayersPreferences;
  onChange(preferences: EtLayersPreferences): void;
  onReset(): void;
}

export const defaultPreferences: EtLayersPreferences = {
  autoRefreshInterval: 400,
  defaultIncludePrecomps: false,
  compactResults: false,
  animations: true,
  accentColor: '#9b7cff',
  searchBehavior: 'contains',
  rememberUiState: true,
  showBridgeStatus: true,
  updateEndpoint: 'https://api.github.com/repos/Etvrnity/EtLayers/releases/latest',
};

export function SettingsPanel({ preferences, onChange, onReset }: SettingsPanelProps) {
  const update = (patch: Partial<EtLayersPreferences>) => onChange({ ...preferences, ...patch });

  return (
    <div className="etl-form-stack">
      <label className="etl-field-label">
        <span className="etl-field-title">Auto Refresh Interval</span>
        <input
          type="number"
          min={300}
          step={50}
          value={preferences.autoRefreshInterval}
          onChange={(event) => update({ autoRefreshInterval: Number(event.target.value) || 400 })}
          className="etl-input"
        />
      </label>

      <label className="etl-field-label">
        <span className="etl-field-title">Accent Color</span>
        <input
          type="color"
          value={preferences.accentColor}
          onChange={(event) => update({ accentColor: event.target.value })}
          className="etl-input"
        />
      </label>

      <label className="etl-field-label">
        <span className="etl-field-title">Search Behavior</span>
        <select
          value={preferences.searchBehavior}
          onChange={(event) => update({ searchBehavior: event.target.value as EtLayersPreferences['searchBehavior'] })}
          className="etl-select"
        >
          <option value="contains">Contains</option>
          <option value="startsWith">Starts With</option>
        </select>
      </label>

      {[
        ['Default Include Precomps', 'defaultIncludePrecomps'],
        ['Compact Mode', 'compactResults'],
        ['Animations', 'animations'],
        ['Remember UI State', 'rememberUiState'],
        ['Show Bridge Status', 'showBridgeStatus'],
      ].map(([label, key]) => (
        <label key={key} className="etl-check-row">
          <span className="etl-strong">{label}</span>
          <input
            type="checkbox"
            checked={Boolean(preferences[key as keyof EtLayersPreferences])}
            onChange={(event) => update({ [key]: event.target.checked } as Partial<EtLayersPreferences>)}
          />
        </label>
      ))}

      <label className="etl-field-label">
        <span className="etl-field-title">Update Endpoint</span>
        <input
          value={preferences.updateEndpoint}
          onChange={(event) => update({ updateEndpoint: event.target.value })}
          className="etl-input etl-input--small"
        />
      </label>

      <Button className="etl-button--full" onClick={onReset}>
        Reset Settings
      </Button>
    </div>
  );
}
