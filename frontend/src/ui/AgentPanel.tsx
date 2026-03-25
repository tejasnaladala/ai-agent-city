import { useMemo } from 'react';
import { useSimulationStore } from '../store/simulation';

const BIG_FIVE_LABELS = [
  'Openness',
  'Conscientiousness',
  'Extraversion',
  'Agreeableness',
  'Neuroticism',
];

export function AgentPanel() {
  const selectedAgentId = useSimulationStore((s) => s.selectedAgentId);
  const agents = useSimulationStore((s) => s.agents);
  const selectAgent = useSimulationStore((s) => s.selectAgent);

  const agent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  if (!agent) return null;

  const personality = agent.personality ?? {};
  const needs = agent.needs ?? {};
  const connections = agent.connections ?? [];
  const memories = agent.memories ?? [];

  return (
    <div className="absolute top-20 left-4 z-10 w-80 animate-slide-in">
      <div className="glass-card p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{agent.name}</h2>
            <p className="text-xs text-white/50">
              {agent.profession} {agent.age ? `\u00B7 Age ${agent.age}` : ''}
            </p>
          </div>
          <button
            onClick={() => selectAgent(null)}
            className="text-white/30 hover:text-white/70 text-lg transition-colors"
            aria-label="Close"
          >
            \u2715
          </button>
        </div>

        {/* Health bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/50">Health</span>
            <span className="text-xs font-mono text-emerald-400">
              {(agent.health * 100).toFixed(0)}%
            </span>
          </div>
          <ProgressBar value={agent.health} color="bg-emerald-500" />
        </div>

        {/* Current action */}
        <div>
          <span className="text-xs text-white/50 uppercase tracking-wider">
            Action
          </span>
          <p className="text-sm mt-0.5">{agent.action || 'Idle'}</p>
        </div>

        {/* Needs */}
        {Object.keys(needs).length > 0 && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Needs
            </span>
            <div className="space-y-1.5 mt-1">
              {Object.entries(needs).map(([need, val]) => (
                <div key={need}>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-white/70 capitalize">
                      {need}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {((val as number) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={val as number}
                    color={
                      (val as number) > 0.6
                        ? 'bg-emerald-500'
                        : (val as number) > 0.3
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personality radar (simplified as bars) */}
        {Object.keys(personality).length > 0 && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Personality
            </span>
            <div className="mt-1">
              <PersonalityRadar traits={personality} />
            </div>
          </div>
        )}

        {/* Goal & Plan */}
        {agent.goal && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Goal
            </span>
            <p className="text-xs text-white/80 mt-0.5">{agent.goal}</p>
          </div>
        )}
        {agent.plan && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Plan
            </span>
            <p className="text-xs text-white/60 mt-0.5 italic">{agent.plan}</p>
          </div>
        )}

        {/* Social connections */}
        {connections.length > 0 && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Connections ({connections.length})
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {connections.slice(0, 8).map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/5"
                >
                  {c}
                </span>
              ))}
              {connections.length > 8 && (
                <span className="text-[10px] text-white/30">
                  +{connections.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Memories */}
        {memories.length > 0 && (
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider">
              Memories
            </span>
            <div className="space-y-1 mt-1 max-h-24 overflow-y-auto">
              {memories.slice(-5).map((m, i) => (
                <p key={i} className="text-[11px] text-white/40 leading-snug">
                  &ldquo;{m}&rdquo;
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PersonalityRadar({ traits }: { traits: Record<string, number> }) {
  const entries = BIG_FIVE_LABELS.map((label) => {
    const key = label.toLowerCase();
    const val = traits[key] ?? traits[label] ?? 0.5;
    return { label, value: val as number };
  });

  // SVG radar chart
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 45;
  const n = entries.length;

  const points = entries.map((e, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = e.value * r;
    return {
      x: cx + Math.cos(angle) * d,
      y: cy + Math.sin(angle) * d,
      lx: cx + Math.cos(angle) * (r + 12),
      ly: cy + Math.sin(angle) * (r + 12),
      label: e.label.slice(0, 3),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={Array.from({ length: n })
            .map((_, i) => {
              const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
              return `${cx + Math.cos(angle) * r * s},${cy + Math.sin(angle) * r * s}`;
            })
            .join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />
      ))}

      {/* Axes */}
      {points.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos((Math.PI * 2 * i) / n - Math.PI / 2) * r}
          y2={cy + Math.sin((Math.PI * 2 * i) / n - Math.PI / 2) * r}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.5"
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(68, 170, 255, 0.15)"
        stroke="#44aaff"
        strokeWidth="1.5"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#44aaff" />
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill="rgba(255,255,255,0.4)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
