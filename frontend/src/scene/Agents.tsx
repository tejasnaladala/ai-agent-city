import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore, type AgentData } from '../store/simulation';

// Profession colors -- warm pastel voxel palette
const PROFESSION_COLORS: Record<string, string> = {
  farmer: '#7EC882',
  miner: '#C8A87A',
  builder: '#E8A060',
  doctor: '#E87070',
  teacher: '#F2C94C',
  merchant: '#5B93C7',
  craftsman: '#9B7EC8',
  guard: '#8A9AA8',
  priest: '#E8E0D0',
  artist: '#E880A0',
  scientist: '#60C8C8',
  laborer: '#A08870',
  unemployed: '#B0B0B0',
};

const DEFAULT_COLOR = '#B0B0B0';
const HALF_GRID = 32;

// Body dimensions (voxel box-person)
const BODY_W = 0.3;
const BODY_H = 0.5;
const BODY_D = 0.3;
const HEAD_SIZE = 0.25;
const AGENT_Y_BASE = 0.35; // Feet above ground

export function Agents() {
  const agents = useSimulationStore((s) => s.agents);
  const selectedAgentId = useSimulationStore((s) => s.selectedAgentId);
  const selectAgent = useSimulationStore((s) => s.selectAgent);

  // Previous positions for lerping
  const prevPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const targetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());

  // Instanced meshes for body and head
  const bodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const headMeshRef = useRef<THREE.InstancedMesh>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const agentCount = agents.length;
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Update target positions when agents data changes
  useEffect(() => {
    for (const agent of agents) {
      const target = targetPositionsRef.current.get(agent.id);
      const newTarget = new THREE.Vector3(
        agent.x - HALF_GRID,
        AGENT_Y_BASE,
        agent.y - HALF_GRID,
      );

      if (target) {
        prevPositionsRef.current.set(agent.id, target.clone());
      } else {
        prevPositionsRef.current.set(agent.id, newTarget.clone());
      }
      targetPositionsRef.current.set(agent.id, newTarget);
    }
  }, [agents]);

  // Animate agent positions: lerp body + head, apply profession colors
  useFrame(({ clock }) => {
    const bodyMesh = bodyMeshRef.current;
    const headMesh = headMeshRef.current;
    if (!bodyMesh || !headMesh || agentCount === 0) return;

    const lerpFactor = 0.08;

    for (let i = 0; i < agentCount; i++) {
      const agent = agents[i];
      const prev = prevPositionsRef.current.get(agent.id);
      const target = targetPositionsRef.current.get(agent.id);

      if (prev && target) {
        // Smooth lerp
        prev.lerp(target, lerpFactor);

        // Subtle bob
        const bob = Math.sin(clock.elapsedTime * 3 + i * 0.7) * 0.02;

        // Body: box at base position
        tempMatrix.identity();
        tempMatrix.makeScale(1, 1, 1);
        tempMatrix.setPosition(prev.x, prev.y + bob, prev.z);
        bodyMesh.setMatrixAt(i, tempMatrix);

        // Head: sits on top of body
        const headY = prev.y + BODY_H / 2 + HEAD_SIZE / 2 + 0.02 + bob;
        tempMatrix.identity();
        tempMatrix.setPosition(prev.x, headY, prev.z);
        headMesh.setMatrixAt(i, tempMatrix);
      }

      // Color by profession
      const profColor =
        PROFESSION_COLORS[agent.profession.toLowerCase()] ?? DEFAULT_COLOR;
      tempColor.set(profColor);

      // Selected agent: brighten
      if (agent.id === selectedAgentId) {
        tempColor.offsetHSL(0, 0.15, 0.15);
      }

      bodyMesh.setColorAt(i, tempColor);

      // Head is slightly lighter (skin tone)
      tempColor.set('#F5D0B0');
      headMesh.setColorAt(i, tempColor);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
  });

  // Raycasting for click/hover (on body mesh)
  const { raycaster, pointer, camera } = useThree();

  const getAgentAtPointer = useCallback(() => {
    const mesh = bodyMeshRef.current;
    if (!mesh || agentCount === 0) return null;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(mesh);
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const idx = hits[0].instanceId;
      if (idx < agents.length) return agents[idx];
    }
    return null;
  }, [agents, agentCount, raycaster, pointer, camera]);

  const handleClick = useCallback(() => {
    const agent = getAgentAtPointer();
    selectAgent(agent ? agent.id : null);
  }, [getAgentAtPointer, selectAgent]);

  const handlePointerMove = useCallback(() => {
    const agent = getAgentAtPointer();
    setHoveredId(agent?.id ?? null);
    document.body.style.cursor = agent ? 'pointer' : 'auto';
  }, [getAgentAtPointer]);

  // Find hovered/selected agents for overlays
  const hoveredAgent = useMemo(
    () => agents.find((a) => a.id === hoveredId),
    [agents, hoveredId],
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const maxCount = Math.max(agentCount, 1);

  return (
    <group>
      {/* Instanced body boxes */}
      <instancedMesh
        ref={bodyMeshRef}
        args={[undefined, undefined, maxCount]}
        castShadow
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setHoveredId(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
        <meshStandardMaterial
          roughness={0.8}
          metalness={0}
          vertexColors
          flatShading
        />
      </instancedMesh>

      {/* Instanced head boxes */}
      <instancedMesh
        ref={headMeshRef}
        args={[undefined, undefined, maxCount]}
        castShadow
      >
        <boxGeometry args={[HEAD_SIZE, HEAD_SIZE, HEAD_SIZE]} />
        <meshStandardMaterial
          roughness={0.7}
          metalness={0}
          vertexColors
          flatShading
        />
      </instancedMesh>

      {/* Hover label */}
      {hoveredAgent && <HoverLabel agent={hoveredAgent} />}

      {/* Selection glow ring */}
      {selectedAgent && <SelectionGlow agent={selectedAgent} />}
    </group>
  );
}

function HoverLabel({ agent }: { agent: AgentData }) {
  const pos = useMemo(
    () =>
      new THREE.Vector3(
        agent.x - HALF_GRID,
        AGENT_Y_BASE + BODY_H + HEAD_SIZE + 0.5,
        agent.y - HALF_GRID,
      ),
    [agent.x, agent.y],
  );

  return (
    <Html position={pos} center distanceFactor={20} zIndexRange={[10, 0]}>
      <div className="glass-card px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
        <span className="font-bold">{agent.name}</span>
        <span className="text-white/50 ml-1">({agent.profession})</span>
      </div>
    </Html>
  );
}

/**
 * Yellow glowing voxel ring around selected agent.
 * Uses a flat box as a selection indicator.
 */
function SelectionGlow({ agent }: { agent: AgentData }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.1;
      ref.current.scale.set(scale, 1, scale);
      ref.current.rotation.y = clock.elapsedTime * 1.5;
    }
  });

  return (
    <mesh
      ref={ref}
      position={[agent.x - HALF_GRID, 0.08, agent.y - HALF_GRID]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.3, 0.42, 4]} />
      <meshBasicMaterial
        color="#F2C94C"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
