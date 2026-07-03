'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { type MotionValue, useReducedMotion } from 'motion/react';
import R3fGlobe from 'r3f-globe';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { LabMood } from '../use-demo';
import { FEATURED_ISOS, GLOBE_PALETTE } from './globe-dishes';
import { type TourMarker, tourFocusAt } from './globe-tour';

export interface ProjectedMarker {
  iso: string;
  /** Viewport-space pixels (the canvas fills the viewport). */
  x: number;
  y: number;
  /** False when the country has rotated onto the far hemisphere. */
  front: boolean;
}

/**
 * v3's signature: one ceramic 3D globe in nham clay tones (r3f-globe /
 * three-globe under the hood — no hand-rolled sphere math) that morphs
 * with scroll. At the top of the hero only its horizon arc rises behind
 * the centered copy; as the content scrolls the sphere glides up and
 * settles full and centered, where hovering (tapping) a country raises
 * its polygon and reports the ADM0_A3 code upward for the dish panel.
 *
 * Country polygons come from Natural Earth 110m (public domain), fetched
 * lazily on idle so the bare sphere renders instantly.
 */

/** Rotation speed (rad/s) per demo mood — the globe's pulse. */
const SPEED: Record<LabMood, number> = {
  idle: 0.06,
  typing: 0.1,
  analyzing: 0.5,
  result: 0.03,
};

/** Keep rotation paused this long after the cursor leaves a country. */
const HOVER_LINGER_MS = 1200;
/**
 * Pose that puts Vietnam front and center (lng ≈ 108°E, lat ≈ 14°N).
 * three-globe faces lng 0 at +z with no rotation; rotating the globe by
 * -lng brings that longitude around to the camera.
 */
const HOME_ROTATION_Y = THREE.MathUtils.degToRad(-108);
const HOME_ROTATION_X = THREE.MathUtils.degToRad(10);

/**
 * Scroll keyframes: horizon arc at the hero top → centered sphere. The
 * settled scale leaves the full disc (plus atmosphere) inside the
 * viewport with room for the heading above and cards beside.
 */
const POSE_HORIZON = { y: -205, scale: 1.7 };
const POSE_CENTER = { y: -14, scale: 0.78 };
/** The morph completes within the first screen of story scroll. */
const MORPH_END = 0.14;

interface CountryFeature {
  properties?: { ADM0_A3?: string };
}

