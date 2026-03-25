import { create } from 'zustand';

export interface AgentData {
  id: string;
  x: number;
  y: number;
  profession: string;
  action: string;
  health: number;
  name: string;
  age?: number;
  needs?: Record<string, number>;
  personality?: Record<string, number>;
  connections?: string[];
  goal?: string;
  plan?: string;
  memories?: string[];
}

export interface BuildingData {
  id: string;
  x: number;
  y: number;
  type: string;
  progress: number;
  operational: boolean;
}

export interface SimEvent {
  type: string;
  description: string;
  tick: number;
}

export interface MetricsData {
  population: number;
  gdp: number;
  unemployment: number;
  avgWage: number;
  gini: number;
  tick: number;
  season: string;
}

interface SimulationState {
  connected: boolean;
  tick: number;
  season: string;
  agents: AgentData[];
  buildings: BuildingData[];
  events: SimEvent[];
  metrics: MetricsData;
  metricsHistory: MetricsData[];
  selectedAgentId: string | null;
  showMetrics: boolean;
  speed: number;

  setConnected: (c: boolean) => void;
  updateTick: (tick: number, season: string, pop: number, gdp: number) => void;
  updateAgents: (agents: AgentData[]) => void;
  updateBuildings: (buildings: BuildingData[]) => void;
  addEvent: (event: SimEvent) => void;
  updateMetrics: (metrics: MetricsData) => void;
  selectAgent: (id: string | null) => void;
  toggleMetrics: () => void;
  setSpeed: (speed: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  connected: false,
  tick: 0,
  season: 'spring',
  agents: [],
  buildings: [],
  events: [],
  metrics: {
    population: 0,
    gdp: 0,
    unemployment: 0,
    avgWage: 0,
    gini: 0,
    tick: 0,
    season: 'spring',
  },
  metricsHistory: [],
  selectedAgentId: null,
  showMetrics: false,
  speed: 1,

  setConnected: (connected) => set({ connected }),

  updateTick: (tick, season, population, gdp) =>
    set((s) => ({
      tick,
      season,
      metrics: { ...s.metrics, tick, season, population, gdp },
    })),

  updateAgents: (agents) => set({ agents }),

  updateBuildings: (buildings) => set({ buildings }),

  addEvent: (event) =>
    set((s) => ({
      events: [...s.events.slice(-50), event],
    })),

  updateMetrics: (metrics) =>
    set((s) => ({
      metrics,
      metricsHistory: [...s.metricsHistory.slice(-200), metrics],
    })),

  selectAgent: (selectedAgentId) => set({ selectedAgentId }),

  toggleMetrics: () => set((s) => ({ showMetrics: !s.showMetrics })),

  setSpeed: (speed) => set({ speed }),
}));
