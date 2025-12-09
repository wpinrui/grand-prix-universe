import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, SoftShadows, Sky } from '@react-three/drei';
import * as THREE from 'three';

const OFFICE_MODEL_PATH = 'data/models/mersus_office.glb';

// Animation duration in seconds (one way)
const ANIMATION_DURATION = 30;

// Camera positions for animation
const CAMERA_START = {
  position: new THREE.Vector3(-1.16, 1.47, 6.89),
  target: new THREE.Vector3(-2.53, 0.06, 1.28),
};

const CAMERA_END = {
  position: new THREE.Vector3(1.87, 1.98, 5.52),
  target: new THREE.Vector3(-0.47, -0.19, 0.86),
};

// Sine ease-in-out - gentler, more time in middle
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ===========================================
// OFFICE MODEL COMPONENT
// ===========================================

function OfficeModel() {
  const { scene } = useGLTF(OFFICE_MODEL_PATH);

  // Enable shadows on all meshes
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return <primitive object={scene} />;
}

// ===========================================
// ANIMATED CAMERA COMPONENT
// ===========================================

function AnimatedCamera(): null {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const directionRef = useRef(1); // 1 = forward, -1 = backward
  const targetRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    timeRef.current += delta * directionRef.current;

    if (timeRef.current >= ANIMATION_DURATION) {
      timeRef.current = ANIMATION_DURATION;
      directionRef.current = -1;
    } else if (timeRef.current <= 0) {
      timeRef.current = 0;
      directionRef.current = 1;
    }

    const linearProgress = timeRef.current / ANIMATION_DURATION;
    const easedProgress = easeInOutSine(linearProgress);

    camera.position.lerpVectors(CAMERA_START.position, CAMERA_END.position, easedProgress);
    targetRef.current.lerpVectors(CAMERA_START.target, CAMERA_END.target, easedProgress);
    camera.lookAt(targetRef.current);
  });

  return null;
}

// ===========================================
// LOADING FALLBACK
// ===========================================

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#333" wireframe />
    </mesh>
  );
}

// ===========================================
// MAIN SCENE COMPONENT
// ===========================================

interface CommercialSceneProps {
  className?: string;
  /** Apply blur effect over the scene */
  blurred?: boolean;
}

export function CommercialScene({ className = '', blurred = false }: CommercialSceneProps) {
  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [CAMERA_START.position.x, CAMERA_START.position.y, CAMERA_START.position.z],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.6 }}
        style={{ background: 'transparent' }}
      >
        {/* Sky background */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* Ambient light for overall scene brightness */}
        <ambientLight intensity={0.3} />

        {/* Interior ceiling light - inside room for shadows */}
        <directionalLight
          position={[0, 2.5, 0]}
          intensity={1.2}
          color="#fff5e6"
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-camera-near={0.1}
          shadow-camera-far={10}
          shadow-bias={-0.0001}
        />

        {/* Environment for reflections */}
        <Environment preset="apartment" />

        {/* Office Model */}
        <Suspense fallback={<LoadingFallback />}>
          <OfficeModel />
        </Suspense>

        {/* Soft shadows enhancement */}
        <SoftShadows size={25} samples={16} focus={0.5} />

        <AnimatedCamera />
      </Canvas>

      {/* Blur overlay for subpages */}
      {blurred && (
        <div
          className="absolute inset-0 backdrop-blur-lg"
          style={{
            background: `linear-gradient(180deg,
              color-mix(in srgb, var(--neutral-950) 60%, transparent) 100%)`,
          }}
        />
      )}
    </div>
  );
}

// Preload model
useGLTF.preload(OFFICE_MODEL_PATH);
