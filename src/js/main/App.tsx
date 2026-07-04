import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { version } from '../../shared/shared';
import { AboutModal } from './components/AboutModal';
import { BatchRenamePanel } from './components/BatchRenamePanel';
import { Button } from './components/Button';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { HelpResources } from './components/HelpResources';
import { LayerContextMenu } from './components/LayerContextMenu';
import { LayerList } from './components/LayerList';
import { ProjectIssueList } from './components/ProjectIssueList';
import { SearchInput } from './components/SearchInput';
import { SectionCard } from './components/SectionCard';
import { defaultPreferences, SettingsPanel, type EtLayersPreferences } from './components/SettingsPanel';
import { StatsGrid } from './components/StatsGrid';
import { StatusPanel } from './components/StatusPanel';
import { TabNav, type EtLayersTab, type TabItem } from './components/TabNav';
import { etLayersBridge } from './lib/cepBridge';
import { emptyStats } from './lib/mockData';
import {
  markStartupReady,
  recordStartupStage,
  reportStartupFatal,
  type StartupDiagnosticDetails,
  toStartupDiagnosticDetails,
} from './lib/startupDiagnostics';
import type { BatchRenameOptions, EtLayersSnapshot, LayerRecord, ProjectAudit, ProjectIssue, UpdateInfo } from './types/layers';

const APP_VERSION = version;
const STORAGE_KEY = 'etlayers:v1';

const tabs: TabItem[] = [
  { id: 'search', label: 'Search', description: 'Find and select layers' },
  { id: 'stats', label: 'Stats', description: 'Inspect composition statistics' },
  { id: 'project', label: 'Project', description: 'Find missing media and project issues' },
  { id: 'tools', label: 'Tools', description: 'Run layer utilities' },
  { id: 'settings', label: 'Settings', description: 'Configure EtLayers preferences' },
  { id: 'help', label: 'Help', description: 'Documentation, support, and release details' },
];

function normalizeTab(value: string | null): EtLayersTab {
  if (value === 'search' || value === 'stats' || value === 'project' || value === 'tools' || value === 'settings' || value === 'help') {
    return value;
  }

  if (value === 'about') {
    return 'help';
  }

  return 'search';
}

