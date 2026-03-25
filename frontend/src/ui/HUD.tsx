import { useSimulationStore } from '../store/simulation';

const SEASON_ICONS: Record<string, string> = {
  spring: '\u{1F338}',
  summer: '\u{2600}\u{FE0F}',
  autumn: '\u{1F341}',
  winter: '\u{2744}\u{FE0F}',
};

const SPEED_OPTIONS = [
  { label: '\u23F8', value: 0, title: 'Pause' },
  { label: '1x', value: 1, title: 'Normal' },
  { label: '2x', value: 2, title: 'Fast' },
  { label: '5x', value: 5, title: 'Faster' },
  { label: '10x', value: 10, title: 'Max' },
];

export function HUD() {
  const tick = useSimulationStore((s) => s.tick);
  const season = useSimulationStore((s) => s.season);
  const metrics = useSimulationStore((s) => s.metrics);
  const connected = useSimulationStore((s) => s.connected);
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const toggleMetrics = useSimulationStore((s) => s.toggleMetrics);
  const showMetrics = useSimulationStore((s) => s.showMetrics);

  const seasonIcon = SEASON_ICONS[season] ?? '';

  return (
    <>
      {/* Top stat bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="glass-card flex items-center gap-6 px-6 py-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_#4ade80]' : 'bg-red-400 shadow-[0_0_6px_#f87171]'}`}
            />
            <span className="text-xs text-white/40">
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <Divider />

          {/* Tick */}
          <StatBlock label="TICK" value={tick.toLocaleString()} />

          <Divider />

          {/* Season */}
          <StatBlock
            label="SEASON"
            value={`${seasonIcon} ${season.charAt(0).toUpperCase() + season.slice(1)}`}
          />

          <Divider />

          {/* Population */}
          <StatBlock
            label="POPULATION"
            value={metrics.population.toLocaleString()}
            color="text-emerald-400"
          />

          <Divider />

          {/* GDP */}
          <StatBlock
            label="GDP"
            value={`$${formatNumber(metrics.gdp)}`}
            color="text-amber-400"
          />

          <Divider />

          {/* Unemployment */}
          <StatBlock
            label="UNEMPLOY"
            value={`${(metrics.unemployment * 100).toFixed(1)}%`}
            color={
              metrics.unemployment > 0.1 ? 'text-rose-400' : 'text-sky-400'
            }
          />
        </div>
      </div>

      {/* Bottom-left: speed controls */}
      <div className="absolute bottom-6 left-6 z-10">
        <div className="glass-card flex items-center gap-1 px-3 py-2">
          <span className="text-xs text-white/40 mr-2 uppercase tracking-wider">
            Speed
          </span>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              title={opt.title}
              onClick={() => setSpeed(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                speed === opt.value
                  ? 'bg-white/20 text-white shadow-[0_0_8px_rgba(255,255,255,0.15)]'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-right: overlay toggles */}
      <div className="absolute bottom-6 right-6 z-10">
        <div className="glass-card flex items-center gap-2 px-3 py-2">
          <OverlayToggle
            label="Metrics"
            active={showMetrics}
            onClick={toggleMetrics}
          />
        </div>
      </div>
    </>
  );
}

function StatBlock({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center min-w-[72px]">
      <span className={`stat-value text-lg ${color}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-white/10" />;
}

function OverlayToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all ${
        active
          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
          : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
