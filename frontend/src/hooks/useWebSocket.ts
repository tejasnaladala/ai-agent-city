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
      // Auto-start the simulation
      ws.send(JSON.stringify({ command: 'play' }));
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
          case 'init': {
            // Initial state from backend
            const agents = msg.state?.agents;
            if (agents) {
              const agentList = Object.values(agents).map((a: any) => ({
                id: a.id, x: a.x, y: a.y,
                profession: a.profession ?? a.state ?? 'idle',
                action: a.state ?? 'idle',
                health: a.energy ?? 100,
                name: a.name ?? 'Agent',
              }));
              state.updateAgents(agentList);
            }
            break;
          }

          case 'tick': {
            // Tick messages contain agent_deltas, events, metrics
            const metrics = msg.metrics ?? {};
            state.updateTick(
              msg.tick,
              msg.season ?? state.season,
              metrics.population ?? state.metrics.population,
              metrics.coins ?? metrics.gdp ?? state.metrics.gdp,
            );

            // Extract agents from agent_deltas
            if (msg.agent_deltas && msg.agent_deltas.length > 0) {
              const currentAgents = [...state.agents];
              for (const delta of msg.agent_deltas) {
                if (delta.removed) {
                  const idx = currentAgents.findIndex(a => a.id === delta.id);
                  if (idx >= 0) currentAgents.splice(idx, 1);
                  continue;
                }
                const existing = currentAgents.findIndex(a => a.id === delta.id);
                const agentData = {
                  id: delta.id,
                  x: delta.x,
                  y: delta.y,
                  profession: delta.profession ?? delta.state ?? 'idle',
                  action: delta.state ?? 'idle',
                  health: delta.energy ?? 100,
                  name: delta.name ?? 'Agent',
                };
                if (existing >= 0) {
                  currentAgents[existing] = agentData;
                } else {
                  currentAgents.push(agentData);
                }
              }
              state.updateAgents(currentAgents);
            }

            // Extract events
            if (msg.events && msg.events.length > 0) {
              for (const evt of msg.events) {
                state.addEvent({
                  type: evt.type ?? evt.event_type ?? 'info',
                  description: evt.description ?? evt.message ?? JSON.stringify(evt),
                  tick: msg.tick,
                });
              }
            }

            // Update metrics
            if (metrics.population !== undefined) {
              state.updateMetrics({
                population: metrics.population ?? 0,
                gdp: metrics.coins ?? metrics.gdp ?? 0,
                unemployment: metrics.unemployment ?? 0,
                avgWage: metrics.avg_wage ?? metrics.avgWage ?? 0,
                gini: metrics.gini ?? 0,
                tick: msg.tick,
                season: msg.season ?? state.season,
              });
            }
            break;
          }

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
