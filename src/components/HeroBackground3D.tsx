'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';

type FormaProps = {
  position: [number, number, number];
  color: string;
  scale: number;
  tipo: 'mancuerna' | 'disco' | 'kettlebell' | 'ico';
  speed: number;
};

function Material({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.25} metalness={0.7} emissive={color} emissiveIntensity={0.18} />;
}

/** Mancuerna: barra + dos pares de discos */
function Mancuerna({ color }: { color: string }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.09, 0.09, 2.2, 16]} />
        <meshStandardMaterial color="#C9B8D9" roughness={0.2} metalness={0.9} />
      </mesh>
      {[-0.8, -0.6, 0.6, 0.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[Math.abs(y) > 0.7 ? 0.38 : 0.48, Math.abs(y) > 0.7 ? 0.38 : 0.48, 0.18, 32]} />
          <Material color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** Disco de pesas */
function Disco({ color }: { color: string }) {
  return (
    <mesh>
      <torusGeometry args={[0.75, 0.28, 20, 48]} />
      <Material color={color} />
    </mesh>
  );
}

/** Kettlebell: esfera + asa */
function Kettlebell({ color }: { color: string }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.7, 32, 32]} />
        <Material color={color} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <torusGeometry args={[0.38, 0.1, 16, 32, Math.PI]} />
        <Material color={color} />
      </mesh>
    </group>
  );
}

function Forma({ position, color, scale, tipo, speed }: FormaProps) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * speed * 0.4;
    ref.current.rotation.y = t * speed * 0.6;
  });
  return (
    <Float speed={speed * 1.4} rotationIntensity={1.2} floatIntensity={2.2}>
      <group ref={ref} position={position} scale={scale}>
        {tipo === 'mancuerna' && <Mancuerna color={color} />}
        {tipo === 'disco' && <Disco color={color} />}
        {tipo === 'kettlebell' && <Kettlebell color={color} />}
        {tipo === 'ico' && (
          <mesh>
            <icosahedronGeometry args={[1, 0]} />
            <Material color={color} />
          </mesh>
        )}
      </group>
    </Float>
  );
}

function Escena() {
  const grupo = useRef<Group>(null);
  useFrame((state) => {
    if (grupo.current) {
      grupo.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.3;
    }
  });

  const formas = useMemo<FormaProps[]>(
    () => [
      { position: [-3.4, 1.0, 0], color: '#A100FF', scale: 0.85, tipo: 'mancuerna', speed: 0.7 },
      { position: [3.3, -0.9, -1], color: '#FF00E5', scale: 0.75, tipo: 'kettlebell', speed: 0.9 },
      { position: [1.6, 1.6, -2], color: '#D98BFF', scale: 0.55, tipo: 'disco', speed: 1.2 },
      { position: [-1.8, -1.4, -1], color: '#7900FF', scale: 0.6, tipo: 'disco', speed: 0.9 },
      { position: [4.6, 1.3, -3], color: '#E000FF', scale: 0.6, tipo: 'mancuerna', speed: 1.0 },
      { position: [-4.6, -0.6, -2], color: '#D98BFF', scale: 0.5, tipo: 'kettlebell', speed: 1.1 },
      { position: [0.2, -1.9, -1.5], color: '#A100FF', scale: 0.35, tipo: 'ico', speed: 1.4 },
    ],
    []
  );

  return (
    <group ref={grupo}>
      {formas.map((f, i) => (
        <Forma key={i} {...f} />
      ))}
    </group>
  );
}

export default function HeroBackground3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 5, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-6, -2, 3]} intensity={1.8} color="#A100FF" />
      <directionalLight position={[6, 3, 2]} intensity={1.5} color="#FF00E5" />
      <Escena />
    </Canvas>
  );
}
