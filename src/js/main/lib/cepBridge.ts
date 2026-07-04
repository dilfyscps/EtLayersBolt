import type {
  AutoLabelsResult,
  BatchRenameOptions,
  BatchRenameResult,
  EtLayersSnapshot,
  HostResponse,
  LayerActionResult,
  LayerRecord,
  ProjectAudit,
  ProjectState,
  UpdateInfo,
} from '../types/layers';
import { csi } from '../../lib/utils/bolt';
import { emptyStats, mockProjectAudit, mockSnapshot } from './mockData';
import {
  recordStartupStage,
  StartupDiagnosticError,
  type StartupDiagnosticDetails,
} from './startupDiagnostics';

const HOST_SCRIPT = 'jsx/index.js';
const REQUIRED_HOST_METHODS = [
  'refresh',
  'searchLayers',
  'getProjectState',
  'getProjectAudit',
  'revealProjectItem',
  'openProjectItem',
  'getStatistics',
  'autoLabels',
  'toggleLayerSelection',
  'layerAction',
  'selectionAction',
  'batchRename',
] as const;

let hostInitializationPromise: Promise<void> | null = null;

interface EvalScriptContext {
  stage: string;
  hostFunction?: string;
  file?: string;
  evalScript?: string;
}

interface HostBridgeStatus {
  defined: boolean;
  missing: string[];
  methods: Record<string, boolean>;
}

function isCepAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.cep || window.__adobe_cep__);
}

function getCSInterface() {
  if (!isCepAvailable()) {
    return null;
  }

  return csi;
}

function escapeForExtendScript(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function parseHostResponse<T>(raw: string): HostResponse<T> {
  if (!raw) {
    return {
      ok: false,
      data: null,
      error: 'After Effects returned an empty response.',
    };
  }

  try {
    return JSON.parse(raw) as HostResponse<T>;
  } catch {
    return {
      ok: false,
      data: null,
      error: raw,
    };
  }
}

function createStartupError(
  context: EvalScriptContext,
  message: string,
  extra: Partial<StartupDiagnosticDetails> = {},
): StartupDiagnosticError {
  return new StartupDiagnosticError({
    stage: context.stage,
    message,
    hostFunction: context.hostFunction,
    file: context.file,
    evalScript: context.evalScript || scriptPreview(extra.evalScript || ''),
    ...extra,
  });
}

function scriptPreview(script: string): string {
  return script.length > 3000 ? `${script.slice(0, 3000)}\n...` : script;
}

function evalScript<T>(script: string, context: EvalScriptContext): Promise<T> {
  const cs = getCSInterface();

  if (!cs || !isCepAvailable()) {
    return Promise.reject(createStartupError(context, 'CEP is not available.', { evalScript: scriptPreview(script) }));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(createStartupError(context, 'CSInterface.evalScript timed out.', { evalScript: scriptPreview(script) }));
    }, 30000);

    try {
      cs.evalScript(script, (raw) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeout);

        const response = parseHostResponse<T>(raw);

        if (!response.ok || response.data === null) {
          reject(createStartupError(context, response.error || 'EtLayers host call failed.', {
            evalScript: scriptPreview(script),
            rawResult: raw,
          }));
          return;
        }

        resolve(response.data);
      });
    } catch (error) {
      settled = true;
      window.clearTimeout(timeout);
      reject(createStartupError(context, error instanceof Error ? error.message : 'CSInterface.evalScript threw.', {
        evalScript: scriptPreview(script),
        stack: error instanceof Error ? error.stack : undefined,
      }));
    }
  });
}

function evalScriptRaw(script: string, context: EvalScriptContext): Promise<string> {
  const cs = getCSInterface();

  if (!cs || !isCepAvailable()) {
    return Promise.reject(createStartupError(context, 'CEP is not available.', { evalScript: scriptPreview(script) }));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(createStartupError(context, 'CSInterface.evalScript timed out.', { evalScript: scriptPreview(script) }));
    }, 30000);

    try {
      cs.evalScript(script, (raw) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeout);
        resolve(raw);
      });
    } catch (error) {
      settled = true;
      window.clearTimeout(timeout);
      reject(createStartupError(context, error instanceof Error ? error.message : 'CSInterface.evalScript threw.', {
        evalScript: scriptPreview(script),
        stack: error instanceof Error ? error.stack : undefined,
      }));
    }
  });
}

