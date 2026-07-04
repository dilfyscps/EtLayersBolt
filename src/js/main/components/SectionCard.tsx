import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({ title, eyebrow, action, children, className = '', contentClassName = '' }: SectionCardProps) {
  return (
    <section className={`etl-section ${className}`}>
      <div className="etl-section-header">
        <div className="etl-section-title-wrap">
          {eyebrow ? <p className="etl-section-meta">{eyebrow}</p> : null}
          <h2 className="etl-section-title">{title}</h2>
        </div>
        {action ? <div className="etl-section-action">{action}</div> : null}
      </div>
      <div className={`etl-section-body ${contentClassName}`}>{children}</div>
    </section>
  );
}
