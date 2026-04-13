export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium">Pro plan — unlimited uploads</div>
        <div className="mt-2 h-2 w-full rounded-full bg-gradient-hero" />
      </div>
    );
  }
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Daily uploads</span>
        <span className="text-muted-foreground">{used} / {limit}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-gradient-hero transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
