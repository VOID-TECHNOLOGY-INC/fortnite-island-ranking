import type { ReactNode } from 'react';

type ActionProps = {
  actionLabel?: string;
  onAction?: () => void;
};

type StatePanelProps = ActionProps & {
  eyebrow?: string;
  title: string;
  detail?: string;
  children?: ReactNode;
};

function StatePanel({ eyebrow, title, detail, actionLabel, onAction, children }: StatePanelProps) {
  return (
    <section className="state-panel">
      {eyebrow ? <p className="state-panel__eyebrow">{eyebrow}</p> : null}
      <h3 className="state-panel__title">{title}</h3>
      {detail ? <p className="state-panel__detail">{detail}</p> : null}
      {children}
      {actionLabel && onAction ? (
        <button type="button" className="btn btn--ghost" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function LoadingState({ title, detail }: Omit<StatePanelProps, 'actionLabel' | 'onAction'>) {
  return (
    <StatePanel eyebrow="Loading" title={title} detail={detail}>
      <div className="state-panel__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </StatePanel>
  );
}

export function ErrorState({ title, detail, actionLabel, onAction }: StatePanelProps) {
  return <StatePanel eyebrow="Issue" title={title} detail={detail} actionLabel={actionLabel} onAction={onAction} />;
}

export function EmptyState({ title, detail, actionLabel, onAction }: StatePanelProps) {
  return <StatePanel eyebrow="Empty" title={title} detail={detail} actionLabel={actionLabel} onAction={onAction} />;
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
      {message ? (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
    </>
  );
}
