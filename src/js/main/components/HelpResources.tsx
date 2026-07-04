interface HelpResourcesProps {
  onOpenUrl(url: string): void;
  onOpenAbout(): void;
}

const resources = [
  {
    label: 'Documentation',
    description: 'Read setup and product guides',
    url: 'https://docs.etvrnity.com',
    icon: (
      <path d="M6 4.8h7.2L18 9.6v9.6H6V4.8Zm7 0v5h5M8.4 13h7.2M8.4 16h7.2" />
    ),
  },
  {
    label: 'Discord',
    description: 'Join the Etvrnity community',
    url: 'https://discord.gg/YHANjsVGyj',
    icon: (
      <path d="M7.2 8.4c2.9-1.2 6.7-1.2 9.6 0l1.2 7.8c-1.4 1-2.8 1.6-4.3 1.8l-.7-1.2c-1 .2-2 .2-3 0L9.3 18c-1.5-.2-2.9-.8-4.3-1.8l1.2-7.8Zm3 5.1h.1m3.4 0h.1" />
    ),
  },
  {
    label: 'Report Bug',
    description: 'Open an issue on GitHub',
    url: 'https://github.com/dilfyscps/EtLayers/issues',
    icon: (
      <path d="M8 8.5 6.2 6.7M16 8.5l1.8-1.8M12 7v12M7.5 12h9M7.8 16h8.4M8 8.5h8v7.2a4 4 0 0 1-8 0V8.5Z" />
    ),
  },
  {
    label: 'License',
    description: 'View license terms',
    url: 'https://github.com/dilfyscps/EtLayers/blob/main/LICENSE',
    icon: (
      <path d="M12 4.8 18 7v4.8c0 3.5-2.4 6.1-6 7.4-3.6-1.3-6-3.9-6-7.4V7l6-2.2Zm-2 7.2 1.4 1.4 3-3" />
    ),
  },
];

export function HelpResources({ onOpenUrl, onOpenAbout }: HelpResourcesProps) {
  return (
    <div className="etl-resource-list">
      {resources.map((resource) => (
        <button
          key={resource.label}
          type="button"
          onClick={() => onOpenUrl(resource.url)}
          className="etl-resource-row"
        >
          <span className="etl-resource-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {resource.icon}
            </svg>
          </span>
          <span className="etl-row-main">
            <span className="etl-row-name">{resource.label}</span>
            <span className="etl-row-meta">{resource.description}</span>
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={onOpenAbout}
        className="etl-resource-row"
      >
        <span className="etl-resource-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 17v-5M12 8h.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </span>
        <span className="etl-row-main">
          <span className="etl-row-name">About</span>
          <span className="etl-row-meta">Version and credits</span>
        </span>
      </button>
    </div>
  );
}
