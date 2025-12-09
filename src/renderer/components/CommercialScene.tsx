import { Suspense, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const OFFICE_MODEL_PATH = 'data/models/mersus_office.glb';

// Enable camera position logging for exploration
const DEBUG_LOG_CAMERA = true;

// ===========================================
// OFFICE MODEL COMPONENT
// ===========================================

function OfficeModel() {
  const { scene } = useGLTF(OFFICE_MODEL_PATH);

  useEffect(() => {
    // Log materials for debugging if needed
    const materials = new Set<string>();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => materials.add(m.name));
      }
    });
    console.log('Office model materials:', Array.from(materials));
  }, [scene]);

  return <primitive object={scene} />;
}

// ===========================================
// CAMERA LOGGER COMPONENT
// ===========================================

function CameraLogger() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const lastLogRef = useRef({ pos: '', target: '' });

  // Log camera info when it changes
  const logCamera = useCallback(() => {
    if (!DEBUG_LOG_CAMERA) return;

    const pos = camera.position;
    const posStr = `[${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}]`;

    // Get target from controls if available
    let targetStr = 'N/A';
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      targetStr = `[${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}]`;
    }

    // Only log if changed
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
      // Pan with right mouse button
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      // No restrictions for exploration
      minDistance={0.1}
      maxDistance={100}
    />
  );
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
          position: [5, 5, 5],
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

        {/* Camera Controls with logging */}
        <CameraLogger />
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
