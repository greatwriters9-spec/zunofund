export function MarketRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-zinc-800/60 px-4 py-3.5">
      <div className="h-9 w-9 rounded-full bg-zinc-800/80" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-24 rounded bg-zinc-800/80" />
        <div className="h-3 w-16 rounded bg-zinc-800/60" />
      </div>
      <div className="space-y-2 text-right">
        <div className="ml-auto h-3.5 w-20 rounded bg-zinc-800/80" />
        <div className="ml-auto h-3 w-14 rounded bg-zinc-800/60" />
      </div>
    </div>
  );
}
