import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LayerRecord } from '../types/layers';
import { formatLayerType } from '../lib/format';

interface LayerListProps {
  layers: LayerRecord[];
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  selectedLayerId?: string;
  selectedLayerIds?: string[];
  activeLayerId?: string;
  expandedGroups: Record<string, boolean>;
  onSelect(layer: LayerRecord): void;
  onContextMenu(layer: LayerRecord, x: number, y: number): void;
  onToggleGroup(groupId: string): void;
}

type FlatRow =
  | { kind: 'group'; key: string; group: { id: string; name: string; breadcrumb: string; layers: LayerRecord[] } }
  | { kind: 'layer'; key: string; layer: LayerRecord };

export function LayerList({
  layers,
  disabled,
  compact = false,
  className = '',
  selectedLayerId,
  selectedLayerIds = [],
  activeLayerId,
  expandedGroups,
  onSelect,
  onContextMenu,
  onToggleGroup,
}: LayerListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const groupHeight = 28;
  const layerHeight = compact ? 29 : 34;
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup: Record<string, { id: string; name: string; breadcrumb: string; layers: LayerRecord[] }> = {};

    layers.forEach((layer) => {
      if (!byGroup[layer.groupId]) {
        order.push(layer.groupId);
        byGroup[layer.groupId] = {
          id: layer.groupId,
          name: layer.groupName || layer.compName,
          breadcrumb: layer.breadcrumb,
          layers: [],
        };
      }

      byGroup[layer.groupId].layers.push(layer);
    });

    return order.map((groupId) => byGroup[groupId]);
  }, [layers]);

  const rows = useMemo(() => {
    const nextRows: FlatRow[] = [];

    groups.forEach((group) => {
      nextRows.push({ kind: 'group', key: group.id, group });

      if (expandedGroups[group.id] !== false) {
        group.layers.forEach((layer) => {
          nextRows.push({ kind: 'layer', key: layer.id, layer });
        });
      }
    });

    return nextRows;
  }, [expandedGroups, groups]);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTopRef.current;
      setViewportHeight(scrollRef.current.clientHeight || 320);
    }
  }, [layers, rows.length]);

  if (layers.length === 0) {
    return (
      <div className={`etl-empty ${className}`}>
        <p>No layers found.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        scrollTopRef.current = event.currentTarget.scrollTop;
        setScrollTop(event.currentTarget.scrollTop);
        setViewportHeight(event.currentTarget.clientHeight || viewportHeight);
      }}
      className={`etl-list ${className}`}
    >
      <div className="etl-list-canvas" style={{ height: rows.reduce((total, row) => total + (row.kind === 'group' ? groupHeight : layerHeight), 0) }}>
        {(() => {
          let runningTop = 0;
          const visibleRows: Array<{ row: FlatRow; top: number; height: number }> = [];
          const overscan = 180;

          rows.forEach((row) => {
            const height = row.kind === 'group' ? groupHeight : layerHeight;
            const rowBottom = runningTop + height;

            if (rowBottom >= scrollTop - overscan && runningTop <= scrollTop + viewportHeight + overscan) {
              visibleRows.push({ row, top: runningTop, height });
            }

            runningTop = rowBottom;
          });

          return visibleRows.map(({ row, top, height }) => {
            if (row.kind === 'group') {
              const group = row.group;

              return (
                <section key={row.key} className="etl-group-row" style={{ top, height: height - 2 }}>
                  <button
                    type="button"
                    onClick={() => onToggleGroup(group.id)}
                    className="etl-group-button"
                  >
                    <span className="etl-disclosure">{expandedGroups[group.id] === false ? '+' : '-'}</span>
                    <span className="etl-group-main">
                      <span className="etl-group-name">{group.name}</span>
                      <span className="etl-group-meta">{group.breadcrumb}</span>
                    </span>
                    <span className="etl-count">
                      {group.layers.length}
                    </span>
                  </button>
                </section>
              );
            }

            const layer = row.layer;
            const isSelected = selectedLayerIds.indexOf(layer.id) !== -1 || selectedLayerId === layer.id || layer.selected;
            const isActive = activeLayerId === layer.id;
            return (
              <button
                key={row.key}
                disabled={disabled}
                onClick={() => onSelect(layer)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onContextMenu(layer, event.clientX, event.clientY);
                }}
                className={`etl-layer-row ${
                  isSelected
                    ? 'etl-layer-row--selected'
                    : isActive
                      ? 'etl-layer-row--active'
                      : ''
                }`}
                style={{ top, height: height - 2 }}
              >
                <span className={`etl-layer-strip etl-layer-strip--${layer.type}`} />
                <span className="etl-row-main">
                  <span className="etl-row-name">{layer.name}</span>
                  <span className="etl-row-meta">
                    Layer {layer.index} - {formatLayerType(layer.type)}
                  </span>
                </span>
                <span className="etl-row-badge">
                  {isSelected ? 'On' : 'Open'}
                </span>
              </button>
            );
          });
        })()}
      </div>
    </div>
  );
}
