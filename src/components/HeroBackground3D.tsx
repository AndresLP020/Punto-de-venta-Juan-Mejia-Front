'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';

type FormaProps = {
  position: [number, number, number];
  color: string;
  scale: number;
  tipo: 'ico' | 'sphere' | 'box' | 'torus';
  speed: number;
};

function Forma({ position, color, scale, tipo, speed }: FormaProps) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * speed * 0.5;
    ref.current.rotation.y = t * speed * 0.7;
  });
  return (
    <Float speed={speed * 1.4} rotationIntensity={1.2} floatIntensity={2.2}>
      <mesh ref={ref} position={position} scale={scale}>
        {tipo === 'ico' && <icosahedronGeometry args={[1, 0]} />}
        {tipo === 'sphere' && <sphereGeometry args={[1, 32, 32]} />}
        {tipo === 'box' && <boxGeometry args={[1.4, 1.4, 1.4]} />}
        {tipo === 'torus' && <torusGeometry args={[0.8, 0.32, 16, 48]} />}
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.65} />
      </mesh>
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
      { position: [-3.4, 1.1, 0], color: '#2f6bff', scale: 0.95, tipo: 'ico', speed: 0.8 },
      { position: [3.3, -0.9, -1], color: '#f7c948', scale: 0.8, tipo: 'sphere', speed: 1.1 },
      { position: [1.6, 1.6, -2], color: '#ffffff', scale: 0.5, tipo: 'torus', speed: 1.3 },
      { position: [-1.8, -1.4, -1], color: '#ef4444', scale: 0.55, tipo: 'box', speed: 0.9 },
      { position: [4.6, 1.3, -3], color: '#2f6bff', scale: 0.6, tipo: 'ico', speed: 1.0 },
      { position: [-4.6, -0.6, -2], color: '#f7c948', scale: 0.45, tipo: 'sphere', speed: 1.2 },
      { position: [0.2, -1.9, -1.5], color: '#8fb2ff', scale: 0.4, tipo: 'ico', speed: 1.4 },
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
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 5, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-6, -2, 3]} intensity={1.6} color="#2f6bff" />
      <directionalLight position={[6, 3, 2]} intensity={1.4} color="#f7c948" />
      <Escena />
    </Canvas>
  );
}
