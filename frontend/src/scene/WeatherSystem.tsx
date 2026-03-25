import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WeatherSystemProps {
  season: string;
}

export function WeatherSystem({ season }: WeatherSystemProps) {
  switch (season) {
    case 'spring':
      return <SpringPetals />;
    case 'summer':
      return <SummerHaze />;
    case 'autumn':
      return <AutumnLeaves />;
    case 'winter':
      return <WinterSnow />;
    default:
      return null;
  }
}

// --- SPRING: Floating cherry blossom petals ---

function SpringPetals() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 300;

  const { positions, velocities, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const ph = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 20 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;

      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = -0.005 - Math.random() * 0.01;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, velocities: vel, phases: ph };
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Flutter sideways
      arr[idx] += velocities[idx] + Math.sin(t * 2 + phases[i]) * 0.01;
      arr[idx + 1] += velocities[idx + 1];
      arr[idx + 2] += velocities[idx + 2] + Math.cos(t * 1.5 + phases[i]) * 0.01;

      // Reset when below ground
      if (arr[idx + 1] < 0) {
        arr[idx] = (Math.random() - 0.5) * 70;
        arr[idx + 1] = 20 + Math.random() * 5;
        arr[idx + 2] = (Math.random() - 0.5) * 70;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffaacc"
        size={0.15}
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// --- SUMMER: Golden haze particles + bright rays ---

function SummerHaze() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 150;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = 1 + Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.elapsedTime * 0.3;

    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t + i * 0.1) * 0.005;
      arr[i * 3] += Math.cos(t * 0.7 + i * 0.3) * 0.003;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffdd88"
          size={0.25}
          transparent
          opacity={0.3}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Sun god rays via a simple cone */}
      <mesh position={[30, 30, 15]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[8, 40, 6, 1, true]} />
        <meshBasicMaterial
          color="#ffdd66"
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// --- AUTUMN: Tumbling leaves ---

function AutumnLeaves() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 250;

  const { positions, velocities, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const ph = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 15 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;

      vel[i * 3] = (Math.random() - 0.5) * 0.03;
      vel[i * 3 + 1] = -0.008 - Math.random() * 0.015;
      vel[i * 3 + 2] = (Math.random() - 0.3) * 0.02;

      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, velocities: vel, phases: ph };
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Tumble with wind
      arr[idx] += velocities[idx] + Math.sin(t + phases[i]) * 0.015;
      arr[idx + 1] += velocities[idx + 1];
      arr[idx + 2] += velocities[idx + 2] + Math.cos(t * 0.8 + phases[i]) * 0.012;

      if (arr[idx + 1] < 0) {
        arr[idx] = (Math.random() - 0.5) * 70;
        arr[idx + 1] = 15 + Math.random() * 5;
        arr[idx + 2] = (Math.random() - 0.5) * 70;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#cc7722"
        size={0.18}
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  );
}

// --- WINTER: Snowfall ---

function WinterSnow() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 500;

  const { positions, speeds, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const ph = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      spd[i] = 0.01 + Math.random() * 0.02;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, speeds: spd, phases: ph };
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      arr[idx] += Math.sin(t * 0.5 + phases[i]) * 0.005;
      arr[idx + 1] -= speeds[i];
      arr[idx + 2] += Math.cos(t * 0.3 + phases[i]) * 0.005;

      if (arr[idx + 1] < 0) {
        arr[idx] = (Math.random() - 0.5) * 80;
        arr[idx + 1] = 25;
        arr[idx + 2] = (Math.random() - 0.5) * 80;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.1}
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