export interface V3GlobeSceneProps {
  /** Story scroll progress, 0 (hero top) → 1 (story end). */
  progress: MotionValue<number>;
  /** True once the globe has arrived — enables hover/tap. */
  interactive: boolean;
  mood?: LabMood;
  activeIso?: string | null;
  onCountryChange?: (iso: string | null) => void;
  /** Countries the active tour stop celebrates — tinted on the globe. */
  highlightIsos?: ReadonlySet<string>;
  /** Countries whose screen positions the callout layer needs. */
  markers?: readonly TourMarker[];
  /** Per-frame screen positions of `markers`, for DOM leader lines. */
  onMarkersProject?: (points: ProjectedMarker[]) => void;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function morphAmount(progress: number): number {
  return easeInOut(Math.min(1, Math.max(0, progress / MORPH_END)));
}

/**
 * Deterministic point cloud for the depth backdrop — a fixed-seed LCG
 * instead of Math.random so every render (and HMR pass) drifts the same
 * faint constellation.
 */
function makeStarfield(count: number, seedStart: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let seed = seedStart;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const radius = 300 + next() * 420;
    const theta = next() * Math.PI * 2;
    const phi = Math.acos(2 * next() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.65;
    positions[i * 3 + 2] = -Math.abs(radius * Math.cos(phi)) - 110;
  }
  return positions;
}

/**
 * Warm space, two layers deep: a near field of larger motes and a far
 * field of fine grain drifting at different rates — the parallax is what
 * sells the depth. The far layer breathes (slow opacity sine) so the
 * backdrop never reads as a static texture next to the live globe.
 */
function Starfield({ frozen }: { frozen: boolean }) {
  const near = useRef<THREE.Points>(null);
  const far = useRef<THREE.Points>(null);
  const farMaterial = useRef<THREE.PointsMaterial>(null);
  const nearPositions = useMemo(() => makeStarfield(70, 42), []);
  const farPositions = useMemo(() => makeStarfield(190, 1337), []);

  useFrame((state, delta) => {
    if (frozen) {
      return;
    }
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    if (near.current) {
      near.current.rotation.y += dt * 0.02;
      near.current.rotation.x = Math.sin(t * 0.11) * 0.05;
    }
    if (far.current) {
      far.current.rotation.y += dt * 0.007;
    }
    if (farMaterial.current) {
      farMaterial.current.opacity = 0.38 + Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <>
      <points ref={near}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[nearPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={GLOBE_PALETTE.capHovered}
          size={3.6}
          sizeAttenuation
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </points>
      <points ref={far}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[farPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={farMaterial}
          color={GLOBE_PALETTE.capFeatured}
          size={1.9}
          sizeAttenuation
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </points>
    </>
  );
}

/** Shortest signed angular distance a→b, so rotation never unwinds. */
function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function GlobeRig({
  progress,
  interactive,
  mood = 'idle',
  activeIso = null,
  onCountryChange,
  highlightIsos,
  markers = [],
  onMarkersProject,
  features,
  reduced,
}: V3GlobeSceneProps & { features: object[]; reduced: boolean }) {
  const rig = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const spin = useRef(HOME_ROTATION_Y);
  const lastHoverAt = useRef(0);
  const morph = useRef(0);
  const projectionVector = useMemo(() => new THREE.Vector3(), []);
  const invalidate = useThree((state) => state.invalidate);
  const canvasElement = useThree((state) => state.gl.domElement);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  // R3F registers objects for raycasting from the handlers present when
  // the tree commits — swapping onHover from undefined to a function
  // mid-session does not reliably re-register three-globe's meshes. So
  // the handlers are always attached (with stable identity, so r3f-globe
  // never re-binds) and gating happens inside, via refs.
  const interactiveRef = useRef(interactive);
  const onCountryChangeRef = useRef(onCountryChange);
  useEffect(() => {
    interactiveRef.current = interactive;
    onCountryChangeRef.current = onCountryChange;
  }, [interactive, onCountryChange]);

  const reportCountry = useCallback(
    (_layer: string | undefined, element: object | undefined) => {
      if (!interactiveRef.current) {
        return;
      }
      lastHoverAt.current = performance.now();
      onCountryChangeRef.current?.(
        (element as CountryFeature | undefined)?.properties?.ADM0_A3 ?? null
      );
    },
    []
  );

  // Accessor identity matters: three-globe re-styles all ~180 polygons
  // whenever these props change, so they must NOT be recreated on
  // unrelated re-renders (the hero re-renders per demo keystroke) —
  // only when the hover/highlight state they encode actually moves.
  const polygonCapColor = useCallback(
    (feature: object) => {
      const iso = (feature as CountryFeature).properties?.ADM0_A3;
      if (!iso) {
        return GLOBE_PALETTE.capBase;
      }
      if ((interactive && iso === activeIso) || highlightIsos?.has(iso)) {
        return GLOBE_PALETTE.capHovered;
      }
      return FEATURED_ISOS.has(iso)
        ? GLOBE_PALETTE.capFeatured
        : GLOBE_PALETTE.capBase;
    },
    [interactive, activeIso, highlightIsos]
  );
  const polygonAltitude = useCallback(
    (feature: object) => {
      const iso = (feature as CountryFeature).properties?.ADM0_A3;
      if (!iso) {
        return 0.006;
      }
      if (interactive && iso === activeIso) {
        return 0.035;
      }
      if (highlightIsos?.has(iso)) {
        return 0.028;
      }
      return FEATURED_ISOS.has(iso) ? 0.018 : 0.006;
    },
    [interactive, activeIso, highlightIsos]
  );
  const polygonSideColor = useCallback(() => GLOBE_PALETTE.side, []);
  const polygonStrokeColor = useCallback(() => GLOBE_PALETTE.stroke, []);

  // Under `frameloop="demand"` (reduced motion, offscreen) nothing renders
  // between pointer moves or scroll ticks, so raycast matrices, hover
  // tints, and the scroll morph go stale. One invalidated frame per event
  // keeps them live at zero idle cost.
  useEffect(() => {
    const onCanvasMove = () => invalidate();
    canvasElement.addEventListener('pointermove', onCanvasMove, {
      passive: true,
    });
    const unsubscribe = progress.on('change', () => invalidate());
    return () => {
      canvasElement.removeEventListener('pointermove', onCanvasMove);
      unsubscribe();
    };
  }, [invalidate, canvasElement, progress]);

  const ceramicMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: GLOBE_PALETTE.sphere,
        shininess: 8,
      }),
    []
  );

  useEffect(() => {
    if (!interactive || reduced) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [interactive, reduced]);

  useFrame((_, delta) => {
    const group = rig.current;
    if (!group) {
      return;
    }
    const dt = Math.min(delta, 0.1);
    const ease = 1 - Math.exp(-dt * 2.5);

    // Scroll-linked morph: horizon arc → centered sphere. The scroll
    // position leads, the pose follows with damping (snaps under reduced
    // motion so the layout is never mid-flight without animation frames).
    const targetMorph = morphAmount(progress.get());
    morph.current = reduced
      ? targetMorph
      : morph.current + (targetMorph - morph.current) * ease;
    const t = morph.current;
    group.position.y = POSE_HORIZON.y + (POSE_CENTER.y - POSE_HORIZON.y) * t;
    const scale =
      POSE_HORIZON.scale + (POSE_CENTER.scale - POSE_HORIZON.scale) * t;
    group.scale.setScalar(scale);

    // The continent tour steers the globe: the facing interpolates
    // between stop centroids as a pure function of scroll, so continents
    // morph into each other instead of re-aiming at screen boundaries.
    // Outside the tour range focus is null → free spin at the mood's
    // pace (pausing while a country is hovered so it doesn't slide away).
    const focus = tourFocusAt(progress.get());
    const focusSpin = focus ? THREE.MathUtils.degToRad(-focus.lng) : null;
    const focusTilt = focus
      ? THREE.MathUtils.degToRad(
          THREE.MathUtils.clamp(focus.lat, -35, 35) * 0.7
        )
      : HOME_ROTATION_X;

    if (reduced) {
      if (focusSpin !== null) {
        group.rotation.y = focusSpin;
        group.rotation.x = focusTilt;
        spin.current = focusSpin;
      }
    } else if (focusSpin !== null) {
      spin.current += angleDelta(spin.current, focusSpin) * ease;
      group.rotation.y = spin.current;
      group.rotation.x += (focusTilt - group.rotation.x) * ease;
    } else {
      const hoverHold =
        interactive &&
        (activeIso !== null ||
          performance.now() - lastHoverAt.current < HOVER_LINGER_MS);
      const target = hoverHold ? 0 : SPEED[mood];
      speed.current += (target - speed.current) * ease;
      spin.current += dt * speed.current;
      group.rotation.y = spin.current;

      const targetX = interactive
        ? HOME_ROTATION_X + pointer.current.y * 0.12
        : HOME_ROTATION_X;
      group.rotation.x += (targetX - group.rotation.x) * ease;
    }

    // Screen-project the tour countries for the DOM leader lines. Uses
    // three-globe's polar convention (lng 0 → +z); a point is front-
    // facing while its surface normal leans toward the camera.
    if (markers.length > 0 && onMarkersProject) {
      group.updateMatrixWorld();
      const globeRadius = 101.5;
      const points: ProjectedMarker[] = markers.map((marker) => {
        const phi = THREE.MathUtils.degToRad(90 - marker.lat);
        const theta = THREE.MathUtils.degToRad(90 - marker.lng);
        projectionVector
          .set(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          )
          .multiplyScalar(globeRadius)
          .applyMatrix4(group.matrixWorld);
        const front =
          projectionVector.z - group.position.z >
          globeRadius * group.scale.x * 0.22;
        projectionVector.project(camera);
        return {
          iso: marker.iso,
          x: (projectionVector.x * 0.5 + 0.5) * size.width,
          y: (1 - (projectionVector.y * 0.5 + 0.5)) * size.height,
          front,
        };
      });
      onMarkersProject(points);
    }
  });

  return (
    <group
      ref={rig}
      rotation={[HOME_ROTATION_X, HOME_ROTATION_Y, 0]}
      position={[0, POSE_HORIZON.y, 0]}
      scale={POSE_HORIZON.scale}
    >
      <R3fGlobe
        globeImageUrl={null}
        globeMaterial={ceramicMaterial}
        showAtmosphere
        atmosphereColor={GLOBE_PALETTE.atmosphere}
        atmosphereAltitude={0.12}
        polygonsData={features}
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}
        polygonsTransitionDuration={300}
        onHover={reportCountry}
        onClick={reportCountry}
      />
    </group>
  );
}

/**
 * Memoized: the hero re-renders on every demo keystroke; with stable
 * prop identities this skips the whole three.js tree on those ticks.
 */
export const V3GlobeScene = memo(function V3GlobeScene(
  props: V3GlobeSceneProps
) {
  const reduced = useReducedMotion() ?? false;
  const wrapper = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(true);
  const [features, setFeatures] = useState<object[]>([]);

  // The 480KB country file rides idle time, never the critical path; the
  // bare ceramic sphere renders instantly and polygons fade in later.
  // A fetch failure just leaves the sphere plain.
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetch('/landing-lab/countries-110m.geojson', {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((geojson) => {
          if (geojson?.features) {
            setFeatures(geojson.features);
          }
        })
        .catch(() => {
          /* sphere without polygons is a fine fallback */
        });
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(load, { timeout: 600 });
    } else {
      timeoutId = setTimeout(load, 200);
    }
    return () => {
      controller.abort();
      if (idleId !== undefined) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    const node = wrapper.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '80px' }
    );
    observer.observe(node);
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const animating = !reduced && inView && visible;

  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        fallback={<FallbackBlobsLazy />}
        frameloop={animating ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        camera={{ fov: 42, position: [0, 0, 300] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        {/* Tungsten studio, borrowed from v2 but keyed harder: less
            ambient flattening, stronger warm key so the sphere shades
            like an object instead of a watermark. */}
        <ambientLight intensity={0.62} color="#fdf6e9" />
        <directionalLight
          position={[4, 6, 3]}
          intensity={2.1}
          color="#ffe3b8"
        />
        <directionalLight
          position={[-5, 2, -2]}
          intensity={0.5}
          color="#e8d5b5"
        />
        <Starfield frozen={!animating} />
        <GlobeRig {...props} features={features} reduced={reduced} />
      </Canvas>
    </div>
  );
});

/**
 * Local copy of v1's FallbackBlobs: importing shader-field here would pull
 * its WebGL module into this lazily-split chunk for two gradient divs.
 */
function FallbackBlobsLazy() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#E8D5B5]/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#C9A87C]/10 blur-[100px]" />
    </div>
  );
}
