import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

const OFFICE_MODEL_PATH = 'data/models/mersus_office.glb';

// Animation duration in seconds (one way)
const ANIMATION_DURATION = 60;

// Camera positions for animation
const CAMERA_START = {
  position: new THREE.Vector3(-2.65, 1.47, 6.64),
  target: new THREE.Vector3(-1.51, 0.08, 2.57),
};

const CAMERA_END = {
  position: new THREE.Vector3(3.11, 1.84, 5.53),
  target: new THREE.Vector3(0.45, 0.16, 1.74),
};

// Bezier ease-in-out function
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ===========================================
// OFFICE MODEL COMPONENT
// ===========================================

function OfficeModel() {
  const { scene } = useGLTF(OFFICE_MODEL_PATH);
  return <primitive object={scene} />;
}

// ===========================================
// ANIMATED CAMERA COMPONENT
// ===========================================

function AnimatedCamera() {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const directionRef = useRef(1); // 1 = forward, -1 = backward

  useFrame((_, delta) => {
    // Update time
    timeRef.current += delta * directionRef.current;

    // Clamp and reverse direction at boundaries
    if (timeRef.current >= ANIMATION_DURATION) {
      timeRef.current = ANIMATION_DURATION;
      directionRef.current = -1;
    } else if (timeRef.current <= 0) {
      timeRef.current = 0;
      directionRef.current = 1;
    }

    // Calculate progress (0 to 1)
    const linearProgress = timeRef.current / ANIMATION_DURATION;
    const easedProgress = easeInOutCubic(linearProgress);

    // Interpolate position
    camera.position.lerpVectors(CAMERA_START.position, CAMERA_END.position, easedProgress);

    // Interpolate target and look at it
    const target = new THREE.Vector3().lerpVectors(CAMERA_START.target, CAMERA_END.target, easedProgress);
    camera.lookAt(target);
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
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <Environment preset="apartment" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* Office Model */}
        <Suspense fallback={<LoadingFallback />}>
          <OfficeModel />
        </Suspense>

        {/* Animated Camera */}
        <AnimatedCamera />
      </Canvas>

      {/* Blur overlay for subpages */}
      {blurred && (
        <div
          className="absolute inset-0 backdrop-blur-xl"
          style={{
            background: `linear-gradient(180deg,
              color-mix(in srgb, var(--accent-900) 75%, transparent) 0%,
              color-mix(in srgb, var(--neutral-950) 92%, transparent) 100%)`,
          }}
        />
      )}
    </div>
  );
}

// Preload the model
useGLTF.preload(OFFICE_MODEL_PATH);
