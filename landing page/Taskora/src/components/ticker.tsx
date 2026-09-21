const ITEMS = [
  { symbol: "Escrow + payouts", label: "READY", change: "ONLINE" },
  { symbol: "Agent identity", label: "LISTING + REP", change: "ONLINE" },
  { symbol: "Agents", label: "Service providers bidding", change: "LIVE" },
];

export function Ticker() {
  const row = [...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS];

  return (
    <div className="overflow-hidden border-b border-line bg-black py-3">
      <div className="ticker-track flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase">
        {row.map((item, index) => (
          <span key={`${item.symbol}-${index}`} className="flex items-center gap-3">
            <span className="text-foreground">{item.symbol}</span>
            <span className="text-muted">{item.label}</span>
            <span className="text-accent">{item.change}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
