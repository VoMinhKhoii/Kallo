'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { LabMood } from '../use-demo';
import { FallbackBlobs } from '../v1/shader-field';

/**
 * v2's signature: a real 3D still-life — a hovering ceramic bowl with
 * steam and orbiting ingredient forms in warm clay tones. The camera
 * breathes with the cursor; on a derivation result the ingredients fall
 * into orbit around the bowl.
 *
 * Composition keeps the center clear for the copy: the bowl sits right
 * of center and a counterweight form sits far left.
 */

const SPEED: Record<LabMood, number> = {
  idle: 0.6,
  typing: 1.1,
  analyzing: 2.4,
  result: 0.5,
};

interface IngredientSpec {
  kind: 'sphere' | 'box' | 'torus' | 'cone';
  color: string;
  /** Orbit radius, height, and phase offset around the bowl. */
  radius: number;
  height: number;
  phase: number;
  scale: number;
}

const INGREDIENTS: IngredientSpec[] = [
  {
    kind: 'sphere',
    color: '#c9a87c',
    radius: 2.6,
    height: 0.9,
    phase: 0,
    scale: 0.2,
  },
  {
    kind: 'box',
    color: '#e8d5b5',
    radius: 3.1,
    height: 0.2,
    phase: 1.1,
    scale: 0.24,
  },
  {
    kind: 'torus',
    color: '#b89968',
    radius: 2.9,
    height: 1.4,
    phase: 2.3,
    scale: 0.18,
  },
  {
    kind: 'cone',
    color: '#7ca368',
    radius: 3.4,
    height: 0.5,
    phase: 3.4,
    scale: 0.2,
  },
  {
    kind: 'sphere',
    color: '#a8a29e',
    radius: 2.4,
    height: 1.8,
    phase: 4.2,
    scale: 0.14,
  },
  {
    kind: 'box',
    color: '#c9a87c',
    radius: 3.6,
    height: 1.1,
    phase: 5.1,
    scale: 0.16,
  },
];

function Ingredient({ spec }: { spec: IngredientSpec }) {
  const geometry = useMemo(() => {
    switch (spec.kind) {
      case 'sphere':
        return new THREE.SphereGeometry(1, 24, 24);
      case 'box':
        return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      case 'torus':
        return new THREE.TorusGeometry(1, 0.42, 16, 32);
      case 'cone':
        return new THREE.ConeGeometry(1, 2, 24);
    }
  }, [spec.kind]);

  return (
    <mesh geometry={geometry} scale={spec.scale}>
      <meshStandardMaterial
        color={spec.color}
        roughness={0.55}
        metalness={0.05}
      />
    </mesh>
  );
}

function Bowl() {
  const points = useMemo(() => {
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const angle = (t * Math.PI) / 2.15;
      profile.push(
        new THREE.Vector2(Math.sin(angle) * 1.5, (1 - Math.cos(angle)) * 1.15)
      );
    }
    return profile;
  }, []);

  return (
    <group>
      <mesh>
        <latheGeometry args={[points, 56]} />
        <meshStandardMaterial
          color="#ede0ca"
          roughness={0.5}
          metalness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glaze ring at the rim — the tan accent, in clay. */}
      <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.44, 0.035, 12, 64]} />
        <meshStandardMaterial
          color="#c9a87c"
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

function Steam({ speed }: { speed: RefObject<number> }) {
  const puffs = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = puffs.current;
    if (!group) {
      return;
    }
    const t = state.clock.elapsedTime * (speed.current ?? 1) * 0.5;
    group.children.forEach((puff, index) => {
      const cycle = (t * 0.4 + index * 0.33) % 1;
      puff.position.y = 1.2 + cycle * 1.8;
      puff.position.x = Math.sin(t + index * 2.1) * 0.18;
      const material = (puff as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = 0.16 * Math.sin(cycle * Math.PI);
      puff.scale.setScalar(0.25 + cycle * 0.45);
    });
  });

  return (
    <group ref={puffs}>
      {[0, 1, 2].map((index) => (
        <mesh key={index}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function StillLife({ mood }: { mood: LabMood }) {
  const root = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const speed = useRef(SPEED.idle);
  const gather = useRef(1); // 1 = wide orbit, 0.42 = gathered over the bowl
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const ease = 1 - Math.exp(-dt * 2.5);
    speed.current += (SPEED[mood] - speed.current) * ease;
    gather.current += ((mood === 'result' ? 0.42 : 1) - gather.current) * ease;

    const group = root.current;
    if (group) {
      // Cursor parallax + a slow scroll dolly.
      const targetY = pointer.current.x * 0.16;
      const targetX = pointer.current.y * 0.08;
      group.rotation.y += (targetY - group.rotation.y) * ease;
      group.rotation.x += (targetX - group.rotation.x) * ease;
      const scroll = typeof window === 'undefined' ? 0 : window.scrollY;
      group.position.y = -0.9 + Math.min(scroll, 600) * 0.0012;
      if (!prefersReducedMotion) {
        group.position.y += Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
      }
    }

    const ring = orbit.current;
    if (ring && !prefersReducedMotion) {
      ring.rotation.y += dt * 0.25 * speed.current;
      ring.children.forEach((child, index) => {
        const spec = INGREDIENTS[index];
        if (!spec) {
          return;
        }
        const radius = spec.radius * gather.current;
        child.position.set(
          Math.cos(spec.phase) * radius,
          spec.height * gather.current +
            Math.sin(state.clock.elapsedTime * 1.1 + spec.phase) * 0.12,
          Math.sin(spec.phase) * radius
        );
        child.rotation.x += dt * 0.4;
        child.rotation.y += dt * 0.3;
      });
    }
  });

  return (
    <group
      ref={root}
      position={[2.3, -0.9, -0.8]}
      scale={0.62}
      rotation={[0.12, -0.35, 0]}
    >
      <Bowl />
      <Steam speed={speed} />
      <group ref={orbit}>
        {INGREDIENTS.map((spec) => (
          <Ingredient key={`${spec.kind}-${spec.phase}`} spec={spec} />
        ))}
      </group>
    </group>
  );
}

export function V2Scene({ mood }: { mood: LabMood }) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        fallback={<FallbackBlobs />}
        frameloop={prefersReducedMotion ? 'demand' : 'always'}
        dpr={[1, 1.5]}
        camera={{ fov: 42, position: [0, 0.7, 6.4] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        {/* Tungsten studio: one warm key, one cream fill, no cool light. */}
        <ambientLight intensity={0.85} color="#fdf6e9" />
        <directionalLight
          position={[4, 6, 3]}
          intensity={1.6}
          color="#ffe3b8"
        />
        <directionalLight
          position={[-5, 2, -2]}
          intensity={0.4}
          color="#e8d5b5"
        />
        <StillLife mood={mood} />
      </Canvas>
      {/* Soft cream wash keeps the left/center copy on calm ground. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 42% 46%, rgba(254,251,246,0.9), rgba(254,251,246,0.35) 55%, transparent 80%)',
        }}
      />
    </div>
  );
}
