type SummaryCardItem = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'positive' | 'accent';
};

type Props = {
  items: SummaryCardItem[];
};

export function SummaryCards({ items }: Props) {
  return (
    <section className="summary-grid" aria-label="Dashboard summary">
      {items.map((item) => (
        <article key={item.label} className={`summary-card summary-card--${item.tone ?? 'default'}`}>
          <p className="summary-card__label">{item.label}</p>
          <p className="summary-card__value">{item.value}</p>
          {item.helper ? <p className="summary-card__helper">{item.helper}</p> : null}
        </article>
      ))}
    </section>
  );
}
