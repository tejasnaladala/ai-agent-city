import { useRef, useEffect } from 'react';
import { useSimulationStore, type SimEvent } from '../store/simulation';

const EVENT_STYLES: Record<string, { color: string; icon: string }> = {
  birth: { color: 'event-birth', icon: '\u{1F476}' },
  death: { color: 'event-death', icon: '\u{1FAA6}' },
  employment: { color: 'event-employment', icon: '\u{1F4BC}' },
  building: { color: 'event-building', icon: '\u{1F3D7}' },
  economy: { color: 'event-economy', icon: '\u{1F4B0}' },
  trade: { color: 'event-economy', icon: '\u{1F4B1}' },
  construction: { color: 'event-building', icon: '\u{1F3D7}' },
  social: { color: 'event-employment', icon: '\u{1F91D}' },
  info: { color: 'text-white/60', icon: '\u{2139}\u{FE0F}' },
};

const DEFAULT_STYLE = { color: 'text-white/60', icon: '\u{1F4AC}' };

export function EventFeed() {
  const events = useSimulationStore((s) => s.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  const visibleEvents = events.slice(-20);

  return (
    <div className="absolute top-20 right-4 z-10 w-80">
      <div className="glass-card p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-semibold">
            Events
          </h3>
          <span className="text-[10px] text-white/30 font-mono">
            {events.length} total
          </span>
        </div>

        {/* Scrollable list */}
        <div
          ref={scrollRef}
          className="max-h-80 overflow-y-auto space-y-1 scrollbar-thin"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {visibleEvents.length === 0 && (
            <div className="text-center text-white/20 text-xs py-4">
              Waiting for events...
            </div>
          )}

          {visibleEvents.map((event, i) => (
            <EventItem key={`${event.tick}-${i}`} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: SimEvent }) {
  const style = EVENT_STYLES[event.type] ?? DEFAULT_STYLE;

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      <span className="text-xs mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs leading-relaxed ${style.color}`}>
          {event.description}
        </p>
        <span className="text-[10px] text-white/20 font-mono">
          t={event.tick}
        </span>
      </div>
    </div>
  );
}
