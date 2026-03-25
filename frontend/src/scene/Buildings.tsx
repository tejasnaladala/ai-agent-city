import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, type BuildingData } from '../store/simulation';

// --- Voxel Pixel Art Palette ---
const PALETTE = {
  terracotta: '#D4836B',
  terracottaDark: '#B86B55',
  cream: '#F5E6D0',
  creamDark: '#E8D5B7',
  green: '#7EC882',
  greenDark: '#5EAA62',
  brown: '#8B6B4A',
  brownDark: '#6B4F35',
  grey: '#A0A0A0',
  greyDark: '#787878',
  greyLight: '#B8B8B8',
  blue: '#5B93C7',
  red: '#D46B6B',
  yellow: '#F2C94C',
  yellowDark: '#D4A830',
  purple: '#9B7EC8',
  orange: '#E8A060',
  warmLight: '#F2C94C',
  marketRed: '#E87070',
  marketBlue: '#70A8E8',
  marketGreen: '#70C878',
  marketYellow: '#F0D060',
} as const;

const HALF_GRID = 32;

/**
 * A single voxel box (building block).
 * Everything in the voxel city is made of these.
 */
interface VoxelBoxProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
}

function VoxelBox({
  position,
  size,
  color,
  emissive,
  emissiveIntensity = 0,
  castShadow: castShadowProp = true,
}: VoxelBoxProps) {
  return (
    <mesh position={position} castShadow={castShadowProp} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.85}
        metalness={0}
        flatShading
      />
    </mesh>
  );
}

interface BuildingsProps {
  isNight: boolean;
}

export function Buildings({ isNight }: BuildingsProps) {
  const buildings = useSimulationStore((s) => s.buildings);

  const operational = useMemo(
    () => buildings.filter((b) => b.operational),
    [buildings],
  );

  const underConstruction = useMemo(
    () => buildings.filter((b) => !b.operational && b.progress < 1),
    [buildings],
  );

  return (
    <group>
      {operational.map((b) => (
        <VoxelBuilding key={b.id} building={b} isNight={isNight} />
      ))}
      {underConstruction.map((b) => (
        <ConstructionSite key={`c-${b.id}`} building={b} />
      ))}
    </group>
  );
}

interface VoxelBuildingProps {
  building: BuildingData;
  isNight: boolean;
}

/**
 * Renders a building as a stack of voxel boxes.
 * Each building type has a unique silhouette.
 */
function VoxelBuilding({ building, isNight }: VoxelBuildingProps) {
  const x = building.x - HALF_GRID;
  const z = building.y - HALF_GRID;
  const type = building.type.toLowerCase();
  const windowGlow = isNight ? 0.6 : 0;

  switch (type) {
    case 'house':
      return <HouseVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'farm':
      return <FarmVoxel x={x} z={z} />;
    case 'factory':
      return <FactoryVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'market':
      return <MarketVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'workshop':
      return <WorkshopVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'hospital':
      return <HospitalVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'school':
      return <SchoolVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'power_plant':
      return <PowerPlantVoxel x={x} z={z} windowGlow={windowGlow} />;
    case 'town_hall':
      return <TownHallVoxel x={x} z={z} windowGlow={windowGlow} />;
    default:
      return <HouseVoxel x={x} z={z} windowGlow={windowGlow} />;
  }
}

// ---------- BUILDING TYPE VOXEL MODELS ----------

interface BuildingVoxelProps {
  x: number;
  z: number;
  windowGlow?: number;
}

/**
 * House: 2-floor building with terracotta roof.
 * Floor 1: cream walls. Floor 2: cream walls (slightly narrower). Roof: terracotta box on top.
 */
function HouseVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Floor 1 */}
      <VoxelBox position={[0, 0.5, 0]} size={[1.0, 1.0, 1.0]} color={PALETTE.cream} />
      {/* Floor 2 (slightly narrower) */}
      <VoxelBox position={[0, 1.4, 0]} size={[0.9, 0.8, 0.9]} color={PALETTE.creamDark} />
      {/* Roof */}
      <VoxelBox position={[0, 2.1, 0]} size={[1.1, 0.3, 1.1]} color={PALETTE.terracotta} />
      {/* Windows (front) */}
      <VoxelBox
        position={[0.51, 0.6, -0.2]}
        size={[0.02, 0.25, 0.2]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
      <VoxelBox
        position={[0.51, 0.6, 0.2]}
        size={[0.02, 0.25, 0.2]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
      {/* Door */}
      <VoxelBox
        position={[0.51, 0.25, 0]}
        size={[0.02, 0.4, 0.25]}
        color={PALETTE.brownDark}
        castShadow={false}
      />
    </group>
  );
}

/**
 * Farm: Flat wide green area with brown fence posts around it.
 */
