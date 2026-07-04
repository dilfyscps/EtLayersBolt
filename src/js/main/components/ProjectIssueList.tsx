import { useMemo, useState } from 'react';
import type { ProjectAudit, ProjectIssue, ProjectIssueGroup } from '../types/layers';

interface ProjectIssueListProps {
  audit: ProjectAudit | null;
  onReveal(issue: ProjectIssue): void;
  onOpen(issue: ProjectIssue): void;
}

type FlatRow =
  | { kind: 'group'; group: ProjectIssueGroup; key: string }
  | { kind: 'issue'; issue: ProjectIssue; key: string };

const rowHeight = 32;

export function ProjectIssueList({ audit, onReveal, onOpen }: ProjectIssueListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => {
    const nextRows: FlatRow[] = [];

    audit?.groups.forEach((group) => {
      nextRows.push({ kind: 'group', group, key: group.type });

      if (expandedGroups[group.type] !== false) {
        group.issues.forEach((issue) => {
          nextRows.push({ kind: 'issue', issue, key: issue.id });
        });
      }
    });

    return nextRows;
  }, [audit, expandedGroups]);

  if (!audit) {
    return (
      <div className="etl-empty">
        Run a project scan to inspect media and composition issues.
      </div>
    );
  }

  const totalIssues = audit.groups.reduce((total, group) => total + group.count, 0);

  if (totalIssues === 0) {
    return (
      <div className="etl-empty">
        No project issues found.
      </div>
    );
  }

  const viewportHeight = 360;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const endIndex = Math.min(rows.length, startIndex + Math.ceil(viewportHeight / rowHeight) + 10);
  const visibleRows = rows.slice(startIndex, endIndex);
  const totalHeight = rows.length * rowHeight;

  return (
    <div
      className="etl-list"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="etl-list-canvas" style={{ height: totalHeight }}>
        {visibleRows.map((row, offset) => {
          const index = startIndex + offset;

          if (row.kind === 'group') {
            const group = row.group;
            return (
              <button
                key={row.key}
                type="button"
                onClick={() =>
                  setExpandedGroups((current) => ({
                    ...current,
                    [group.type]: current[group.type] === false,
                  }))
                }
                className="etl-group-button etl-group-row"
                style={{ top: index * rowHeight, height: rowHeight - 2 }}
              >
                <span className="etl-disclosure">{expandedGroups[group.type] === false ? '+' : '-'}</span>
                <span className="etl-group-main">
                  <span className="etl-group-name">{group.label}</span>
                </span>
                <span className="etl-count">{group.count}</span>
              </button>
            );
          }

          const issue = row.issue;

          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onReveal(issue)}
              onDoubleClick={() => onOpen(issue)}
              className="etl-layer-row"
              style={{ top: index * rowHeight, height: rowHeight - 2 }}
            >
              <span className={`etl-issue-badge ${issue.severity === 'error' ? 'etl-issue-badge--error' : issue.severity === 'warning' ? 'etl-issue-badge--warning' : ''}`}>
                {issue.icon}
              </span>
              <span className="etl-row-main">
                <span className="etl-row-name">{issue.name}</span>
                <span className="etl-row-meta">{issue.status} - {issue.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
