import { Suspense, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, OrbitControls, SoftShadows, Sky } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

// Set to true to explore camera positions, false for final animation
const DEBUG_MODE = true;

const OFFICE_MODEL_PATH = 'data/models/mersus_office.glb';

// Animation duration in seconds (one way)
const ANIMATION_DURATION = 30;

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

  // Enable shadows on all meshes and find bounding box
  const box = new THREE.Box3().setFromObject(scene);
  console.log('Model bounds:', {
    min: { x: box.min.x.toFixed(2), y: box.min.y.toFixed(2), z: box.min.z.toFixed(2) },
    max: { x: box.max.x.toFixed(2), y: box.max.y.toFixed(2), z: box.max.z.toFixed(2) },
  });
  console.log('Floor Y level (min.y):', box.min.y.toFixed(2));

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return <primitive object={scene} />;
}

// ===========================================
// CAMERA EXPLORER (DEBUG MODE)
// ===========================================

function CameraExplorer() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const lastLogRef = useRef({ pos: '', target: '' });

  const logCamera = useCallback(() => {
    const pos = camera.position;
    const posStr = `[${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}]`;

    let targetStr = 'N/A';
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      targetStr = `[${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}]`;
    }

    if (posStr !== lastLogRef.current.pos || targetStr !== lastLogRef.current.target) {
      lastLogRef.current = { pos: posStr, target: targetStr };
      console.log(`Camera: position=${posStr}, target=${targetStr}`);
    }
  }, [camera]);

  useFrame(() => {
    logCamera();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

// ===========================================
// ANIMATED CAMERA COMPONENT
// ===========================================

function AnimatedCamera(): null {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const directionRef = useRef(1); // 1 = forward, -1 = backward

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
    const easedProgress = easeInOutCubic(linearProgress);

    camera.position.lerpVectors(CAMERA_START.position, CAMERA_END.position, easedProgress);

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

        {/* Camera: Explorer for debug, Animated for production */}
        {DEBUG_MODE ? <CameraExplorer /> : <AnimatedCamera />}
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

// Preload model
useGLTF.preload(OFFICE_MODEL_PATH);
