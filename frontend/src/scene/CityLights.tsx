import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HALF_GRID = 32;

// Warm voxel light palette
const WINDOW_COLORS = [
  '#F2C94C', // warm gold
  '#FFAA44', // amber
  '#FFD088', // soft peach
  '#FFE088', // light gold
  '#FFBB55', // honey
];

export function CityLights() {
  return (
    <group>
      <StreetLanterns />
      <AmbientFireflies />
    </group>
  );
}

/**
 * Voxel street lanterns placed along roads.
 * Each lantern = a small brown post box + a glowing warm cube on top.
 */
function StreetLanterns() {
  const positions = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let x = 0; x < 64; x += 8) {
      for (let z = 4; z < 64; z += 8) {
        pts.push([x - HALF_GRID, 0, z - HALF_GRID]);
      }
    }
    return pts;
  }, []);

  // Instanced post mesh
  const postRef = useRef<THREE.InstancedMesh>(null);
  // Instanced light cube mesh
  const lightRef = useRef<THREE.InstancedMesh>(null);

  useMemo(() => {
    const postMesh = postRef.current;
    const lightMesh = lightRef.current;
    if (!postMesh || !lightMesh) return;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let i = 0; i < positions.length; i++) {
      const [x, , z] = positions[i];

      // Post: thin tall box
      tempMatrix.identity();
      tempMatrix.makeScale(0.08, 1.2, 0.08);
      tempMatrix.setPosition(x, 0.6, z);
      postMesh.setMatrixAt(i, tempMatrix);

      // Light cube on top
      tempMatrix.identity();
      tempMatrix.makeScale(0.18, 0.18, 0.18);
      tempMatrix.setPosition(x, 1.3, z);
      lightMesh.setMatrixAt(i, tempMatrix);

      // Color the light
      tempColor.set(WINDOW_COLORS[i % WINDOW_COLORS.length]);
      lightMesh.setColorAt(i, tempColor);
    }

    postMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
    if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
    postMesh.count = positions.length;
    lightMesh.count = positions.length;
  }, [positions]);

  // Gentle flicker
  useFrame(({ clock }) => {
    const mesh = lightRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity =
      1.0 + Math.sin(clock.elapsedTime * 2) * 0.15;
  });

  const count = Math.max(positions.length, 1);

  return (
    <group>
      {/* Lantern posts */}
      <instancedMesh ref={postRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#6B4F35"
          roughness={0.9}
          metalness={0}
          flatShading
        />
      </instancedMesh>

      {/* Glowing light cubes */}
      <instancedMesh ref={lightRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#F2C94C"
          emissive="#F2C94C"
          emissiveIntensity={1.0}
          roughness={0.5}
          metalness={0}
          vertexColors
        />
      </instancedMesh>

      {/* A few actual point lights at key intersections (max 6 for perf) */}
      {positions.slice(0, 6).map(([x, , z], i) => (
        <pointLight
          key={i}
          position={[x, 1.4, z]}
          color="#F2C94C"
          intensity={0.5}
          distance={5}
          decay={2}
        />
      ))}
    </group>
  );
}

/**
 * Floating ambient firefly particles at night.
 * Warm tiny glowing voxel cubes drifting slowly.
 */
function AmbientFireflies() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 120;

  const particles = useMemo(() => {
    const arr: {
      x: number;
      y: number;
      z: number;
      speed: number;
      phase: number;
    }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 60,
        y: 0.5 + Math.random() * 3,
        z: (Math.random() - 0.5) * 60,
        speed: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
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
      const p = particles[i];
      const px = p.x + Math.sin(t * 0.3 + p.phase) * 0.5;
      const py = p.y + Math.sin(t * p.speed + p.phase) * 0.3;
      const pz = p.z + Math.cos(t * 0.2 + p.phase) * 0.5;

      // Pulse scale
      const pulse = 0.04 + Math.sin(t * 2 + p.phase) * 0.02;

      tempMatrix.identity();
      tempMatrix.makeScale(pulse, pulse, pulse);
      tempMatrix.setPosition(px, py, pz);
      mesh.setMatrixAt(i, tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#FFE888"
        emissive="#FFE888"
        emissiveIntensity={2}
        transparent
        opacity={0.7}
        roughness={1}
        metalness={0}
      />
    </instancedMesh>
  );
}
