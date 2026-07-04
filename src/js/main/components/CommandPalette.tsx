export interface CommandItem {
  id: string;
  label: string;
  hint: string;
  shortcut?: string;
  run(): void;
}

interface CommandPaletteProps {
  open: boolean;
  query: string;
  activeIndex: number;
  commands: CommandItem[];
  onQueryChange(value: string): void;
  onActiveIndexChange(value: number): void;
  onClose(): void;
}

export function CommandPalette({
  open,
  query,
  activeIndex,
  commands,
  onQueryChange,
  onActiveIndexChange,
  onClose,
}: CommandPaletteProps) {
  if (!open) {
    return null;
  }

  const filteredCommands = commands.filter((command) =>
    `${command.label} ${command.hint}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const safeActiveIndex = Math.min(activeIndex, Math.max(filteredCommands.length - 1, 0));

  return (
    <div className="etl-command-backdrop">
      <div className="etl-command">
        <div className="etl-command-header">
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onActiveIndexChange(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                onActiveIndexChange(Math.min(safeActiveIndex + 1, filteredCommands.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onActiveIndexChange(Math.max(safeActiveIndex - 1, 0));
              } else if (event.key === 'Enter' && filteredCommands[safeActiveIndex]) {
                filteredCommands[safeActiveIndex].run();
                onClose();
              }
            }}
            placeholder="Run a command..."
            className="etl-input"
          />
        </div>

        <div className="etl-command-list">
          {filteredCommands.map((command, index) => (
            <button
              key={command.id}
              type="button"
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => {
                command.run();
                onClose();
              }}
              className={`etl-command-row ${index === safeActiveIndex ? 'etl-command-row--active' : ''}`}
            >
              <span className="etl-row-main">
                <span className="etl-row-name">{command.label}</span>
                <span className="etl-row-meta">{command.hint}</span>
              </span>
              {command.shortcut ? <span className="etl-row-badge">{command.shortcut}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