function FarmVoxel({ x, z }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Farmland base */}
      <VoxelBox position={[0, 0.1, 0]} size={[2.0, 0.2, 2.0]} color={PALETTE.greenDark} />
      {/* Crop rows */}
      <VoxelBox position={[-0.5, 0.3, 0]} size={[0.3, 0.2, 1.6]} color={PALETTE.green} />
      <VoxelBox position={[0.0, 0.3, 0]} size={[0.3, 0.2, 1.6]} color={PALETTE.green} />
      <VoxelBox position={[0.5, 0.3, 0]} size={[0.3, 0.2, 1.6]} color={PALETTE.green} />
      {/* Fence posts (corners) */}
      <VoxelBox position={[-1.0, 0.35, -1.0]} size={[0.1, 0.5, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[1.0, 0.35, -1.0]} size={[0.1, 0.5, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[-1.0, 0.35, 1.0]} size={[0.1, 0.5, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[1.0, 0.35, 1.0]} size={[0.1, 0.5, 0.1]} color={PALETTE.brown} />
      {/* Fence rails */}
      <VoxelBox position={[0, 0.35, -1.0]} size={[2.0, 0.08, 0.06]} color={PALETTE.brownDark} />
      <VoxelBox position={[0, 0.35, 1.0]} size={[2.0, 0.08, 0.06]} color={PALETTE.brownDark} />
      <VoxelBox position={[-1.0, 0.35, 0]} size={[0.06, 0.08, 2.0]} color={PALETTE.brownDark} />
      <VoxelBox position={[1.0, 0.35, 0]} size={[0.06, 0.08, 2.0]} color={PALETTE.brownDark} />
    </group>
  );
}

/**
 * Factory: Tall grey boxes with a chimney (thin tall box) emitting particles.
 */
function FactoryVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Main body */}
      <VoxelBox position={[0, 1.0, 0]} size={[1.6, 2.0, 1.6]} color={PALETTE.grey} />
      {/* Upper section */}
      <VoxelBox position={[0, 2.3, 0]} size={[1.4, 0.6, 1.4]} color={PALETTE.greyDark} />
      {/* Chimney */}
      <VoxelBox position={[0.5, 3.3, 0.5]} size={[0.25, 1.5, 0.25]} color={PALETTE.greyDark} />
      {/* Chimney cap */}
      <VoxelBox position={[0.5, 4.15, 0.5]} size={[0.35, 0.1, 0.35]} color={PALETTE.grey} />
      {/* Industrial windows */}
      <VoxelBox
        position={[0.81, 1.2, -0.3]}
        size={[0.02, 0.4, 0.3]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow * 0.5}
        castShadow={false}
      />
      <VoxelBox
        position={[0.81, 1.2, 0.3]}
        size={[0.02, 0.4, 0.3]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow * 0.5}
        castShadow={false}
      />
      {/* Smoke particles */}
      <SmokeParticles offset={[0.5, 4.2, 0.5]} />
    </group>
  );
}

/**
 * Market: Colorful stall boxes -- open-air market with awning.
 */
function MarketVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Base platform */}
      <VoxelBox position={[0, 0.15, 0]} size={[1.8, 0.3, 1.2]} color={PALETTE.creamDark} />
      {/* Stall posts */}
      <VoxelBox position={[-0.7, 0.8, -0.5]} size={[0.1, 1.3, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[0.7, 0.8, -0.5]} size={[0.1, 1.3, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[-0.7, 0.8, 0.5]} size={[0.1, 1.3, 0.1]} color={PALETTE.brown} />
      <VoxelBox position={[0.7, 0.8, 0.5]} size={[0.1, 1.3, 0.1]} color={PALETTE.brown} />
      {/* Colorful awning */}
      <VoxelBox position={[-0.45, 1.5, 0]} size={[0.6, 0.08, 1.3]} color={PALETTE.marketRed} />
      <VoxelBox position={[0.0, 1.5, 0]} size={[0.6, 0.08, 1.3]} color={PALETTE.marketYellow} />
      <VoxelBox position={[0.45, 1.5, 0]} size={[0.6, 0.08, 1.3]} color={PALETTE.marketBlue} />
      {/* Goods on counter */}
      <VoxelBox position={[-0.4, 0.4, 0]} size={[0.25, 0.2, 0.25]} color={PALETTE.marketGreen} />
      <VoxelBox position={[0, 0.4, 0]} size={[0.25, 0.2, 0.25]} color={PALETTE.orange} />
      <VoxelBox position={[0.4, 0.4, 0]} size={[0.25, 0.2, 0.25]} color={PALETTE.marketRed} />
      {/* Lantern */}
      <VoxelBox
        position={[0, 1.7, 0]}
        size={[0.15, 0.15, 0.15]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
    </group>
  );
}

/**
 * Workshop: Purple-tinted medium building with gear-like top.
 */
function WorkshopVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      <VoxelBox position={[0, 0.6, 0]} size={[1.1, 1.2, 1.1]} color={PALETTE.purple} />
      <VoxelBox position={[0, 1.4, 0]} size={[0.9, 0.5, 0.9]} color="#8A6BB8" />
      {/* Decorative top */}
      <VoxelBox position={[-0.3, 1.8, -0.3]} size={[0.2, 0.3, 0.2]} color={PALETTE.purple} />
      <VoxelBox position={[0.3, 1.8, 0.3]} size={[0.2, 0.3, 0.2]} color={PALETTE.purple} />
      {/* Window */}
      <VoxelBox
        position={[0.56, 0.7, 0]}
        size={[0.02, 0.3, 0.3]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
    </group>
  );
}