function hostMethodArrayLiteral(): string {
  return `[${REQUIRED_HOST_METHODS.map((methodName) => `"${escapeForExtendScript(methodName)}"`).join(',')}]`;
}

function parseRawJson<T>(raw: string, context: EvalScriptContext): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw createStartupError(context, 'Unable to parse evalScript diagnostic response.', {
      evalScript: context.evalScript,
      rawResult: raw,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function getHostBridgeStatus(): Promise<HostBridgeStatus> {
  const script = `
(function () {
  var methodNames = ${hostMethodArrayLiteral()};
  var methods = {};
  var missing = [];
  var isDefined = typeof EtLayersHost !== "undefined";
  var i;

  for (i = 0; i < methodNames.length; i += 1) {
    methods[methodNames[i]] = isDefined && typeof EtLayersHost[methodNames[i]] === "function";

    if (!methods[methodNames[i]]) {
      missing.push(methodNames[i]);
    }
  }

  return JSON.stringify({
    defined: isDefined,
    missing: missing,
    methods: methods
  });
})()
`;

  const context = {
    stage: 'Bridge verified.',
    evalScript: scriptPreview(script),
  };
  const result = await evalScriptRaw(script, context);

  return parseRawJson<HostBridgeStatus>(result, context);
}

async function loadHostScript(): Promise<void> {
  recordStartupStage('Loading CSInterface...');
  const cs = getCSInterface();

  if (!cs || !isCepAvailable()) {
    recordStartupStage('Loading CSInterface...', { message: 'CEP unavailable; browser mock mode active.' });
    return;
  }

  const initialStatus = await getHostBridgeStatus();

  if (initialStatus.defined && initialStatus.missing.length === 0) {
    recordStartupStage('Host loaded.');
    recordStartupStage('Bridge verified.', { methods: initialStatus.methods });
    return;
  }

  const extensionPath = cs.getSystemPath('extension');

  if (!extensionPath) {
    throw new StartupDiagnosticError({
      stage: 'Loading JSX host...',
      message: 'CSInterface.getSystemPath("extension") returned an empty path.',
      file: HOST_SCRIPT,
    });
  }

  const hostScriptPath = `${extensionPath}/${HOST_SCRIPT}`;
  const escapedPath = escapeForExtendScript(hostScriptPath);
  const loadScript = `
(function () {
  function stringify(value) {
    try {
      return JSON.stringify(value);
    } catch (jsonError) {
      return '{"ok":false,"message":"Unable to serialize host load diagnostic."}';
    }
  }

  try {
    var file = new File("${escapedPath}");

    if (!file.exists) {
      return stringify({
        ok: false,
        message: "Host JSX file was not found.",
        file: file.fsName
      });
    }

    $.evalFile(file);

    if (typeof EtLayersHost === "undefined") {
      return stringify({
        ok: false,
        message: "EtLayersHost was not defined after $.evalFile().",
        file: file.fsName
      });
    }

    return stringify({
      ok: true,
      message: "Host JSX loaded.",
      file: file.fsName
    });
  } catch (e) {
    return stringify({
      ok: false,
      message: e && e.toString ? e.toString() : String(e),
      stack: e && e.stack ? String(e.stack) : "",
      file: "${escapedPath}"
    });
  }
})()
`;
  const loadContext = {
    stage: 'Loading JSX host...',
    file: hostScriptPath,
    evalScript: scriptPreview(loadScript),
  };

  recordStartupStage('Loading JSX host...', { file: hostScriptPath });

  const loadResult = parseRawJson<{ ok: boolean; message: string; stack?: string; file?: string }>(
    await evalScriptRaw(loadScript, loadContext),
    loadContext,
  );

  if (!loadResult.ok) {
    throw new StartupDiagnosticError({
      stage: 'Loading JSX host...',
      message: loadResult.message || 'Failed to load host script.',
      stack: loadResult.stack,
      file: loadResult.file || hostScriptPath,
      evalScript: scriptPreview(loadScript),
    });
  }

  recordStartupStage('Host loaded.', { file: loadResult.file || hostScriptPath });

  const bridgeStatus = await getHostBridgeStatus();

  if (!bridgeStatus.defined || bridgeStatus.missing.length > 0) {
    throw new StartupDiagnosticError({
      stage: 'Bridge verified.',
      message: `EtLayersHost is missing required method(s): ${bridgeStatus.missing.join(', ') || 'EtLayersHost'}.`,
      file: hostScriptPath,
      evalScript: 'EtLayersHost method verification',
    });
  }

  recordStartupStage('Bridge verified.', { methods: bridgeStatus.methods });
}

function ensureHostInitialized(): Promise<void> {
  if (!isCepAvailable()) {
    return Promise.resolve();
  }

  if (!hostInitializationPromise) {
    hostInitializationPromise = loadHostScript().catch((error) => {
      hostInitializationPromise = null;
      throw error;
    });
  }

  return hostInitializationPromise;
}

function hostErrorResponseScript(): string {
  return `
  function __etlError(message) {
    try {
      return JSON.stringify({
        ok: false,
        data: null,
        error: String(message)
      });
    } catch (jsonError) {
      return '{"ok":false,"data":null,"error":"EtLayers host call failed before JSON serialization."}';
    }
  }
`;
}

function serializeHostArgument(arg: string | number): string {
  return typeof arg === 'number' ? String(arg) : `"${escapeForExtendScript(arg)}"`;
}

async function hostCall<T>(functionName: string, args: Array<string | number> = []): Promise<T> {
  await ensureHostInitialized();

  const serializedArgs = args
    .map(serializeHostArgument)
    .join(',');
  const escapedFunctionName = escapeForExtendScript(functionName);
  const script = `
(function () {
${hostErrorResponseScript()}

  try {
    if (typeof EtLayersHost === "undefined") {
      return __etlError("EtLayersHost is not defined.");
    }

    if (typeof EtLayersHost["${escapedFunctionName}"] !== "function") {
      return __etlError("EtLayersHost.${escapedFunctionName} is not a function.");
    }

    var result = EtLayersHost["${escapedFunctionName}"](${serializedArgs});

    if (typeof result === "undefined" || result === null) {
      return __etlError("EtLayersHost.${escapedFunctionName} returned an empty response.");
    }

    return String(result);
  } catch (e) {
    return __etlError("EtLayersHost.${escapedFunctionName} threw: " + (e && e.toString ? e.toString() : String(e)) + (e && e.stack ? "\\n" + e.stack : ""));
  }
})()
`;

  return evalScript<T>(script, {
    stage: `Calling host function ${functionName}.`,
    hostFunction: functionName,
    evalScript: scriptPreview(script),
  });
}

function filterMock(query: string, includePrecomps: boolean): EtLayersSnapshot {
  const normalized = query.trim().toLowerCase();
  const sourceLayers = includePrecomps
    ? mockSnapshot.layers
    : mockSnapshot.layers.filter((layer) => layer.compId === mockSnapshot.comp?.id);

  if (!normalized) {
    return {
      ...mockSnapshot,
      layers: sourceLayers,
    };
  }

  return {
    ...mockSnapshot,
    layers: sourceLayers.filter((layer) =>
      [
        layer.normalizedName,
        layer.type,
        layer.labelName,
        layer.locked ? 'locked' : '',
        layer.shy ? 'hidden shy' : '',
        layer.solo ? 'solo' : '',
        layer.selected ? 'selected' : '',
        layer.parented ? 'parented' : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    ),
  };
}

async function checkForUpdate(endpoint: string, currentVersion: string): Promise<UpdateInfo> {
  if (!endpoint) {
    return {
      checkedAt: new Date().toISOString(),
      hasUpdate: false,
      latestVersion: currentVersion,
      currentVersion,
      changelog: 'No update endpoint configured.',
      downloadUrl: '',
    };
  }

  const response = await fetch(endpoint);
  const release = await response.json();
  const latestVersion = String(release.tag_name || release.version || currentVersion).replace(/^v/i, '');
  const downloadUrl = String(release.html_url || release.download_url || release.url || '');

  return {
    checkedAt: new Date().toISOString(),
    hasUpdate: latestVersion !== currentVersion,
    latestVersion,
    currentVersion,
    changelog: String(release.body || release.changelog || ''),
    downloadUrl,
  };
}

export const etLayersBridge = {
  async initialize(): Promise<void> {
    await loadHostScript();
  },

  async refresh(includePrecomps = false): Promise<EtLayersSnapshot> {
    if (!isCepAvailable()) {
      return filterMock('', includePrecomps);
    }

    return hostCall<EtLayersSnapshot>('refresh', [includePrecomps ? 1 : 0]);
  },

  async searchLayers(query: string, includePrecomps = false): Promise<EtLayersSnapshot> {
    if (!isCepAvailable()) {
      return filterMock(query, includePrecomps);
    }

    return hostCall<EtLayersSnapshot>('searchLayers', [query, includePrecomps ? 1 : 0]);
  },

  async getProjectState(): Promise<ProjectState> {
    if (!isCepAvailable()) {
      return {
        fingerprint: `${mockSnapshot.projectFingerprint}:${Date.now() > 0 ? 'stable' : 'stable'}`,
        comp: mockSnapshot.comp,
        selectedLayerIds: [],
      };
    }

    return hostCall<ProjectState>('getProjectState');
  },

  async getProjectAudit(): Promise<ProjectAudit> {
    if (!isCepAvailable()) {
      return mockProjectAudit;
    }

    return hostCall<ProjectAudit>('getProjectAudit');
  },

  async revealProjectItem(itemId: string): Promise<ProjectAudit> {
    if (!isCepAvailable()) {
      return mockProjectAudit;
    }

    return hostCall<ProjectAudit>('revealProjectItem', [itemId]);
  },

  async openProjectItem(itemId: string): Promise<ProjectAudit> {
    if (!isCepAvailable()) {
      return mockProjectAudit;
    }

    return hostCall<ProjectAudit>('openProjectItem', [itemId]);
  },

  async getStatistics() {
    if (!isCepAvailable()) {
      return mockSnapshot.comp ? mockSnapshot.stats : emptyStats;
    }

    return hostCall('getStatistics');
  },

  async autoLabels(): Promise<AutoLabelsResult> {
    if (!isCepAvailable()) {
      return {
        applied: mockSnapshot.stats.text + mockSnapshot.stats.shapes + mockSnapshot.stats.cameras,
        skipped: 12,
        total: mockSnapshot.stats.layers,
      };
    }

    return hostCall<AutoLabelsResult>('autoLabels');
  },

  async toggleLayerSelection(layer: LayerRecord): Promise<LayerRecord> {
    if (!isCepAvailable()) {
      return {
        ...layer,
        selected: !layer.selected,
      };
    }

    return hostCall<LayerRecord>('toggleLayerSelection', [layer.compId, layer.index]);
  },

  async layerAction(layer: LayerRecord, action: string, value = ''): Promise<LayerActionResult> {
    if (!isCepAvailable()) {
      return {
        layer: {
          ...layer,
          locked: action === 'lock' ? !layer.locked : layer.locked,
          solo: action === 'solo' ? !layer.solo : layer.solo,
          shy: action === 'shy' ? !layer.shy : layer.shy,
          name: action === 'rename' && value ? value : layer.name,
        },
        message: 'Preview action applied.',
      };
    }

    return hostCall<LayerActionResult>('layerAction', [action, layer.compId, layer.index, value]);
  },

  async selectionAction(action: string): Promise<{ applied: number; action: string }> {
    if (!isCepAvailable()) {
      return { applied: 1, action };
    }

    return hostCall<{ applied: number; action: string }>('selectionAction', [action]);
  },

  async batchRename(options: BatchRenameOptions): Promise<BatchRenameResult> {
    if (!isCepAvailable()) {
      return {
        renamed: options.layerIds.length,
        total: options.layerIds.length,
      };
    }

    return hostCall<BatchRenameResult>('batchRename', [JSON.stringify(options)]);
  },

  checkForUpdate,

  isCepAvailable,
};
