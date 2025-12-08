import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Path to the car model (relative to the app root)
const CAR_MODEL_PATH = 'data/models/f1_2026_audi_fom.glb';

// Debug mode - log materials to discover colorable parts
const DEBUG_LOG_MATERIALS = false;

// Materials to color with team colors
const PRIMARY_COLOR_MATERIALS: string[] = ['livery_audi_01', 'glass', 'fom_car_detail', 'fom_car_dummy_decal', 'gp21_cockpit_metal', 'boya', 'plastic_interior'];
// Materials that should always be dark carbon (not team secondary color)
const CARBON_MATERIALS: string[] = ['livery_audi_01_carbon2', 'material'];

// ===========================================
// CAR MODEL COMPONENT
// ===========================================

interface CarModelProps {
  primaryColor?: string;
}

function CarModel({ primaryColor }: CarModelProps) {
  const { scene } = useGLTF(CAR_MODEL_PATH);

  useEffect(() => {
    // Debug: assign different color to each material
    if (DEBUG_LOG_MATERIALS) {
      const debugColors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FF8000', '#8000FF', '#00FF80', '#FF0080', '#80FF00', '#0080FF',
        '#FF4444', '#44FF44', '#4444FF', '#FFAA00', '#AA00FF', '#00FFAA',
        '#FF6666', '#66FF66', '#6666FF', '#FFCC00', '#CC00FF', '#00FFCC',
        '#FF8888', '#88FF88', '#8888FF', '#FFEE00', '#EE00FF', '#00FFEE',
        '#FFAAAA', '#AAFFAA', '#AAAAFF', '#FFFF44', '#FF44FF', '#44FFFF',
      ];
      let colorIndex = 0;
      const materials = new Map<string, string>();

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!materials.has(mat.name) && mat instanceof THREE.MeshStandardMaterial) {
              const color = debugColors[colorIndex % debugColors.length];
              materials.set(mat.name, color);
              mat.color.set(color);
              mat.map = null; // Remove texture to see color
              mat.metalness = 0.3;
              mat.roughness = 0.4;
              mat.needsUpdate = true;
              colorIndex++;
            }
          });
        }
      });

      console.log('=== MATERIALS (Debug Colors) ===');
      materials.forEach((color, name) => {
        console.log(`%c■ ${name}`, `color: ${color}; font-weight: bold;`, color);
      });
      console.log(`Total: ${materials.size} materials`);
      return;
    }

    // Production: apply team colors
    if (!primaryColor) return;

    const primaryHex = new THREE.Color(primaryColor);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            if (PRIMARY_COLOR_MATERIALS.includes(mat.name)) {
              mat.map = null; // Remove texture to show pure color
              mat.color.copy(primaryHex);
              mat.metalness = 0.4;
              mat.roughness = 0.15;
              mat.envMapIntensity = 1.5;
              mat.needsUpdate = true;
            }
            if (CARBON_MATERIALS.includes(mat.name)) {
              // Replace with MeshPhongMaterial for subtle shading without PBR reflections
              const phongMat = new THREE.MeshPhongMaterial({
                color: '#444444',
                shininess: 35,
                specular: '#333333',
              });
              child.material = Array.isArray(child.material)
                ? child.material.map((m) => (m.name === mat.name ? phongMat : m))
                : phongMat;
            }
          }
        });
      }
    });
  }, [scene, primaryColor]);

  return (
    <Center>
      <primitive object={scene} scale={1} />
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
  primaryColor?: string;
  className?: string;
}

export function CarViewer3D({ primaryColor, className = '' }: CarViewer3DProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{
          position: [5, 3, 5],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Environment lighting for PBR materials */}
        <Environment preset="city" />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1} />

        {/* Car Model */}
        <Suspense fallback={<LoadingFallback />}>
          <CarModel primaryColor={primaryColor} />
        </Suspense>

        {/* Orbit Controls - click and drag to rotate */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1}
          maxDistance={50}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  );
}

// Preload the model for better performance
useGLTF.preload(CAR_MODEL_PATH);