/**
 * Hospital: White/red building with a red cross on top.
 */
function HospitalVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Main body */}
      <VoxelBox position={[0, 0.8, 0]} size={[1.3, 1.6, 1.3]} color="#F0F0F0" />
      <VoxelBox position={[0, 1.8, 0]} size={[1.1, 0.5, 1.1]} color="#E8E8E8" />
      {/* Red cross (horizontal) */}
      <VoxelBox position={[0, 2.2, 0.66]} size={[0.5, 0.12, 0.02]} color={PALETTE.red} castShadow={false} />
      {/* Red cross (vertical) */}
      <VoxelBox position={[0, 2.2, 0.66]} size={[0.12, 0.5, 0.02]} color={PALETTE.red} castShadow={false} />
      {/* Windows */}
      <VoxelBox
        position={[0.66, 0.7, -0.3]}
        size={[0.02, 0.25, 0.2]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
      <VoxelBox
        position={[0.66, 0.7, 0.3]}
        size={[0.02, 0.25, 0.2]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
      <VoxelBox
        position={[0.66, 1.3, 0]}
        size={[0.02, 0.25, 0.25]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
    </group>
  );
}

/**
 * School: Yellow building with a bell tower.
 */
function SchoolVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Main body */}
      <VoxelBox position={[0, 0.6, 0]} size={[1.4, 1.2, 1.0]} color={PALETTE.yellow} />
      {/* Second floor */}
      <VoxelBox position={[0, 1.4, 0]} size={[1.2, 0.5, 0.9]} color={PALETTE.yellowDark} />
      {/* Bell tower */}
      <VoxelBox position={[0, 2.1, 0]} size={[0.35, 0.8, 0.35]} color={PALETTE.yellow} />
      <VoxelBox position={[0, 2.6, 0]} size={[0.45, 0.1, 0.45]} color={PALETTE.yellowDark} />
      {/* Bell */}
      <VoxelBox
        position={[0, 2.35, 0]}
        size={[0.15, 0.15, 0.15]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={0.3}
        castShadow={false}
      />
      {/* Windows */}
      <VoxelBox
        position={[0.71, 0.6, -0.2]}
        size={[0.02, 0.25, 0.18]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
      <VoxelBox
        position={[0.71, 0.6, 0.2]}
        size={[0.02, 0.25, 0.18]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
    </group>
  );
}

/**
 * Power Plant: Tall industrial with orange accents, large chimney.
 */
function PowerPlantVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Main reactor body */}
      <VoxelBox position={[0, 1.2, 0]} size={[1.5, 2.4, 1.5]} color={PALETTE.greyDark} />
      {/* Upper section */}
      <VoxelBox position={[0, 2.8, 0]} size={[1.2, 0.8, 1.2]} color={PALETTE.grey} />
      {/* Cooling tower */}
      <VoxelBox position={[0.4, 3.8, 0.4]} size={[0.5, 1.2, 0.5]} color={PALETTE.greyLight} />
      {/* Orange warning stripes */}
      <VoxelBox position={[0, 0.05, 0.76]} size={[1.5, 0.1, 0.02]} color={PALETTE.orange} castShadow={false} />
      <VoxelBox position={[0, 2.45, 0.61]} size={[1.2, 0.1, 0.02]} color={PALETTE.orange} castShadow={false} />
      {/* Glowing window */}
      <VoxelBox
        position={[0.76, 1.0, 0]}
        size={[0.02, 0.5, 0.5]}
        color={PALETTE.warmLight}
        emissive={PALETTE.orange}
        emissiveIntensity={windowGlow * 0.8}
        castShadow={false}
      />
      {/* Smoke */}
      <SmokeParticles offset={[0.4, 4.4, 0.4]} />
    </group>
  );
}

/**
 * Town Hall: Grand cream/gold building with columns and flag.
 */
