import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  DepthOfField,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Buildings } from './Buildings';
import { Agents } from './Agents';
import { CityLights } from './CityLights';
import { WeatherSystem } from './WeatherSystem';
import { useSimulationStore } from '../store/simulation';

// --- Voxel Pixel Art Palette ---
// Sand:       #E8D5B7
// Grass:      #7EC882
// Water:      #5B93C7
// Terracotta: #D4836B
// Warm light: #F2C94C
// Sky day:    #87CEEB
// Sky night:  #1a1a3e

export function CityScene() {
  const season = useSimulationStore((s) => s.season);
  const tick = useSimulationStore((s) => s.tick);

  // Day/night cycle: 0 = midnight, 0.5 = noon
  const timeOfDay = (tick % 2400) / 2400;
  const isNight = timeOfDay < 0.25 || timeOfDay > 0.75;
  const isMidDay = timeOfDay > 0.3 && timeOfDay < 0.7;

  // Sun position for directional light
  const sunPosition = useMemo((): [number, number, number] => {
    const angle = timeOfDay * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(angle) * 80, Math.sin(angle) * 80, 40];
  }, [timeOfDay]);

  // Warm pastel lighting for voxel aesthetic
  const ambientIntensity = isNight ? 0.15 : 0.5;
  const ambientColor = isNight ? '#2a2a5e' : '#FFF5E6';
  const sunColor = isMidDay ? '#FFF8F0' : '#FFAA77';
  const sunIntensity = isNight ? 0.2 : 1.2;

  // Warm fog for tilt-shift miniature feel
  const fogColor = isNight ? '#141428' : '#E8DDD0';

  return (
    <>
      {/* Voxel-style warm ambient light */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {/* Main directional (sun) with soft shadows */}
      <directionalLight
        position={sunPosition}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.001}
      />

      {/* Hemisphere light for soft ambient occlusion feel */}
      <hemisphereLight
        color={isNight ? '#334466' : '#C8E0FF'}
        groundColor={isNight ? '#1a1a2e' : '#E8D5B7'}
        intensity={isNight ? 0.1 : 0.35}
      />

      {/* Fill light from the opposite side for AO-like softness */}
      <directionalLight
        position={[-40, 20, -30]}
        intensity={isNight ? 0.05 : 0.2}
        color={isNight ? '#445588' : '#FFE8D0'}
      />

      {/* Warm sky background color (no realistic sky/stars -- voxel style) */}
      <color attach="background" args={[isNight ? '#141428' : '#C8E6FF']} />

      {/* Atmospheric fog for depth/tilt-shift miniature feel */}
      <fog attach="fog" args={[fogColor, 40, 100]} />

      {/* World */}
      <Terrain season={season} />
      <Buildings isNight={isNight} />
      <Agents />
      {isNight && <CityLights />}
      <WeatherSystem season={season} />

      {/* Isometric Camera Controls */}
      <IsometricControls />

      {/* Post-processing: tilt-shift + bloom for miniature voxel look */}
      <EffectComposer>
        <DepthOfField
          focusDistance={0}
          focalLength={0.05}
          bokehScale={3}
        />
        <Bloom
          intensity={isNight ? 1.0 : 0.3}
          luminanceThreshold={isNight ? 0.2 : 0.7}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={isNight ? 0.8 : 0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

/**
 * Isometric camera controller.
 * Sets up an orthographic camera at the classic isometric angle
 * (rotateY 45deg, rotateX ~35.264deg).
 */
function IsometricControls() {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame(() => {
    if (!initialized.current && camera instanceof THREE.OrthographicCamera) {
      // Position the camera at isometric angle
      const dist = 60;
      // Isometric: 45deg around Y, ~35.264deg down from horizontal
      const yAngle = Math.PI / 4; // 45 degrees
      const xAngle = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees

      camera.position.set(
        dist * Math.cos(xAngle) * Math.sin(yAngle),
        dist * Math.sin(xAngle),
        dist * Math.cos(xAngle) * Math.cos(yAngle),
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      initialized.current = true;
    }
  });

  return (
    <OrbitControls
      makeDefault
      enableRotate
      enablePan
      enableZoom
      minZoom={0.3}
      maxZoom={3}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.5}
      enableDamping
      dampingFactor={0.05}
      target={[0, 0, 0]}
    />
  );
}
