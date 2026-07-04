export interface StartupDiagnosticDetails {
  stage: string;
  message: string;
  stack?: string;
  hostFunction?: string;
  file?: string;
  evalScript?: string;
  rawResult?: string;
  [key: string]: unknown;
}

export class StartupDiagnosticError extends Error {
  details: StartupDiagnosticDetails;

  constructor(details: StartupDiagnosticDetails) {
    super(details.message);
    this.name = 'StartupDiagnosticError';
    this.details = details;
  }
}

export function recordStartupStage(stage: string, details?: Partial<StartupDiagnosticDetails>) {
  window.EtLayersStartup?.log(stage, details);
}

export function markStartupReady() {
  window.EtLayersStartup?.ready();
}

export function reportStartupFatal(details: StartupDiagnosticDetails) {
  window.EtLayersStartup?.fatal(details);
}

export function toStartupDiagnosticDetails(error: unknown, fallbackStage: string): StartupDiagnosticDetails {
  if (error instanceof StartupDiagnosticError) {
    return error.details;
  }

  if (error instanceof Error) {
    return {
      stage: fallbackStage,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    stage: fallbackStage,
    message: typeof error === 'string' ? error : 'Unknown startup error.',
  };
}