function TownHallVoxel({ x, z, windowGlow = 0 }: BuildingVoxelProps) {
  return (
    <group position={[x, 0, z]}>
      {/* Base steps */}
      <VoxelBox position={[0, 0.1, 0]} size={[2.0, 0.2, 1.6]} color={PALETTE.creamDark} />
      {/* Main body */}
      <VoxelBox position={[0, 0.9, 0]} size={[1.8, 1.4, 1.4]} color={PALETTE.cream} />
      {/* Upper floor */}
      <VoxelBox position={[0, 1.9, 0]} size={[1.6, 0.6, 1.2]} color={PALETTE.creamDark} />
      {/* Roof */}
      <VoxelBox position={[0, 2.35, 0]} size={[1.8, 0.15, 1.4]} color={PALETTE.yellowDark} />
      {/* Dome / tower */}
      <VoxelBox position={[0, 2.7, 0]} size={[0.5, 0.5, 0.5]} color={PALETTE.yellow} />
      <VoxelBox position={[0, 3.05, 0]} size={[0.35, 0.2, 0.35]} color={PALETTE.yellowDark} />
      {/* Flag pole */}
      <VoxelBox position={[0, 3.5, 0]} size={[0.05, 0.7, 0.05]} color={PALETTE.brownDark} />
      {/* Flag */}
      <VoxelBox position={[0.15, 3.7, 0]} size={[0.25, 0.15, 0.02]} color={PALETTE.red} castShadow={false} />
      {/* Columns */}
      <VoxelBox position={[-0.65, 0.65, 0.71]} size={[0.12, 1.1, 0.12]} color={PALETTE.cream} />
      <VoxelBox position={[0.65, 0.65, 0.71]} size={[0.12, 1.1, 0.12]} color={PALETTE.cream} />
      <VoxelBox position={[-0.25, 0.65, 0.71]} size={[0.12, 1.1, 0.12]} color={PALETTE.cream} />
      <VoxelBox position={[0.25, 0.65, 0.71]} size={[0.12, 1.1, 0.12]} color={PALETTE.cream} />
      {/* Grand window */}
      <VoxelBox
        position={[0, 1.0, 0.71]}
        size={[0.4, 0.5, 0.02]}
        color={PALETTE.warmLight}
        emissive={PALETTE.warmLight}
        emissiveIntensity={windowGlow}
        castShadow={false}
      />
    </group>
  );
}

// ---------- SMOKE PARTICLES ----------

/**
 * Simple upward-drifting voxel smoke particles from chimneys.
 */
function SmokeParticles({ offset }: { offset: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 8;

  const offsets = useMemo(() => {
    const arr: { phase: number; speed: number; drift: number }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempMatrix = new THREE.Matrix4();
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const o = offsets[i];
      const cycle = ((t * o.speed + o.phase) % 3) / 3;
      const y = cycle * 2;
      const px = Math.sin(t * 0.5 + o.phase) * o.drift;
      const pz = Math.cos(t * 0.3 + o.phase) * o.drift;
      const scale = 0.08 + cycle * 0.12;

      tempMatrix.identity();
      tempMatrix.makeScale(scale, scale, scale);
      tempMatrix.setPosition(px, y, pz);
      mesh.setMatrixAt(i, tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={offset}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#C0C0C0"
          transparent
          opacity={0.4}
          roughness={1}
          metalness={0}
        />
      </instancedMesh>
    </group>
  );
}

// ---------- CONSTRUCTION SITE ----------

interface ConstructionSiteProps {
  building: BuildingData;
}

function ConstructionSite({ building }: ConstructionSiteProps) {
  const x = building.x - HALF_GRID;
  const z = building.y - HALF_GRID;
  const targetH = 2.0;
  const currentH = targetH * building.progress;

  return (
    <group position={[x, 0, z]}>
      {/* Wireframe outline of final building */}
      <mesh position={[0, targetH / 2, 0]}>
        <boxGeometry args={[1.2, targetH, 1.2]} />
        <meshBasicMaterial
          color="#5BC0EB"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Partially built solid voxel stack */}
      {currentH > 0.05 && (
        <VoxelBox
          position={[0, currentH / 2, 0]}
          size={[1.0, currentH, 1.0]}
          color={PALETTE.creamDark}
        />
      )}

      {/* Progress bar floating above */}
      <group position={[0, targetH + 0.4, 0]}>
        <VoxelBox
          position={[0, 0, 0]}
          size={[1.0, 0.08, 0.08]}
          color="#444444"
          castShadow={false}
        />
        <VoxelBox
          position={[(building.progress - 1) * 0.5, 0, 0.01]}
          size={[1.0 * building.progress, 0.08, 0.08]}
          color={PALETTE.blue}
          castShadow={false}
        />
      </group>
    </group>
  );
}
