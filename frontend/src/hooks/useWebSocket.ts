import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../store/simulation';

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const store = useSimulationStore;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      store.getState().setConnected(true);
      console.log('[WS] Connected to simulation server');
    };

    ws.onclose = () => {
      store.getState().setConnected(false);
      console.log('[WS] Disconnected. Reconnecting in 3s...');
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const state = store.getState();

        switch (msg.type) {
          case 'tick':
            state.updateTick(
              msg.tick,
              msg.season ?? state.season,
              msg.population ?? state.metrics.population,
              msg.gdp ?? state.metrics.gdp,
            );
            break;

          case 'agents':
            state.updateAgents(msg.agents ?? msg.data ?? []);
            break;

          case 'buildings':
            state.updateBuildings(msg.buildings ?? msg.data ?? []);
            break;

          case 'event':
            state.addEvent({
              type: msg.event_type ?? msg.eventType ?? 'info',
              description: msg.description ?? msg.message ?? '',
              tick: msg.tick ?? state.tick,
            });
            break;

          case 'metrics':
            state.updateMetrics({
              population: msg.population ?? 0,
              gdp: msg.gdp ?? 0,
              unemployment: msg.unemployment ?? 0,
              avgWage: msg.avg_wage ?? msg.avgWage ?? 0,
              gini: msg.gini ?? 0,
              tick: msg.tick ?? state.tick,
              season: msg.season ?? state.season,
            });
            break;

          default:
            break;
        }
      } catch {
        // Silently ignore malformed messages
      }
    };
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
