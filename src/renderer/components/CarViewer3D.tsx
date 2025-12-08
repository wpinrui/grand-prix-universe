import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

// Path to the car model (relative to the app root)
const CAR_MODEL_PATH = 'data/models/f1_2026_audi_fom.glb';

// ===========================================
// CAR MODEL COMPONENT
// ===========================================

interface CarModelProps {
  teamColor?: string;
}

function CarModel({ teamColor }: CarModelProps) {
  const { scene } = useGLTF(CAR_MODEL_PATH);
  const modelRef = useRef<THREE.Group>(null);

  // Log material names on first load to understand the model structure
  useEffect(() => {
    console.log('=== CAR MODEL MATERIALS ===');
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          console.log(`Mesh: "${child.name}" | Material: "${mat.name}" | Type: ${mat.type}`);
        });
      }
    });
    console.log('=== END MATERIALS ===');
  }, [scene]);

  // Apply team color to body materials
  useEffect(() => {
    if (!teamColor) return;

    const color = new THREE.Color(teamColor);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          // @agent: Paint materials that look like body panels
          // Common naming: "body", "paint", "livery", "car_paint", etc.
          // We'll refine this list once we see the actual material names
          const name = mat.name.toLowerCase();
          if (
            name.includes('body') ||
            name.includes('paint') ||
            name.includes('livery') ||
            name.includes('white') ||
            name.includes('car_') ||
            name === 'material' // Often default white material
          ) {
            if ('color' in mat) {
              (mat as THREE.MeshStandardMaterial).color = color;
            }
          }
        });
      }
    });
  }, [scene, teamColor]);

  return (
    <Center>
      <primitive ref={modelRef} object={scene} scale={1} />
    </Center>
  );
}

// ===========================================
// LOADING FALLBACK
// ===========================================

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 0.3, 2]} />
      <meshStandardMaterial color="#333" wireframe />
    </mesh>
  );
}

// ===========================================
// MAIN VIEWER COMPONENT
// ===========================================

interface CarViewer3DProps {
  teamColor?: string;
  className?: string;
}

export function CarViewer3D({ teamColor, className = '' }: CarViewer3DProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{
          position: [4, 2, 4],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <directionalLight position={[-10, 5, -5]} intensity={0.5} />

        {/* Car Model */}
        <Suspense fallback={<LoadingFallback />}>
          <CarModel teamColor={teamColor} />
        </Suspense>

        {/* Orbit Controls - click and drag to rotate */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={15}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  );
}

// Preload the model for better performance
useGLTF.preload(CAR_MODEL_PATH);
