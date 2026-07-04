import { forwardRef } from 'react';

interface SearchInputProps {
  value: string;
  disabled?: boolean;
  includePrecomps: boolean;
  history?: string[];
  onChange(value: string): void;
  onIncludePrecompsChange(value: boolean): void;
  onHistorySelect?(value: string): void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, disabled, includePrecomps, history = [], onChange, onIncludePrecompsChange, onHistorySelect },
  ref,
) {
  return (
    <div className="etl-search">
      <div className="etl-search-row">
        <div className="etl-input-wrap">
          <div className="etl-search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10.7 18.2a7.5 7.5 0 1 1 5.3-2.2l4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <input
            ref={ref}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Name, type, label, locked, selected..."
            className="etl-input etl-input--search"
          />
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onIncludePrecompsChange(!includePrecomps)}
          className={`etl-toggle ${includePrecomps ? 'etl-toggle--active' : ''}`}
          title="Include nested precompositions in search"
        >
          Pre
        </button>
      </div>

      {history.length > 0 ? (
        <div className="etl-history">
          {history.slice(0, 4).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onHistorySelect?.(item)}
              className="etl-chip"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
