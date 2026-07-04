declare global {
  interface EtLayersStartupApi {
    log(stage: string, details?: unknown): void;
    fatal(details: unknown): void;
    ready(): void;
    getEntries(): string[];
  }

  interface Window {
    EtLayersStartup?: EtLayersStartupApi;
    __ETLAYERS_REACT_STARTED__?: boolean;
  }
}

export {};
