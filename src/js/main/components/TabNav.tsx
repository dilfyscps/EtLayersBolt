export type EtLayersTab = 'search' | 'stats' | 'project' | 'tools' | 'settings' | 'help';

export interface TabItem {
  id: EtLayersTab;
  label: string;
  description: string;
}

interface TabNavProps {
  tabs: TabItem[];
  activeTab: EtLayersTab;
  onChange(tab: EtLayersTab): void;
}

function TabIcon({ tab }: { tab: EtLayersTab }) {
  const paths: Record<EtLayersTab, string> = {
    search: 'M10.7 17.2a6.5 6.5 0 1 1 4.6-1.9l3.5 3.5M7.5 10.7h6.4',
    stats: 'M5 18V9m5 9V5m5 13v-6m5 6V8',
    project: 'M4.5 6.5h5l1.4 2h8.6v9h-15v-11Z',
    tools: 'M13.6 5.4 18.6 10.4l-8.2 8.2-5-5 8.2-8.2ZM12 7l5 5',
    settings: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM12 3.8v2M12 18.2v2M4.9 6.9l1.4 1.4M17.7 17.7l1.4 1.4M3.8 12h2M18.2 12h2M4.9 17.1l1.4-1.4M17.7 6.3l1.4-1.4',
    help: 'M9.4 9a2.8 2.8 0 1 1 4.4 2.3c-1 .7-1.8 1.2-1.8 2.7M12 17.5h.1M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  };

  return (
    <svg className="etl-tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[tab]} />
    </svg>
  );
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <nav className="etl-tabs">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`etl-tab ${isActive ? 'etl-tab--active' : ''}`}
            title={tab.description}
          >
            <TabIcon tab={tab.id} />
            <span className="etl-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