function readStoredState<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(`${STORAGE_KEY}:${key}`);
    return value ? ({ ...fallback, ...JSON.parse(value) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredArray(key: string): string[] {
  try {
    const value = window.localStorage.getItem(`${STORAGE_KEY}:${key}`);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function writeStoredValue(key: string, value: unknown) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${key}`, JSON.stringify(value));
  } catch {
    // CEP localStorage can be disabled in some hardened environments.
  }
}

function getInitialSnapshot(): EtLayersSnapshot {
  return {
    comp: null,
    stats: emptyStats,
    layers: [],
    projectFingerprint: '',
    refreshedAt: '',
  };
}

function StartupFatalScreen({ details }: { details: StartupDiagnosticDetails }) {
  return (
    <main className="etl-shell etl-fatal">
      <section className="etl-modal">
        <p className="etl-section-meta">EtLayers Fatal Startup Error</p>
        <h1 className="etl-title">Startup failed</h1>
        <p className="etl-muted">
          EtLayers stopped startup before showing the main UI so the panel does not stay black.
        </p>

        <div className="etl-form-stack">
          <p className="etl-muted"><span className="etl-strong">Startup stage:</span> {details.stage}</p>
          <p className="etl-muted"><span className="etl-strong">Error message:</span> {details.message}</p>
          <p className="etl-muted"><span className="etl-strong">Host function:</span> {String(details.hostFunction || 'n/a')}</p>
          <p className="etl-muted"><span className="etl-strong">File:</span> {String(details.file || 'n/a')}</p>
        </div>

        <pre className="etl-info-block">
          {JSON.stringify({
            stage: details.stage,
            message: details.message,
            stack: details.stack || '',
            hostFunction: details.hostFunction || '',
            file: details.file || '',
            evalScript: details.evalScript || '',
            rawResult: details.rawResult || '',
          }, null, 2)}
        </pre>
      </section>
    </main>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<EtLayersSnapshot>(getInitialSnapshot);
  const [query, setQuery] = useState(() => readStoredArray('searchHistory')[0] || '');
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [startupFailure, setStartupFailure] = useState<StartupDiagnosticDetails | null>(null);
  const [activeTab, setActiveTab] = useState<EtLayersTab>(() => {
    try {
      return normalizeTab(JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:activeTab`) || '"search"'));
    } catch {
      return 'search';
    }
  });
  const [includePrecomps, setIncludePrecomps] = useState(() => readStoredState('preferences', defaultPreferences).defaultIncludePrecomps);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [projectAudit, setProjectAudit] = useState<ProjectAudit | null>(null);
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => readStoredState('expandedGroups', {}));
  const [preferences, setPreferences] = useState<EtLayersPreferences>(() => readStoredState('preferences', defaultPreferences));
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readStoredArray('searchHistory').slice(0, 10));
  const [favoriteLayerIds, setFavoriteLayerIds] = useState<string[]>(() => readStoredArray('favorites'));
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteActiveIndex, setPaletteActiveIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ layer: LayerRecord; x: number; y: number } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [batchOptions, setBatchOptions] = useState<BatchRenameOptions>({
    search: '',
    replace: '',
    prefix: '',
    suffix: '',
    startNumber: 0,
    useRegex: false,
    caseMode: 'none',
    applyTo: 'selected',
    layerIds: [],
  });
  const cepAvailable = useMemo(() => etLayersBridge.isCepAvailable(), []);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const queryRef = useRef(query);
  const includePrecompsRef = useRef(includePrecomps);
  const fingerprintRef = useRef(snapshot.projectFingerprint);
  const pollingRef = useRef(false);

  useEffect(() => {
    const keyboardNavigationClass = 'etl-keyboard-navigation';
    const { body, documentElement } = document;

    function disableKeyboardNavigation() {
      body.classList.remove(keyboardNavigationClass);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        body.classList.add(keyboardNavigationClass);
      }
    }

    disableKeyboardNavigation();

    const animationFrame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement && activeElement !== body && activeElement !== documentElement) {
        activeElement.blur();
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', disableKeyboardNavigation);
    document.addEventListener('touchstart', disableKeyboardNavigation);
    document.addEventListener('pointerdown', disableKeyboardNavigation);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', disableKeyboardNavigation);
      document.removeEventListener('touchstart', disableKeyboardNavigation);
      document.removeEventListener('pointerdown', disableKeyboardNavigation);
      disableKeyboardNavigation();
    };
  }, []);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    includePrecompsRef.current = includePrecomps;
  }, [includePrecomps]);

  useEffect(() => {
    fingerprintRef.current = snapshot.projectFingerprint;
  }, [snapshot.projectFingerprint]);

  useEffect(() => {
    if (!preferences.rememberUiState) {
      return;
    }

    writeStoredValue('preferences', preferences);
    writeStoredValue('activeTab', activeTab);
    writeStoredValue('searchHistory', searchHistory.slice(0, 10));
    writeStoredValue('favorites', favoriteLayerIds);
    writeStoredValue('expandedGroups', expandedGroups);
  }, [activeTab, expandedGroups, favoriteLayerIds, preferences, searchHistory]);

  useEffect(() => {
    document.documentElement.style.setProperty('--color-et-violet', preferences.accentColor);
  }, [preferences.accentColor]);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSearchHistory((current) => [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 10));
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setActiveResultIndex((current) => Math.min(current, Math.max(snapshot.layers.length - 1, 0)));
  }, [snapshot.layers.length]);

  function applySnapshot(nextSnapshot: EtLayersSnapshot) {
    setSnapshot(nextSnapshot);
    setSelectedLayerIds(nextSnapshot.layers.filter((layer) => layer.selected).map((layer) => layer.id));
    fingerprintRef.current = nextSnapshot.projectFingerprint;
  }

  function refineSnapshot(nextSnapshot: EtLayersSnapshot, searchText: string) {
    if (preferences.searchBehavior !== 'startsWith' || !searchText.trim()) {
      return nextSnapshot;
    }

    const normalized = searchText.trim().toLowerCase();

    return {
      ...nextSnapshot,
      layers: nextSnapshot.layers.filter((layer) =>
        [layer.name, layer.type, layer.labelName, layer.locked ? 'locked' : '', layer.shy ? 'hidden shy' : '', layer.solo ? 'solo' : '', layer.selected ? 'selected' : '', layer.parented ? 'parented' : '']
          .join(' ')
          .toLowerCase()
          .startsWith(normalized),
      ),
    };
  }

  const refresh = useCallback(async () => {
    setIsBusy(true);
    setError('');
    const startedAt = performance.now();

    try {
      const nextSnapshot = await etLayersBridge.searchLayers(queryRef.current, includePrecompsRef.current);
      applySnapshot(refineSnapshot(nextSnapshot, queryRef.current));
      setProjectAudit(await etLayersBridge.getProjectAudit());
      setSearchElapsedMs(Math.round(performance.now() - startedAt));
      setStatus(nextSnapshot.comp ? 'Composition refreshed.' : 'Open a composition in After Effects.');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Refresh failed.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      setIsBusy(true);

      try {
        recordStartupStage('Initializing...');
        await etLayersBridge.initialize();
        recordStartupStage('Initializing...', { message: 'Loading initial layer snapshot.' });
        const nextSnapshot = await etLayersBridge.searchLayers(queryRef.current, includePrecompsRef.current);

        if (!isMounted) {
          return;
        }

        applySnapshot(refineSnapshot(nextSnapshot, queryRef.current));
        setProjectAudit(await etLayersBridge.getProjectAudit());
        setStatus(nextSnapshot.comp ? 'Connected and ready.' : 'Open a composition in After Effects.');
        setHasInitialized(true);
        recordStartupStage('Ready.');
        markStartupReady();
      } catch (bootError) {
        if (isMounted) {
          const details = toStartupDiagnosticDetails(bootError, 'Initializing...');

          setStartupFailure(details);
          setError(details.message);
          reportStartupFatal(details);
        }
      } finally {
        if (isMounted) {
          setIsBusy(false);
        }
      }
    }

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cepAvailable || !hasInitialized) {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      if (pollingRef.current) {
        return;
      }

      pollingRef.current = true;

      try {
        const projectState = await etLayersBridge.getProjectState();

        if (projectState.fingerprint !== fingerprintRef.current) {
          const nextSnapshot = await etLayersBridge.searchLayers(queryRef.current, includePrecompsRef.current);

          applySnapshot(refineSnapshot(nextSnapshot, queryRef.current));
          setProjectAudit(await etLayersBridge.getProjectAudit());
          setStatus(projectState.comp ? 'Auto refreshed.' : 'Open a composition in After Effects.');
        }
      } catch {
        // Background polling must never interrupt foreground workflows.
      } finally {
        pollingRef.current = false;
      }
    }, preferences.autoRefreshInterval);

    return () => window.clearInterval(interval);
  }, [cepAvailable, hasInitialized, preferences.autoRefreshInterval]);

  useEffect(() => {
    if (!hasInitialized) {
      return undefined;
    }

    let isMounted = true;
    const timeout = window.setTimeout(async () => {
      setError('');
      setIsSearching(true);
      const startedAt = performance.now();

      try {
        const nextSnapshot = await etLayersBridge.searchLayers(query, includePrecomps);

        if (isMounted) {
          applySnapshot(refineSnapshot(nextSnapshot, query));
          setSearchElapsedMs(Math.round(performance.now() - startedAt));
        }
      } catch (searchError) {
        if (isMounted) {
          setError(searchError instanceof Error ? searchError.message : 'Search failed.');
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
  }, [hasInitialized, query, includePrecomps]);

  async function handleAutoLabels() {
    setIsBusy(true);
    setError('');

    try {
      const result = await etLayersBridge.autoLabels();
      const startedAt = performance.now();
      const nextSnapshot = await etLayersBridge.searchLayers(queryRef.current, includePrecompsRef.current);
      applySnapshot(refineSnapshot(nextSnapshot, queryRef.current));
      setSearchElapsedMs(Math.round(performance.now() - startedAt));
      setStatus(`Applied labels to ${result.applied} of ${result.total} layers.`);
    } catch (autoLabelError) {
      setError(autoLabelError instanceof Error ? autoLabelError.message : 'Auto Labels failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectLayer(layer: LayerRecord) {
    setError('');

    try {
      const updatedLayer = await etLayersBridge.toggleLayerSelection(layer);
      const isSelected = updatedLayer.selected;

      setSnapshot((current) => ({
        ...current,
        layers: current.layers.map((currentLayer) => (currentLayer.id === updatedLayer.id ? { ...currentLayer, selected: isSelected } : currentLayer)),
      }));
      setSelectedLayerIds((current) => {
        if (isSelected) {
          return current.indexOf(updatedLayer.id) === -1 ? current.concat(updatedLayer.id) : current;
        }

        return current.filter((id) => id !== updatedLayer.id);
      });
      setSelectedLayerId(isSelected ? updatedLayer.id : '');
      setStatus(`${isSelected ? 'Selected' : 'Deselected'} ${layer.name}.`);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Layer selection failed.');
    }
  }

  async function handleRevealProjectIssue(issue: ProjectIssue) {
    setError('');

    try {
      const nextAudit = await etLayersBridge.revealProjectItem(issue.itemId);
      setProjectAudit(nextAudit);
      setStatus(`Revealed ${issue.name}.`);
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : 'Reveal failed.');
    }
  }

  async function handleOpenProjectIssue(issue: ProjectIssue) {
    setError('');

    try {
      const nextAudit = await etLayersBridge.openProjectItem(issue.itemId);
      setProjectAudit(nextAudit);
      setStatus(`Opened ${issue.name}.`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Open failed.');
    }
  }

  async function handleLayerAction(layer: LayerRecord, action: string, value = '') {
    setError('');

    try {
      const result = await etLayersBridge.layerAction(layer, action, value);

      if (result.layer) {
        setSnapshot((current) => ({
          ...current,
          layers: current.layers.map((currentLayer) => (currentLayer.id === result.layer?.id ? result.layer : currentLayer)),
        }));
      } else {
        await refresh();
      }

      setStatus(result.message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Layer action failed.');
    }
  }

  function toggleFavorite(layer: LayerRecord) {
    setFavoriteLayerIds((current) => (
      current.includes(layer.id) ? current.filter((id) => id !== layer.id) : [layer.id, ...current]
    ));
  }

  async function handleBatchRename() {
    setIsBusy(true);
    setError('');

    try {
      const layerIds = batchOptions.applyTo === 'selected' ? selectedLayerIds : snapshot.layers.map((layer) => layer.id);
      const result = await etLayersBridge.batchRename({ ...batchOptions, layerIds });
      await refresh();
      setStatus(`Renamed ${result.renamed} of ${result.total} layers.`);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Batch rename failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function runSelectionAction(action: string) {
    setError('');

    try {
      const result = await etLayersBridge.selectionAction(action);
      await refresh();
      setStatus(`Applied ${action} to ${result.applied} layer${result.applied === 1 ? '' : 's'}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Selection action failed.');
    }
  }

  async function checkUpdates() {
    setUpdateError('');

    try {
      const nextUpdateInfo = await etLayersBridge.checkForUpdate(preferences.updateEndpoint, APP_VERSION);
      setUpdateInfo(nextUpdateInfo);
      setStatus(nextUpdateInfo.hasUpdate ? `EtLayers ${nextUpdateInfo.latestVersion} is available.` : 'EtLayers is up to date.');
    } catch (updateCheckError) {
      setUpdateError(updateCheckError instanceof Error ? updateCheckError.message : 'Update check failed.');
    }
  }

  function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const activeLayer = snapshot.layers[activeResultIndex] || snapshot.layers[0] || null;

  const commands: CommandItem[] = [
    { id: 'rename-layers', label: 'Rename Layers', hint: 'Open batch rename tools', run: () => setActiveTab('tools') },
    { id: 'find-camera', label: 'Find Camera', hint: 'Search by layer type', run: () => setQuery('camera') },
    { id: 'find-nulls', label: 'Find Nulls', hint: 'Search null layers', run: () => setQuery('null') },
    { id: 'find-text', label: 'Find Text', hint: 'Search text layers', run: () => setQuery('text') },
    { id: 'batch-rename', label: 'Batch Rename', hint: 'Open live rename preview', run: () => setActiveTab('tools') },
    { id: 'lock-selected', label: 'Lock Selected', hint: 'Lock selected After Effects layers', run: () => runSelectionAction('lockSelected') },
    { id: 'solo-selected', label: 'Solo Selected', hint: 'Solo selected After Effects layers', run: () => runSelectionAction('soloSelected') },
    { id: 'reveal-timeline', label: 'Reveal in Timeline', hint: 'Jump to the active result', run: () => activeLayer && handleLayerAction(activeLayer, 'revealTimeline') },
    { id: 'reveal-project', label: 'Reveal in Project', hint: 'Reveal source of active result', run: () => activeLayer && handleLayerAction(activeLayer, 'revealProject') },
    { id: 'open-settings', label: 'Open Settings', hint: 'Configure EtLayers', run: () => setActiveTab('settings') },
    { id: 'open-help', label: 'Open Help', hint: 'Documentation and support', run: () => setActiveTab('help') },
  ];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCommand = event.metaKey || event.ctrlKey;

      if (isCommand && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setActiveTab('search');
        searchInputRef.current?.focus();
      } else if (isCommand && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery('');
      } else if (event.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (query) {
          setQuery('');
        }
      } else if (activeTab === 'search' && event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveResultIndex((current) => Math.min(current + 1, snapshot.layers.length - 1));
      } else if (activeTab === 'search' && event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveResultIndex((current) => Math.max(current - 1, 0));
      } else if (activeTab === 'search' && event.key === 'Enter' && activeLayer) {
        event.preventDefault();
        handleSelectLayer(activeLayer);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLayer, activeTab, paletteOpen, query, snapshot.layers.length]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      checkUpdates();
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, []);

  const resultLabel = snapshot.comp
    ? `${snapshot.layers.length} ${snapshot.layers.length === 1 ? 'result' : 'results'}${includePrecomps ? ' incl. precomps' : ''}`
    : 'No active comp';

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: current[groupId] === false,
    }));
  }

  if (startupFailure) {
    return <StartupFatalScreen details={startupFailure} />;
  }

  return (
    <main className={`etl-shell ${preferences.animations ? '' : 'et-no-motion'}`}>
      <div className="etl-app">
        <header className="etl-titlebar">
          <div className="etl-title-row">
            <div className="etl-brand">
              <div className="etl-brand-line">
                <h1 className="etl-title">EtLayers</h1>
                <p className="etl-vendor">Etvrnity</p>
              </div>
              <p className="etl-subtitle">After Effects layer tools</p>
            </div>

            <div className="etl-state-pill">
              <p className="etl-version">v{APP_VERSION}</p>
              <p className="etl-ready">{updateInfo?.hasUpdate ? 'Update' : isBusy ? 'Working' : 'Ready'}</p>
            </div>
          </div>

          <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </header>

        <div className="etl-content">
          {activeTab === 'search' ? (
            <div className="etl-view">
              <SectionCard title="Search Layers" eyebrow="Command" className="etl-section--inline">
                <SearchInput
                  ref={searchInputRef}
                  value={query}
                  disabled={!snapshot.comp || isBusy}
                  includePrecomps={includePrecomps}
                  history={searchHistory}
                  onChange={setQuery}
                  onIncludePrecompsChange={setIncludePrecomps}
                  onHistorySelect={setQuery}
                />
              </SectionCard>

              <SectionCard
                title="Search Results"
                eyebrow={resultLabel}
                className="etl-section--fill"
                contentClassName="etl-section-body--fill"
              >
                {snapshot.comp ? (
                  <LayerList
                    layers={snapshot.layers}
                    disabled={isBusy}
                    onSelect={handleSelectLayer}
                    compact={preferences.compactResults}
                    className="etl-section-body--fill"
                    selectedLayerId={selectedLayerId}
                    selectedLayerIds={selectedLayerIds}
                    activeLayerId={activeLayer?.id}
                    expandedGroups={expandedGroups}
                    onContextMenu={(layer, x, y) => setContextMenu({ layer, x, y })}
                    onToggleGroup={toggleGroup}
                  />
                ) : (
                  <div className="etl-empty">
                    Open a composition in After Effects, then press Refresh to index layers.
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {activeTab === 'stats' ? (
            <div className="etl-scroll-view">
              <SectionCard title="Composition Statistics" eyebrow={snapshot.comp ? `${snapshot.comp.width} x ${snapshot.comp.height}` : 'Inactive'}>
                <StatsGrid stats={snapshot.stats} />
              </SectionCard>
            </div>
          ) : null}

          {activeTab === 'project' ? (
            <SectionCard
              title="Project"
              eyebrow="Missing Media Finder"
              className="etl-section--fill"
              contentClassName="etl-section-body--fill"
            >
              <div className="etl-group-chips">
                {(projectAudit?.groups || []).map((group) => (
                  <span key={group.type} className="etl-chip">
                    {group.label} ({group.count})
                  </span>
                ))}
              </div>

              <ProjectIssueList audit={projectAudit} onReveal={handleRevealProjectIssue} onOpen={handleOpenProjectIssue} />
            </SectionCard>
          ) : null}

          {activeTab === 'tools' ? (
            <SectionCard title="Tools" eyebrow="Layer Utilities" className="etl-section--fill" contentClassName="etl-section-body--fill">
              <div className="etl-tool-list">
                <div className="etl-info-block">
                  <h3 className="etl-strong">Batch Rename</h3>
                  <p className="etl-muted">
                    Search and replace, regex, prefix, suffix, numbering, and case conversion with live preview.
                  </p>
                  <div className="etl-compact-stack">
                    <BatchRenamePanel
                      layers={snapshot.layers}
                      selectedLayerIds={selectedLayerIds}
                      options={{ ...batchOptions, layerIds: batchOptions.applyTo === 'selected' ? selectedLayerIds : snapshot.layers.map((layer) => layer.id) }}
                      onChange={setBatchOptions}
                      onApply={handleBatchRename}
                      disabled={isBusy}
                    />
                  </div>
                </div>

                <div className="etl-info-block">
                  <h3 className="etl-strong">Auto Labels</h3>
                  <p className="etl-muted">
                    Apply consistent label colors to text, shapes, nulls, solids, adjustments, cameras, and lights.
                  </p>
                </div>

                <div className="etl-info-block">
                  <h3 className="etl-strong">Refresh Index</h3>
                  <p className="etl-muted">
                    Rebuild the layer search index and composition statistics from the active comp.
                  </p>
                </div>
              </div>

              <div className="etl-tool-actions">
                <Button tone="primary" className="etl-button--full" disabled={!snapshot.comp || isBusy} onClick={handleAutoLabels}>
                  Auto Labels
                </Button>
                <Button className="etl-button--full" disabled={isBusy} onClick={refresh}>
                  Refresh
                </Button>
              </div>
            </SectionCard>
          ) : null}

          {activeTab === 'settings' ? (
            <SectionCard title="Settings" eyebrow="Preferences" className="etl-section--fill" contentClassName="etl-scroll-view">
              <SettingsPanel
                preferences={preferences}
                onChange={(nextPreferences) => {
                  setPreferences(nextPreferences);
                  setIncludePrecomps(nextPreferences.defaultIncludePrecomps);
                }}
                onReset={() => {
                  setPreferences(defaultPreferences);
                  setIncludePrecomps(defaultPreferences.defaultIncludePrecomps);
                  setStatus('Settings reset.');
                }}
              />
            </SectionCard>
          ) : null}

          {activeTab === 'help' ? (
            <SectionCard title="Help & Resources" eyebrow="Support" className="etl-section--fill" contentClassName="etl-scroll-view">
              <HelpResources
                onOpenUrl={openUrl}
                onOpenAbout={() => setAboutOpen(true)}
              />
            </SectionCard>
          ) : null}
        </div>

        <footer className="etl-footer">
          <StatusPanel
            comp={snapshot.comp}
            status={status}
            error={error}
            cepAvailable={preferences.showBridgeStatus ? cepAvailable : true}
            compact={!preferences.showBridgeStatus}
            elapsedMs={searchElapsedMs}
            isSearching={isSearching || (includePrecomps && isBusy)}
          />
          <div className="etl-footer-links">
            <p className="etl-status-tag">EtLayers v{APP_VERSION}</p>
            <div className="etl-link-row">
              <button type="button" onClick={() => openUrl('https://docs.etvrnity.com')} className="etl-link">
                Documentation
              </button>
              <span className="etl-status-tag">/</span>
              <button type="button" onClick={() => openUrl('https://discord.gg/YHANjsVGyj')} className="etl-link">
                Discord
              </button>
            </div>
          </div>
        </footer>

        <CommandPalette
          open={paletteOpen}
          query={paletteQuery}
          activeIndex={paletteActiveIndex}
          commands={commands}
          onQueryChange={setPaletteQuery}
          onActiveIndexChange={setPaletteActiveIndex}
          onClose={() => setPaletteOpen(false)}
        />

        {contextMenu ? (
          <LayerContextMenu
            layer={contextMenu.layer}
            x={contextMenu.x}
            y={contextMenu.y}
            isFavorite={favoriteLayerIds.includes(contextMenu.layer.id)}
            onAction={(action, value) => handleLayerAction(contextMenu.layer, action, value)}
            onFavorite={() => {
              toggleFavorite(contextMenu.layer);
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        ) : null}
        {aboutOpen ? <AboutModal version={APP_VERSION} onClose={() => setAboutOpen(false)} /> : null}
      </div>
    </main>
  );
}
