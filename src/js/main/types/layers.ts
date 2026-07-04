export type LayerType =
  | 'text'
  | 'shape'
  | 'nullLayer'
  | 'solid'
  | 'adjustment'
  | 'camera'
  | 'light'
  | 'other'
  | 'unknown';

export interface LayerRecord {
  id: string;
  index: number;
  name: string;
  normalizedName: string;
  type: LayerType;
  compId: string;
  compName: string;
  compPath: string[];
  breadcrumb: string;
  groupId: string;
  groupName: string;
  locked: boolean;
  shy: boolean;
  enabled: boolean;
  selected: boolean;
  solo: boolean;
  parented: boolean;
  parentName: string;
  label: number;
  labelName: string;
  inPoint: number;
  outPoint: number;
}

export interface CompositionInfo {
  id: string;
  name: string;
  layerCount: number;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
}

export interface CompositionStats {
  layers: number;
  text: number;
  shapes: number;
  nulls: number;
  solids: number;
  adjustments: number;
  cameras: number;
  lights: number;
  locked: number;
  hidden: number;
  disabled: number;
  brokenExpressions: number;
}

export interface EtLayersSnapshot {
  comp: CompositionInfo | null;
  stats: CompositionStats;
  layers: LayerRecord[];
  projectFingerprint: string;
  refreshedAt: string;
}

export interface ProjectState {
  fingerprint: string;
  comp: CompositionInfo | null;
  selectedLayerIds: string[];
}

export type ProjectIssueType =
  | 'missingFootage'
  | 'missingFonts'
  | 'offlineProxies'
  | 'placeholderFootage'
  | 'testAssets'
  | 'duplicateFootage'
  | 'unusedFootage'
  | 'emptyComps'
  | 'brokenExpressions';

export interface ProjectIssue {
  id: string;
  type: ProjectIssueType;
  status: string;
  severity: 'error' | 'warning' | 'info';
  icon: string;
  name: string;
  detail: string;
  itemId: string;
  itemKind: 'footage' | 'comp' | 'layer' | 'project';
}

export interface ProjectIssueGroup {
  type: ProjectIssueType;
  label: string;
  count: number;
  issues: ProjectIssue[];
}

export interface ProjectAudit {
  fingerprint: string;
  groups: ProjectIssueGroup[];
}

export interface AutoLabelsResult {
  applied: number;
  skipped: number;
  total: number;
}

export interface LayerActionResult {
  layer: LayerRecord | null;
  message: string;
}

export type BatchCaseMode = 'none' | 'uppercase' | 'lowercase' | 'title';

export interface BatchRenameOptions {
  search: string;
  replace: string;
  prefix: string;
  suffix: string;
  startNumber: number;
  useRegex: boolean;
  caseMode: BatchCaseMode;
  applyTo: 'selected' | 'results';
  layerIds: string[];
}

export interface BatchRenameResult {
  renamed: number;
  total: number;
}

export interface UpdateInfo {
  checkedAt: string;
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  changelog: string;
  downloadUrl: string;
}

export interface HostResponse<T> {
  ok: boolean;
  data: T | null;
  error: string;
}
