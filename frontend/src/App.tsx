import { Canvas } from '@react-three/fiber';
import { CityScene } from './scene/CityScene';
import { HUD } from './ui/HUD';
import { EventFeed } from './ui/EventFeed';
import { AgentPanel } from './ui/AgentPanel';
import { MetricsPanel } from './ui/MetricsPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useSimulationStore } from './store/simulation';

export function App() {
  useWebSocket('ws://localhost:8765');
  const selectedAgentId = useSimulationStore((s) => s.selectedAgentId);
  const showMetrics = useSimulationStore((s) => s.showMetrics);

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] relative overflow-hidden">
      <Canvas
        shadows
        orthographic
        camera={{
          zoom: 12,
          position: [40, 40, 40],
          near: -200,
          far: 500,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        flat
      >
        <CityScene />
      </Canvas>

      <HUD />
      <EventFeed />
      {selectedAgentId && <AgentPanel />}
      {showMetrics && <MetricsPanel />}
    </div>
  );
}
