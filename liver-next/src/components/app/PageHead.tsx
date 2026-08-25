export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-title font-light text-ink">{title}</h1>
      {sub && <p className="mt-2 text-[15.5px] text-ink-soft">{sub}</p>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="card text-center text-[15px] text-ink-mute">{text}</div>
  );
}
