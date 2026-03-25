import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- Voxel Pixel Art Palette ---
const PALETTE = {
  grass: '#7EC882',
  grassDark: '#5EAA62',
  water: '#5B93C7',
  waterDeep: '#4A7DB0',
  farmland: '#C8B87A',
  road: '#6B6B6B',
  roadLight: '#7A7A7A',
  industrial: '#8A8A8A',
  sand: '#E8D5B7',
} as const;

const GRID_SIZE = 64;
const TILE_SIZE = 1;
const TILE_HEIGHT = 0.1; // Flat voxel tiles
const HALF = (GRID_SIZE * TILE_SIZE) / 2;

type TileType = 'grass' | 'water' | 'farmland' | 'road' | 'industrial';

// Deterministic terrain generation
function tileAt(x: number, z: number): TileType {
  const dx = x - GRID_SIZE / 2;
  const dz = z - GRID_SIZE / 2;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // River down the middle (sinuous)
  if (Math.abs(x - GRID_SIZE / 2 + Math.sin(z * 0.3) * 3) < 2) return 'water';

  // Roads in a grid pattern
  if (x % 8 === 0 || z % 8 === 0) return 'road';

  // Industrial ring
  if (dist > 20 && dist < 25) return 'industrial';

  // Farmland on edges
  if (dist > 25) return 'farmland';

  // City center is grass
  return 'grass';
}

// Subtle voxel-style height variation (very small, for that uneven ground look)
function elevation(x: number, z: number, tile: TileType): number {
  if (tile === 'water') return -0.02; // Water sits slightly lower
  if (tile === 'road') return 0; // Roads are perfectly flat
  // Grass and farmland have subtle bumps
  const noise = Math.sin(x * 1.7) * Math.cos(z * 2.3) * 0.03;
  return noise;
}

// Color for each tile type with per-tile variation
function tileColor(tile: TileType, x: number, z: number): string {
  switch (tile) {
    case 'grass': {
      // Alternate between two greens in a checker for voxel charm
      const checker = (x + z) % 3 === 0;
      return checker ? PALETTE.grassDark : PALETTE.grass;
    }
    case 'water':
      return (x + z) % 2 === 0 ? PALETTE.water : PALETTE.waterDeep;
    case 'farmland': {
      // Striped fields
      const strip = z % 4 < 2;
      return strip ? PALETTE.farmland : PALETTE.sand;
    }
    case 'road':
      return (x + z) % 2 === 0 ? PALETTE.road : PALETTE.roadLight;
    case 'industrial':
      return PALETTE.industrial;
    default:
      return PALETTE.grass;
  }
}

interface TerrainProps {
  season: string;
}

export function Terrain({ season }: TerrainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Season color adjustments
  const seasonModifier = useMemo(() => {
    switch (season) {
      case 'winter':
        return { grassHue: 0.55, grassSat: -0.3, grassLight: 0.15 };
      case 'autumn':
        return { grassHue: -0.08, grassSat: 0.05, grassLight: -0.05 };
      case 'summer':
        return { grassHue: 0.02, grassSat: 0.1, grassLight: 0.03 };
      default: // spring
        return { grassHue: 0, grassSat: 0, grassLight: 0 };
    }
  }, [season]);

  // Build instance matrices and colors
  const { count } = useMemo(() => {
    const mesh = meshRef.current;
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    let idx = 0;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = tileAt(x, z);
        const elev = elevation(x, z, tile);
        const h = TILE_HEIGHT;

        const posX = x * TILE_SIZE - HALF + 0.5;
        const posY = elev;
        const posZ = z * TILE_SIZE - HALF + 0.5;

        tempMatrix.identity();
        tempMatrix.makeScale(TILE_SIZE * 0.96, h, TILE_SIZE * 0.96);
        tempMatrix.setPosition(posX, posY, posZ);

        if (mesh) {
          mesh.setMatrixAt(idx, tempMatrix);
        }

        // Apply color
        const hex = tileColor(tile, x, z);
        tempColor.set(hex);

        // Season tint for grass/farmland
        if (tile === 'grass' || tile === 'farmland') {
          tempColor.offsetHSL(
            seasonModifier.grassHue,
            seasonModifier.grassSat,
            seasonModifier.grassLight,
          );
        }

        // Winter: snow on everything except water/road
        if (season === 'winter' && tile !== 'water' && tile !== 'road') {
          tempColor.lerp(new THREE.Color('#E8E8F0'), 0.5);
        }

        // Subtle per-tile brightness variation for voxel charm
        tempColor.offsetHSL(0, 0, Math.sin(x * 3.1 + z * 2.7) * 0.02);

        if (mesh) {
          mesh.setColorAt(idx, tempColor);
        }

        idx++;
      }
    }

    if (mesh) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    return { count: GRID_SIZE * GRID_SIZE };
  }, [season, seasonModifier]);

  return (
    <group>
      {/* Base ground plane underneath to avoid seeing through gaps */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 0]}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE + 10, GRID_SIZE + 10]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={1} />
      </mesh>

      {/* Shadow catcher */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE + 10, GRID_SIZE + 10]} />
        <shadowMaterial opacity={0.25} />
      </mesh>

      {/* Instanced voxel terrain tiles */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.9}
          metalness={0}
          vertexColors
          flatShading
        />
      </instancedMesh>

      {/* Water shimmer overlay */}
      <WaterShimmer />
    </group>
  );
}

/**
 * Subtle animated water surface overlay for the river area.
 * Voxel-style: just a flat semi-transparent plane with gentle emissive pulse.
 */
function WaterShimmer() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.1 + Math.sin(clock.elapsedTime * 1.5) * 0.05;
      mat.opacity = 0.35 + Math.sin(clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.07, 0]}
    >
      <planeGeometry args={[5, GRID_SIZE]} />
      <meshStandardMaterial
        color={PALETTE.water}
        emissive="#7AB8E0"
        emissiveIntensity={0.1}
        transparent
        opacity={0.35}
        roughness={0.3}
        metalness={0}
      />
    </mesh>
  );
}
