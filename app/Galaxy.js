"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float, Html, RoundedBox, useGLTF, Text } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import useTvState from "./useTvState";
import useIpodState from "./useIpodState";
import TvScreen from "./TvScreen";
import TvControls from "./TvControls";

/* ───── planet config (orbital motion) ───── */
const PLANETS = [
  { id: "soon1", label: "Number Plates", color: "#555", orbit: { radius: 10, speed: 0.18, inclination: 0.05, phase: 0 } },
  { id: "resume", label: "Resume", color: "#2a4a6a", metallic: false, orbit: { radius: 12, speed: 0.14, inclination: 0.03, phase: 1.25 } },
  { id: "ipod", label: "iPod", color: "#e0e0e0", metallic: true, orbit: { radius: 14.5, speed: 0.11, inclination: -0.04, phase: 2.5 } },
  { id: "tv", label: "TV", color: "#8B5E3C", route: "/tv", metallic: false, orbit: { radius: 17, speed: 0.08, inclination: 0.02, phase: 3.75 } },
  { id: "snowboard", label: "Snowboard", color: "#1a8cff", metallic: false, noOrbitRing: true, orbit: { radius: 22, speed: 0.04, inclination: 0.65, phase: 5.0 } },
];
/* ───── mobile check ───── */
const MOBILE_BREAKPOINT = 700;

/* ───── responsive scale ───── */
const BASE_WIDTH = 1200;
function getScenScale() {
  if (typeof window === "undefined") return 1;
  return THREE.MathUtils.clamp(window.innerWidth / BASE_WIDTH, 0.55, 1.3);
}

/* ───── easing ───── */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ═══════════════════════════════════════════════════════════
   AsteroidText — letters orbiting like an asteroid belt
   ═══════════════════════════════════════════════════════════ */
/* Seeded random for consistent asteroid jitter */
function seededRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function AsteroidBelt({ sceneScale }) {
  const groupRef = useRef();
  const angleRef = useRef(0);
  const introTime = useRef(0);
  const introPhase = useRef("fly"); // "fly" → "settle" → "orbit"
  const { scene: asteroidScene } = useGLTF("/models/asteroids.glb");

  /* Extract individual asteroid meshes from the pack */
  const asteroidMeshes = useMemo(() => {
    const meshes = [];
    asteroidScene.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  }, [asteroidScene]);

  const letters = useMemo(() => {
    const text = "ENRIQUE CHONG";
    const letterSpacing = 1.1;
    const totalWidth = text.length * letterSpacing;
    const startX = -totalWidth / 2 + letterSpacing / 2;

    let meshIdx = 0;
    return text.split("").map((ch, i) => {
      const isSpace = ch === " ";
      const entry = {
        ch,
        x: startX + i * letterSpacing,
        yJitter: (seededRandom(i * 7 + 3) - 0.5) * 0.5,
        zJitter: (seededRandom(i * 13 + 5) - 0.5) * 0.4,
        rotZ: (seededRandom(i * 11 + 1) - 0.5) * 0.25,
        scale: 0.55 + seededRandom(i * 17 + 2) * 0.2,
        asteroidIdx: isSpace ? -1 : meshIdx % asteroidMeshes.length,
        asteroidScale: 0.04 + seededRandom(i * 23 + 7) * 0.03,
        asteroidRotSpeed: 0.3 + seededRandom(i * 19 + 11) * 0.5,
        // Intro fly-in: staggered start from far right
        introDelay: i * 0.08,
      };
      if (!isSpace) meshIdx++;
      return entry;
    });
  }, [asteroidMeshes.length]);

  /* Per-letter refs for individual positioning during intro */
  const letterRefs = useRef([]);
  const asteroidRefs = useRef([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    introTime.current += dt;

    if (introPhase.current === "fly") {
      // Fly-in phase: letters streak across from right to left (2.5s total)
      let allDone = true;
      letterRefs.current.forEach((ref, i) => {
        if (!ref || letters[i].ch === " ") return;
        const l = letters[i];
        const t = Math.max(0, introTime.current - l.introDelay);
        const duration = 2.0;
        const progress = Math.min(t / duration, 1);
        const e = easeInOutCubic(progress);

        // Fly from far right to final grouped position
        const startX = 60 * sceneScale;
        const startY = (seededRandom(i * 31 + 9) - 0.5) * 15;
        const endX = l.x;
        const endY = l.yJitter;
        const endZ = l.zJitter;

        ref.position.x = THREE.MathUtils.lerp(startX, endX, e);
        ref.position.y = THREE.MathUtils.lerp(startY, endY, e);
        ref.position.z = THREE.MathUtils.lerp(-20, endZ, e);

        if (progress < 1) allDone = false;
      });

      // Tumble asteroids during flight
      asteroidRefs.current.forEach((ref, i) => {
        if (!ref) return;
        ref.rotation.x += dt * 2;
        ref.rotation.y += dt * 1.5;
      });

      if (allDone) {
        introPhase.current = "orbit";
      }
    } else {
      // Normal orbit phase
      angleRef.current += 0.05 * dt;
      const a = angleRef.current;
      const rx = 9 * sceneScale;
      const rz = 5 * sceneScale;
      if (groupRef.current) {
        groupRef.current.position.x = rx * Math.cos(a);
        groupRef.current.position.z = rz * Math.sin(a);
        groupRef.current.position.y = 1.5 * Math.sin(a * 0.7);
        groupRef.current.rotation.y = -a + Math.PI / 2;
      }

      // Reset individual letter positions to local offset (parent group handles orbit)
      letterRefs.current.forEach((ref, i) => {
        if (!ref || letters[i].ch === " ") return;
        const l = letters[i];
        ref.position.x = THREE.MathUtils.lerp(ref.position.x, l.x, dt * 3);
        ref.position.y = THREE.MathUtils.lerp(ref.position.y, l.yJitter, dt * 3);
        ref.position.z = THREE.MathUtils.lerp(ref.position.z, l.zJitter, dt * 3);
      });

      // Slow tumble on asteroids
      asteroidRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const l = letters.filter(l => l.ch !== " ")[i];
        if (!l) return;
        ref.rotation.x += l.asteroidRotSpeed * dt * 0.3;
        ref.rotation.y += l.asteroidRotSpeed * dt * 0.2;
      });
    }
  });

  let meshCount = 0;

  return (
    <group ref={groupRef}>
      {letters.map((l, i) => {
        if (l.ch === " ") return null;
        const asteroidMesh = asteroidMeshes[l.asteroidIdx];
        const currentMeshIdx = meshCount++;
        return (
          <group
            key={i}
            ref={(el) => { letterRefs.current[i] = el; }}
            position={[60 * sceneScale, 0, -20]}
          >
            {/* Asteroid rock */}
            {asteroidMesh && (
              <primitive
                ref={(el) => { asteroidRefs.current[currentMeshIdx] = el; }}
                object={asteroidMesh.clone()}
                scale={l.asteroidScale}
                rotation={[seededRandom(i * 41) * Math.PI, seededRandom(i * 43) * Math.PI, 0]}
              />
            )}
            {/* Letter riding the asteroid */}
            <Text
              fontSize={l.scale}
              anchorX="center"
              anchorY="middle"
              position={[0, 0.5, 0]}
              rotation={[0, 0, l.rotZ]}
            >
              {l.ch}
              <meshStandardMaterial
                color="#9a8a7a"
                roughness={0.9}
                metalness={0.15}
                emissive="#332a1a"
                emissiveIntensity={0.2}
              />
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sun — glowing yellow sphere at origin
   ═══════════════════════════════════════════════════════════ */
function Sun() {
  const glowRef = useRef();
  const glowTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,180,1)");
    g.addColorStop(0.3, "rgba(255,220,80,0.6)");
    g.addColorStop(0.6, "rgba(255,180,40,0.2)");
    g.addColorStop(1, "rgba(255,140,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const s = 2.0 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
    glowRef.current.scale.set(s, s, 1);
  });

  return (
    <group>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshBasicMaterial color="#ffee88" />
      </mesh>
      {/* Corona glow sprite */}
      {glowTex && (
        <sprite ref={glowRef} scale={[2.0, 2.0, 1]}>
          <spriteMaterial
            map={glowTex}
            color="#ffdd44"
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
      {/* Warm point light */}
      <pointLight color="#ffdd88" intensity={60} distance={80} decay={2} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   OrbitRing — faint torus showing each planet's orbit path
   ═══════════════════════════════════════════════════════════ */
function OrbitRing({ radius, inclination, planet, onSelect, hoveredPlanetId }) {
  const matRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isHighlighted = hovered || hoveredPlanetId === planet?.id;
  const targetOpacity = isHighlighted ? 0.45 : 0.08;

  // Build the actual orbit path geometry to match planet motion exactly
  const geometry = useMemo(() => {
    const segments = 128;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) * Math.sin(inclination);
      const z = radius * Math.sin(angle) * Math.cos(inclination);
      points.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, true),
      128, 0.025, 6, true
    );
    return geo;
  }, [radius, inclination]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, targetOpacity, Math.min(delta * 8, 1));
  });

  const canClick = planet && !planet.locked;

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        if (!canClick) return;
        e.stopPropagation();
        if (planet.externalUrl) {
          window.open(planet.externalUrl, "_blank");
          return;
        }
        if (onSelect) onSelect(planet);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = canClick ? "pointer" : planet?.locked ? "not-allowed" : "default";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <meshBasicMaterial ref={matRef} color="#ffffff" transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   Generate a soft cloud texture via canvas
   ═══════════════════════════════════════════════════════════ */
function makeCloudTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;

  // Layer several offset radial gradients for an irregular, wispy shape
  const blobs = [
    { x: cx, y: cy, r: size * 0.48 },
    { x: cx * 0.7, y: cy * 0.8, r: size * 0.35 },
    { x: cx * 1.3, y: cy * 0.75, r: size * 0.32 },
    { x: cx * 0.85, y: cy * 1.25, r: size * 0.3 },
    { x: cx * 1.15, y: cy * 1.2, r: size * 0.28 },
  ];

  ctx.globalCompositeOperation = "lighter";
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, "rgba(255,255,255,0.6)");
    g.addColorStop(0.3, "rgba(255,255,255,0.25)");
    g.addColorStop(0.6, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ═══════════════════════════════════════════════════════════
   Nebula Clouds — sprite-based with soft textures
   ═══════════════════════════════════════════════════════════ */
function NebulaClouds() {
  const cloudTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    return makeCloudTexture(256);
  }, []);

  /* Each cloud: position, scale, color, opacity, blend mode.
     "additive" sprites create bright glowing areas where they overlap. */
  const clouds = useMemo(() => [
    /* ── Deep background fills (brighter, larger) ── */
    { pos: [0, 0, -65], s: 140, color: "#2a1888", op: 0.70 },
    { pos: [35, 20, -60], s: 110, color: "#3a28a8", op: 0.55 },
    { pos: [-40, -15, -58], s: 115, color: "#2a1a88", op: 0.55 },
    { pos: [-20, 30, -62], s: 100, color: "#3228a8", op: 0.50 },
    { pos: [25, -25, -55], s: 105, color: "#2a2498", op: 0.50 },

    /* ── Large nebula formations — vibrant purple/blue ── */
    { pos: [-35, 18, -38], s: 65, color: "#8040d8", op: 0.50 },
    { pos: [32, -8, -35], s: 60, color: "#3860e8", op: 0.48 },
    { pos: [-15, -22, -32], s: 58, color: "#6838d0", op: 0.45 },
    { pos: [18, 22, -36], s: 62, color: "#4050e0", op: 0.42 },
    { pos: [0, -5, -30], s: 55, color: "#5838c8", op: 0.40 },
    { pos: [-28, 5, -33], s: 52, color: "#4840d8", op: 0.38 },
    { pos: [38, 12, -34], s: 50, color: "#5848e0", op: 0.35 },

    /* ── Bright magenta/pink highlights (additive, doubled) ── */
    { pos: [-32, 14, -28], s: 40, color: "#e060c8", op: 0.40, add: true },
    { pos: [28, 18, -26], s: 35, color: "#d848f0", op: 0.38, add: true },
    { pos: [12, -20, -24], s: 32, color: "#f058c0", op: 0.35, add: true },
    { pos: [-22, -14, -22], s: 30, color: "#c860f8", op: 0.35, add: true },
    { pos: [38, -5, -30], s: 36, color: "#e068c8", op: 0.30, add: true },
    { pos: [-8, 28, -27], s: 30, color: "#d050e0", op: 0.28, add: true },

    /* ── Bright blue/cyan inner glow (more, brighter) ── */
    { pos: [5, -2, -22], s: 35, color: "#50a0ff", op: 0.30, add: true },
    { pos: [-20, 8, -20], s: 28, color: "#70b0ff", op: 0.26, add: true },
    { pos: [22, 10, -19], s: 25, color: "#60a8ff", op: 0.26, add: true },
    { pos: [0, 15, -21], s: 30, color: "#88ccff", op: 0.22, add: true },
    { pos: [-10, -12, -18], s: 22, color: "#aaddff", op: 0.20, add: true },

    /* ── Hot bright cores — star-forming regions ── */
    { pos: [-30, 12, -24], s: 18, color: "#ffa8ff", op: 0.32, add: true },
    { pos: [25, 14, -22], s: 16, color: "#c0c8ff", op: 0.28, add: true },
    { pos: [8, -16, -18], s: 14, color: "#ffa8dd", op: 0.26, add: true },
    { pos: [-14, 22, -26], s: 16, color: "#d0d8ff", op: 0.24, add: true },
    { pos: [32, -3, -20], s: 12, color: "#ffb8ee", op: 0.22, add: true },
    { pos: [-5, -10, -16], s: 14, color: "#e0e0ff", op: 0.20, add: true },

    /* ── White/cyan bright cores for Astro Bot vibe ── */
    { pos: [-25, 10, -22], s: 10, color: "#ffffff", op: 0.18, add: true },
    { pos: [20, -8, -20], s: 8, color: "#ccffff", op: 0.16, add: true },
    { pos: [5, 20, -24], s: 9, color: "#ffffff", op: 0.14, add: true },

    /* ── Foreground wisps — depth near camera ── */
    { pos: [42, -10, 5], s: 26, color: "#6040d8", op: 0.12 },
    { pos: [-35, 20, 8], s: 24, color: "#c058c8", op: 0.10 },
    { pos: [15, -28, 6], s: 22, color: "#4068e0", op: 0.09 },
    { pos: [-20, -18, 10], s: 20, color: "#7848d0", op: 0.08 },
  ], []);

  if (!cloudTex) return null;

  return (
    <group>
      {clouds.map((c, i) => (
        <sprite key={i} position={c.pos} scale={[c.s, c.s, 1]}>
          <spriteMaterial
            map={cloudTex}
            color={c.color}
            transparent
            opacity={c.op}
            blending={c.add ? THREE.AdditiveBlending : THREE.NormalBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   iPod 3D Model
   ═══════════════════════════════════════════════════════════ */
function IpodModel({ active, ipodState, onBack, viewMode }) {
  const ref = useRef();

  const spinSpeed = useRef(0.3);

  useFrame((_, delta) => {
    if (!ref.current) return;

    if (active) {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.3);
      spinSpeed.current = 0;
      return;
    }

    if (viewMode === "flyto-ipod") {
      spinSpeed.current = 0;
      ref.current.rotation.y += spinSpeed.current * delta;
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.25);
      return;
    }

    if (viewMode === "flyto-galaxy") {
      spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, 0.15, 0.02);
      ref.current.rotation.y += spinSpeed.current * delta;
      return;
    }

    spinSpeed.current = 0.15;
    ref.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={ref}>
      {/* Chrome back shell — full depth */}
      <RoundedBox args={[1.3, 2.1, 0.55]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#d8d8d8" metalness={0.95} roughness={0.08} />
      </RoundedBox>

      {/* White front face plate — sits slightly forward */}
      <RoundedBox args={[1.25, 2.05, 0.15]} radius={0.1} smoothness={4} position={[0, 0, 0.22]}>
        <meshStandardMaterial color="#f0f0f0" metalness={0.1} roughness={0.3} />
      </RoundedBox>

      {/* Screen recess — dark surround */}
      <RoundedBox args={[1.0, 0.75, 0.04]} radius={0.04} smoothness={4} position={[0, 0.42, 0.29]}>
        <meshStandardMaterial color="#222222" roughness={0.9} />
      </RoundedBox>

      {/* LCD screen — inset with glow */}
      <RoundedBox args={[0.88, 0.63, 0.02]} radius={0.03} smoothness={4} position={[0, 0.42, 0.315]}>
        <meshStandardMaterial color="#4a6a7a" emissive="#5a8a9a" emissiveIntensity={0.5} />
      </RoundedBox>

      {/* Screen Html overlay */}
      {active && ipodState && (
        <Html
          position={[0, 0.42, 0.34]}
          transform
          distanceFactor={1.5}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "auto" }}
        >
          <div className="ipod-canvas-screen">
            <div className="screen">
              <div className="status-bar">
                <div className="status">
                  <span className="play-indicator" ref={ipodState.playIndicatorRef}></span>
                </div>
                <span className="status-bar__title" ref={ipodState.screenTitleRef}>Enrique&apos;s iPod</span>
                <span className="battery">
                  <svg width="25" height="12" viewBox="0 0 25 12">
                    <rect x="0" y="0" width="22" height="12" rx="2" fill="none" stroke="#333" strokeWidth="1.5" />
                    <rect x="23" y="3" width="2" height="6" rx="1" fill="#333" />
                    <rect x="2" y="2" width="18" height="8" rx="1" fill="#4CAF50" />
                  </svg>
                </span>
              </div>
              <div className="screen-content" ref={ipodState.screenContentCallback}></div>
            </div>
          </div>
        </Html>
      )}

      {/* Click wheel — raised ring */}
      <mesh position={[0, -0.4, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 48]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.15} roughness={0.35} />
      </mesh>

      {/* Wheel Html overlay */}
      {active && ipodState && (
        <Html
          position={[0, -0.4, 0.34]}
          transform
          distanceFactor={1.5}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "auto" }}
        >
          <div className="ipod-canvas-wheel">
            <div className="wheel" ref={ipodState.wheelCallback}>
              <div className="wheel-btn wheel-btn-menu" onClick={ipodState.goBack}>MENU</div>
              <div className="wheel-btn wheel-btn-next" onClick={ipodState.nextTrack}>
                <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="2,0 14,7 2,14" fill="currentColor" /><rect x="0" y="0" width="2" height="14" fill="currentColor" /></svg>
              </div>
              <div className="wheel-btn wheel-btn-prev" onClick={ipodState.prevTrack}>
                <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="12,0 0,7 12,14" fill="currentColor" /><rect x="12" y="0" width="2" height="14" fill="currentColor" /></svg>
              </div>
              <div className="wheel-btn wheel-btn-play" onClick={ipodState.togglePlay}>
                <svg width="16" height="14" viewBox="0 0 16 14"><polygon points="0,0 10,7 0,14" fill="currentColor" /><rect x="12" y="0" width="2" height="14" fill="currentColor" rx="1" /></svg>
              </div>
              <div className="wheel-center" onClick={ipodState.selectItem}></div>
            </div>
          </div>
        </Html>
      )}


      {/* Center button — hide when active */}
      {!active && (
        <mesh position={[0, -0.4, 0.305]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 32]} />
          <meshStandardMaterial color="#dcdcdc" metalness={0.2} roughness={0.3} />
        </mesh>
      )}

      {/* Top edge detail — headphone jack hint */}
      <mesh position={[0.35, 1.02, 0.1]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Bottom edge — dock connector */}
      <mesh position={[0, -1.04, 0.1]}>
        <boxGeometry args={[0.4, 0.04, 0.18]} />
        <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
      </mesh>

    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   TV 3D Model
   ═══════════════════════════════════════════════════════════ */
function TvModel({ active, tvState, onBack, viewMode }) {
  const ref = useRef();
  const cabinetRef = useRef();
  const frozenRotY = useRef(null);
  const spinSpeed = useRef(0.3);

  useFrame((_, delta) => {
    if (!ref.current) return;

    if (active) {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.3);
      spinSpeed.current = 0;
      return;
    }

    if (viewMode === "flyto-tv") {
      spinSpeed.current = 0;
      ref.current.rotation.y += spinSpeed.current * delta;
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.25);
      return;
    }

    if (viewMode === "flyto-galaxy") {
      spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, 0.15, 0.02);
      ref.current.rotation.y += spinSpeed.current * delta;
      return;
    }

    spinSpeed.current = 0.15;
    ref.current.rotation.y += delta * 0.15;
  });

  // Bulkier cabinet: 3.4 wide × 2.2 tall × 0.9 deep
  return (
    <group ref={ref}>
      {/* ── Main wooden cabinet shell — deep CRT body ── */}
      <RoundedBox ref={cabinetRef} args={[3.4, 2.2, 2.4]} radius={0.12} smoothness={4} position={[0, 0, -0.75]}>
        <meshStandardMaterial color="#5a3a22" roughness={0.85} />
      </RoundedBox>

      {/* Front face — darker inset panel */}
      <RoundedBox args={[3.25, 2.1, 0.06]} radius={0.08} smoothness={4} position={[0, 0, 0.43]}>
        <meshStandardMaterial color="#4e2f18" roughness={0.8} />
      </RoundedBox>

      {/* ── Speaker grille — left side ── */}
      <RoundedBox args={[0.55, 1.6, 0.04]} radius={0.03} smoothness={2} position={[-1.35, 0, 0.46]}>
        <meshStandardMaterial color="#3a2211" roughness={0.9} />
      </RoundedBox>
      {/* Speaker slots */}
      {[-0.55, -0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.5].map((y, i) => (
        <mesh key={`spk${i}`} position={[-1.35, y, 0.485]}>
          <boxGeometry args={[0.38, 0.04, 0.01]} />
          <meshStandardMaterial color="#2a1808" roughness={0.95} />
        </mesh>
      ))}

      {/* ── Screen bezel — center, 16:9-ish ── */}
      <RoundedBox args={[1.9, 1.2, 0.1]} radius={0.06} smoothness={4} position={[-0.1, 0.05, 0.47]}>
        <meshStandardMaterial color="#1a1209" roughness={0.9} />
      </RoundedBox>


      {/* Screen reflection glare — only in orbit */}
      {!active && !tvState && (
        <mesh position={[-0.45, 0.15, 0.52]} rotation={[0, 0, 0.3]}>
          <planeGeometry args={[0.05, 0.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
        </mesh>
      )}

      {/* ── Screen overlay — always mounted so video streams while orbiting ── */}
      {tvState && (
        <Html
          position={[-0.1, 0.05, 0.53]}
          transform
          distanceFactor={1.5}
          occlude={[cabinetRef]}
          style={{ pointerEvents: active ? "auto" : "none" }}
        >
          <div className="tv-canvas-screen">
            <TvScreen
              channel={tvState.channel}
              isOn={tvState.isOn}
              hue={tvState.hue}
              brightness={tvState.brightness}
              showStatic={tvState.showStatic}
              powerAnim={tvState.powerAnim}
            />
          </div>
        </Html>
      )}

      {/* ── Control panel — right side ── */}
      <RoundedBox args={[0.65, 1.6, 0.06]} radius={0.04} smoothness={2} position={[1.3, 0, 0.46]}>
        <meshStandardMaterial color="#2a1a0c" roughness={0.8} />
      </RoundedBox>

      {/* 3D control decorations — hide when active */}
      {!active && (
        <>
          {/* Power button */}
          <mesh position={[1.3, 0.6, 0.50]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          {/* Power LED dot */}
          <mesh position={[1.3, 0.6, 0.535]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={0.8} />
          </mesh>

          {/* "CHANNEL" label area */}
          <mesh position={[1.3, 0.4, 0.48]}>
            <boxGeometry args={[0.42, 0.04, 0.01]} />
            <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
          </mesh>

          {/* Channel buttons — 6 buttons in 2 columns */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <RoundedBox
              key={`ch${i}`}
              args={[0.13, 0.13, 0.04]}
              radius={0.02}
              smoothness={2}
              position={[
                1.2 + (i % 2) * 0.2,
                0.22 - Math.floor(i / 2) * 0.19,
                0.49
              ]}
            >
              <meshStandardMaterial color="#1a1208" roughness={0.7} metalness={0.1} />
            </RoundedBox>
          ))}

          {/* Volume slider track */}
          <mesh position={[1.27, -0.35, 0.48]}>
            <boxGeometry args={[0.04, 0.42, 0.02]} />
            <meshStandardMaterial color="#111111" roughness={0.8} />
          </mesh>
          {/* Volume slider knob */}
          <mesh position={[1.27, -0.3, 0.50]}>
            <boxGeometry args={[0.1, 0.06, 0.03]} />
            <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.3} />
          </mesh>

          {/* Hue slider track */}
          <mesh position={[1.41, -0.35, 0.48]}>
            <boxGeometry args={[0.04, 0.42, 0.02]} />
            <meshStandardMaterial color="#111111" roughness={0.8} />
          </mesh>
          {/* Hue slider knob */}
          <mesh position={[1.41, -0.4, 0.50]}>
            <boxGeometry args={[0.1, 0.06, 0.03]} />
            <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.3} />
          </mesh>
        </>
      )}

      {/* ── Interactive control panel overlay (when active) ── */}
      {active && tvState && (
        <Html
          position={[1.3, 0, 0.50]}
          transform
          distanceFactor={1.5}
          occlude={[cabinetRef]}
          style={{ pointerEvents: "auto" }}
        >
          <div className="tv-canvas-controls">
            <TvControls
              channel={tvState.channel}
              isOn={tvState.isOn}
              hue={tvState.hue}
              setHue={tvState.setHue}
              brightness={tvState.brightness}
              setBrightness={tvState.setBrightness}
              volume={tvState.volume}
              setVolume={tvState.setVolume}
              changeChannel={tvState.changeChannel}
              togglePower={tvState.togglePower}
            />
          </div>
        </Html>
      )}

      {/* Back button removed — using DOM-level button instead */}

      {/* ── Feet — wider and deeper to match CRT body ── */}
      <mesh position={[-1.0, -1.2, -0.65]}>
        <boxGeometry args={[0.5, 0.14, 2.0]} />
        <meshStandardMaterial color="#3d2410" roughness={0.85} />
      </mesh>
      <mesh position={[1.0, -1.2, -0.65]}>
        <boxGeometry args={[0.5, 0.14, 2.0]} />
        <meshStandardMaterial color="#3d2410" roughness={0.85} />
      </mesh>

      {/* ── Back panel ── */}
      <RoundedBox args={[3.2, 2.0, 0.04]} radius={0.03} smoothness={2} position={[0, 0, -1.92]}>
        <meshStandardMaterial color="#3a2515" roughness={0.9} />
      </RoundedBox>

      {/* Back vents */}
      {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
        <mesh key={`vent${i}`} position={[x, 0.4, -1.95]}>
          <boxGeometry args={[0.25, 0.03, 0.01]} />
          <meshStandardMaterial color="#1a1008" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Resume 3D Model — framed document
   ═══════════════════════════════════════════════════════════ */
function ResumeModel({ active, onBack, viewMode }) {
  const ref = useRef();
  const frameRef = useRef();
  const spinSpeed = useRef(0.3);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (active) {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.3);
      spinSpeed.current = 0;
      return;
    }
    if (viewMode === "flyto-resume") {
      spinSpeed.current = 0;
      ref.current.rotation.y += spinSpeed.current * delta;
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.25);
      return;
    }
    if (viewMode === "flyto-galaxy") {
      spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, 0.15, 0.02);
      ref.current.rotation.y += spinSpeed.current * delta;
      return;
    }
    spinSpeed.current = 0.15;
    ref.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={ref}>
      {/* Thick paper block — gives the document physical depth */}
      <RoundedBox ref={frameRef} args={[2.5, 3.2, 0.08]} radius={0.03} smoothness={4}>
        <meshStandardMaterial color="#f8f6f0" roughness={0.9} />
      </RoundedBox>

      {/* Subtle edge shadow line on top face */}
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[2.45, 3.15]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>

      {/* Resume content — only render HTML when active to prevent z-index overlap */}
      {active && <Html
        position={[0, 0, 0.05]}
        transform
        distanceFactor={1.5}
        occlude={[frameRef]}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: active ? "auto" : "none" }}
      >
        <div style={{
          width: "560px",
          height: "720px",
          overflow: active ? "auto" : "hidden",
          padding: "40px 48px",
          fontFamily: "'Georgia', serif",
          fontSize: "13px",
          lineHeight: "1.55",
          color: "#1a1a2e",
          background: "transparent",
          boxSizing: "border-box",
          userSelect: active ? "text" : "none",
        }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "bold", letterSpacing: "2.5px", textAlign: "center" }}>ENRIQUE CHONG</h2>
          <p style={{ margin: "0 0 14px", fontSize: "11px", textAlign: "center", color: "#555" }}>
            echong112@gmail.com &bull; +1-646-203-3814 &bull; New York
          </p>

          <p style={{ margin: "0 0 12px", fontSize: "12px", fontStyle: "italic", textAlign: "center", color: "#333" }}>
            Lead AI Engineer &mdash; 8 years of full-stack engineering experience specializing in AI/LLM-powered applications, agentic system design, and scalable cloud architecture.
          </p>

          <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "12px 0" }} />

          <h3 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Technical Expertise</h3>
          <p style={{ margin: "0 0 4px" }}><strong>AI/ML:</strong> LLM APIs (OpenAI, Anthropic, Gemini), Prompt Engineering, RAG Pipelines, Multi-Agent Orchestration</p>
          <p style={{ margin: "0 0 4px" }}><strong>Languages:</strong> TypeScript, JavaScript, Python, SQL</p>
          <p style={{ margin: "0 0 4px" }}><strong>Frameworks:</strong> Next.js, React, Express.js, Node.js</p>
          <p style={{ margin: "0 0 12px" }}><strong>Cloud:</strong> AWS (Lambda, S3, SQS, Bedrock), Google Cloud, Azure, Docker, Terraform</p>

          <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "12px 0" }} />

          <h3 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Experience</h3>
          <p style={{ margin: "0 0 3px" }}><strong>Lead AI Engineer</strong> &mdash; Code and Theory <span style={{ float: "right", fontSize: "11px", color: "#777" }}>02/2025 &ndash; Present</span></p>
          <p style={{ margin: "0 0 12px" }}>Built and shipped &lsquo;Mini Machine,&rsquo; a custom Figma plugin leveraging LLM APIs and asset-based logic.</p>

          <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "12px 0" }} />

          <h3 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Achievements</h3>
          <p style={{ margin: "0 0 5px" }}>&bull; Delivered an AI-powered news platform with Arabic translation in one week for ADIA</p>
          <p style={{ margin: "0 0 5px" }}>&bull; Increased cross-sell revenue by 15% at Walmart through product carousel features</p>
          <p style={{ margin: "0 0 5px" }}>&bull; Improved deployment times by 100% through CI/CD automation at WarnerMedia</p>

          <hr style={{ border: "none", borderTop: "1px solid #ccc", margin: "12px 0" }} />
          <p style={{ margin: 0, fontSize: "11px", textAlign: "center", color: "#777" }}>
            linkedin.com/in/enrique-c-538669101 &bull; github.com/echong112
          </p>

          {active && (
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
              <button
                className="tv-back-btn"
                onClick={() => window.open("https://docs.google.com/document/d/1IfT5WiR6jMDkkhGa14Wf84mP3PCdo_dE9dJb8AJ5pXc/edit?tab=t.0", "_blank")}
              >
                Open Doc &rarr;
              </button>
            </div>
          )}
        </div>
      </Html>}

      {/* Back button removed — using DOM-level button instead */}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Snowboard 3D Model
   ═══════════════════════════════════════════════════════════ */
function SnowboardModel({ active, viewMode }) {
  const ref = useRef();
  const boardRef = useRef();
  const spinSpeed = useRef(0.4);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (active) {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.3);
      spinSpeed.current = 0;
      return;
    }
    if (viewMode === "flyto-snowboard") {
      spinSpeed.current = 0;
      ref.current.rotation.y += spinSpeed.current * delta;
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.25);
      return;
    }
    if (viewMode === "flyto-galaxy") {
      spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, 0.15, 0.02);
      ref.current.rotation.y += spinSpeed.current * delta;
      return;
    }
    spinSpeed.current = 0.15;
    ref.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={ref} rotation={[0.3, 0, 0.15]}>
      {/* Board — long rounded shape */}
      <mesh ref={boardRef}>
        <boxGeometry args={[0.45, 2.8, 0.08]} />
        <meshStandardMaterial color="#1a8cff" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Top sheet graphic stripe */}
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[0.3, 2.0, 0.005]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>

      {/* Nose curve */}
      <mesh position={[0, 1.35, 0.06]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.44, 0.2, 0.06]} />
        <meshStandardMaterial color="#1a8cff" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Tail curve */}
      <mesh position={[0, -1.35, 0.06]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.44, 0.2, 0.06]} />
        <meshStandardMaterial color="#1a8cff" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Base — dark */}
      <mesh position={[0, 0, -0.045]}>
        <boxGeometry args={[0.44, 2.75, 0.005]} />
        <meshStandardMaterial color="#111111" roughness={0.5} />
      </mesh>

      {/* Front binding */}
      <group position={[0, 0.45, 0.08]}>
        <mesh>
          <boxGeometry args={[0.38, 0.3, 0.04]} />
          <meshStandardMaterial color="#222" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.32, 0.08, 0.03]} />
          <meshStandardMaterial color="#ff4444" roughness={0.4} />
        </mesh>
      </group>

      {/* Rear binding */}
      <group position={[0, -0.45, 0.08]}>
        <mesh>
          <boxGeometry args={[0.38, 0.3, 0.04]} />
          <meshStandardMaterial color="#222" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.32, 0.08, 0.03]} />
          <meshStandardMaterial color="#ff4444" roughness={0.4} />
        </mesh>
      </group>

      {/* Metal edges */}
      <mesh position={[0.225, 0, -0.02]}>
        <boxGeometry args={[0.01, 2.7, 0.04]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.225, 0, -0.02]}>
        <boxGeometry args={[0.01, 2.7, 0.04]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Embedded YouTube video — only when zoomed in */}
      {active && (
        <Html
          position={[0, 0, 0.06]}
          transform
          distanceFactor={1.5}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "auto" }}
        >
          <div style={{
            width: "560px",
            height: "315px",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 0 30px rgba(26, 140, 255, 0.6)",
          }}>
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/mmnwUgfNTsU?autoplay=1&mute=1&loop=1&playlist=mmnwUgfNTsU&controls=1&rel=0&modestbranding=1"
              title="Snowboard Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          </div>
        </Html>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Astronaut — low-poly figure from smooth primitives
   ═══════════════════════════════════════════════════════════ */
function Astronaut({ position, rotation }) {
  return (
    <group position={position} rotation={rotation} scale={[0.2, 0.2, 0.2]}>
      {/* Helmet */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 2.0, 0.35]}>
        <sphereGeometry args={[0.38, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1a3355" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Visor reflection */}
      <mesh position={[-0.1, 2.08, 0.45]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#88bbff" transparent opacity={0.4} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.4, 0.7, 8, 16]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.4} />
      </mesh>
      {/* Chest pack */}
      <mesh position={[0, 1.15, 0.3]}>
        <boxGeometry args={[0.5, 0.35, 0.12]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Backpack */}
      <mesh position={[0, 1.1, -0.4]}>
        <boxGeometry args={[0.55, 0.7, 0.3]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.55, 1.1, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.15, 0.7, 6, 12]} />
        <meshStandardMaterial color="#dcdcdc" roughness={0.4} />
      </mesh>
      {/* Left glove */}
      <mesh position={[-0.65, 0.55, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#bbbbbb" roughness={0.5} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.55, 1.1, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.15, 0.7, 6, 12]} />
        <meshStandardMaterial color="#dcdcdc" roughness={0.4} />
      </mesh>
      {/* Right glove */}
      <mesh position={[0.65, 0.55, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#bbbbbb" roughness={0.5} />
      </mesh>

      {/* Left leg */}
      <mesh position={[-0.2, 0.05, 0]}>
        <capsuleGeometry args={[0.16, 0.55, 6, 12]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.4} />
      </mesh>
      {/* Left boot */}
      <mesh position={[-0.2, -0.4, 0.06]}>
        <boxGeometry args={[0.22, 0.2, 0.35]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Right leg */}
      <mesh position={[0.2, 0.05, 0]}>
        <capsuleGeometry args={[0.16, 0.55, 6, 12]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.4} />
      </mesh>
      {/* Right boot */}
      <mesh position={[0.2, -0.4, 0.06]}>
        <boxGeometry args={[0.22, 0.2, 0.35]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Number Plates GLB Model
   ═══════════════════════════════════════════════════════════ */
function NumberPlatesModel({ viewMode, active }) {
  const ref = useRef();
  const { scene } = useGLTF("/assets/number_plates.glb");
  const spinSpeed = useRef(0.3);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (viewMode === "soon1") {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.3);
      spinSpeed.current = 0;
      return;
    }
    if (viewMode === "flyto-soon1") {
      spinSpeed.current = 0;
      ref.current.rotation.y += spinSpeed.current * delta;
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.25);
      return;
    }
    if (viewMode === "flyto-galaxy") {
      spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, 0.15, 0.02);
      ref.current.rotation.y += spinSpeed.current * delta;
      return;
    }
    spinSpeed.current = 0.15;
    ref.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={ref} scale={[1.8, 1.8, 1.8]}>
      <primitive object={scene} />
      {active && (
        <Html
          position={[0, 0.2, 0.5]}
          transform
          distanceFactor={1.5}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "auto" }}
        >
          <div style={{
            width: "280px",
            height: "158px",
            overflow: "hidden",
            borderRadius: "6px",
          }}>
            <iframe
              width="280"
              height="158"
              src="https://www.youtube.com/embed/75NjeNWWQ38?autoplay=1&mute=1&loop=1&playlist=75NjeNWWQ38&controls=1&rel=0&modestbranding=1"
              title="Number Plates Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          </div>
        </Html>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Planet
   ═══════════════════════════════════════════════════════════ */
function Planet({ planet, onSelect, viewMode, focusedId, tvState, ipodState, onBack, frozen, planetPositionsRef, sceneScale, onHover }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef(null);
  const visualScale = useRef(1);
  const angleRef = useRef(planet.orbit.phase);

  const isTv = planet.id === "tv";
  const isIpod = planet.id === "ipod";
  const isResume = planet.id === "resume";
  const isSnowboard = planet.id === "snowboard";
  const isSoon1 = planet.id === "soon1";
  const tvActive = isTv && viewMode === "tv";
  const ipodActive = isIpod && viewMode === "ipod";
  const resumeActive = isResume && viewMode === "resume";
  const snowboardActive = isSnowboard && viewMode === "snowboard";
  const soon1Active = isSoon1 && viewMode === "soon1";
  const isActive = tvActive || ipodActive || resumeActive || snowboardActive || soon1Active;
  const isTransitioning = viewMode.startsWith("flyto-");

  // Compute initial position from orbit params to avoid flash
  const initialPos = useMemo(() => {
    const { radius, inclination, phase } = planet.orbit;
    const r = radius * sceneScale;
    return [
      r * Math.cos(phase),
      r * Math.sin(phase) * Math.sin(inclination),
      r * Math.sin(phase) * Math.cos(inclination),
    ];
  }, [planet.orbit, sceneScale]);

  // Write initial position to shared ref
  useMemo(() => {
    if (planetPositionsRef?.current?.[planet.id]) {
      planetPositionsRef.current[planet.id].set(initialPos[0], initialPos[1], initialPos[2]);
    }
  }, [planetPositionsRef, planet.id, initialPos]);

  // Orbital motion — must be above early return so hook count is stable
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const { radius, speed, inclination } = planet.orbit;
    const r = radius * sceneScale;

    if (!frozen) {
      angleRef.current += speed * delta;
    }

    const angle = angleRef.current;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle) * Math.sin(inclination);
    const z = r * Math.sin(angle) * Math.cos(inclination);

    groupRef.current.position.set(x, y, z);

    if (planetPositionsRef?.current?.[planet.id]) {
      planetPositionsRef.current[planet.id].set(x, y, z);
    }
  });

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (planet.externalUrl) {
        window.open(planet.externalUrl, "_blank");
        return;
      }
      if (!planet.locked) onSelect(planet);
    },
    [planet, onSelect]
  );

  // Clear hover when entering any transition to prevent stale state
  useEffect(() => {
    if (isTransitioning || isActive) {
      clearTimeout(hoverTimer.current);
      setHovered(false);
      onHover?.(null);
      document.body.style.cursor = "auto";
    }
  }, [isTransitioning, isActive, onHover]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Smooth scale lerp to avoid flicker — must be above early return
  const scaleGroupRef = useRef();
  const targetScale = hovered && !isActive && !isTransitioning ? 1.15 : 1;
  useFrame((_, delta) => {
    if (!scaleGroupRef.current) return;
    visualScale.current = THREE.MathUtils.lerp(visualScale.current, targetScale, Math.min(delta * 8, 1));
    const s = visualScale.current;
    scaleGroupRef.current.scale.set(s, s, s);
  });

  // Hide planets that aren't the focused one during zoom modes
  if (focusedId && planet.id !== focusedId) {
    return <group ref={groupRef} />;
  }
  const isModel = isIpod || isTv || isResume || isSnowboard || isSoon1;
  const labelY = isModel ? 2.5 : 1.8;

  // Disable pointer events during fly animations and active mode
  const pointerEvents = (isActive || isTransitioning) ? {} : {
    onClick: handleClick,
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = planet.locked ? "not-allowed" : "pointer";
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        setHovered(true);
        onHover?.(planet.id);
      }, 120);
    },
    onPointerOut: (e) => {
      e.stopPropagation();
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        setHovered(false);
        onHover?.(null);
        document.body.style.cursor = "auto";
      }, 80);
    },
  };

  // Disable Float during active mode and all transitions
  const disableFloat = isActive || isTransitioning;

  return (
    <group ref={groupRef} position={initialPos}>
      <Float speed={disableFloat ? 0 : 1.5} rotationIntensity={disableFloat ? 0 : 0.3} floatIntensity={disableFloat ? 0 : 0.4}>
        <group ref={scaleGroupRef}>
          {isIpod ? (
            <group {...pointerEvents}>
              {!ipodActive && (
                <mesh ref={meshRef} visible={false}>
                  <boxGeometry args={[1.4, 2.2, 0.5]} />
                  <meshBasicMaterial />
                </mesh>
              )}
              <IpodModel active={ipodActive} ipodState={ipodState} onBack={onBack} viewMode={viewMode} />
            </group>
          ) : isTv ? (
            <group {...pointerEvents}>
              {!tvActive && (
                <mesh ref={meshRef} visible={false}>
                  <boxGeometry args={[3.6, 2.4, 1.0]} />
                  <meshBasicMaterial />
                </mesh>
              )}
              <TvModel active={tvActive} tvState={tvState} onBack={onBack} viewMode={viewMode} />
            </group>
          ) : isResume ? (
            <group {...pointerEvents}>
              {!resumeActive && (
                <mesh ref={meshRef} visible={false}>
                  <boxGeometry args={[2.6, 3.3, 0.2]} />
                  <meshBasicMaterial />
                </mesh>
              )}
              <ResumeModel active={resumeActive} onBack={onBack} viewMode={viewMode} />
            </group>
          ) : isSnowboard ? (
            <group {...pointerEvents}>
              {!snowboardActive && (
                <mesh ref={meshRef} visible={false}>
                  <boxGeometry args={[0.8, 3.2, 0.5]} />
                  <meshBasicMaterial />
                </mesh>
              )}
              <SnowboardModel active={snowboardActive} viewMode={viewMode} />
            </group>
          ) : isSoon1 ? (
            <group {...pointerEvents}>
              <mesh ref={meshRef} visible={false}>
                <boxGeometry args={[3.6, 3.6, 3.6]} />
                <meshBasicMaterial />
              </mesh>
              <NumberPlatesModel viewMode={viewMode} active={soon1Active} />
              {/* Back button removed — using DOM-level button instead */}
            </group>
          ) : (
            <>
              <mesh
                ref={meshRef}
                {...pointerEvents}
              >
                <sphereGeometry args={[1, 32, 32]} />
                {planet.locked ? (
                  <meshStandardMaterial
                    color={planet.color}
                    wireframe
                    transparent
                    opacity={0.6}
                  />
                ) : planet.metallic ? (
                  <meshStandardMaterial
                    color={planet.color}
                    metalness={0.85}
                    roughness={0.15}
                  />
                ) : (
                  <meshStandardMaterial color={planet.color} roughness={0.6} />
                )}
              </mesh>

              {/* locked ring */}
              {planet.locked && (
                <mesh rotation={[Math.PI / 3, 0, 0]}>
                  <torusGeometry args={[1.5, 0.06, 16, 64]} />
                  <meshBasicMaterial color="#e8d44d" transparent opacity={0.7} />
                </mesh>
              )}
            </>
          )}

        </group>
      </Float>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Camera Controller
   ═══════════════════════════════════════════════════════════ */
function CameraController({ viewMode, onArrived, planetPositionsRef, sceneScale }) {
  const { camera } = useThree();
  const phase = useRef("entry");
  const time = useRef(0);
  const baseZ = 25 * sceneScale;
  const zDist = useRef(baseZ);
  const targetZ = useRef(baseZ);
  const entryStart = useRef(new THREE.Vector3(0, 5, 45 * sceneScale));
  const savedCamPos = useRef(new THREE.Vector3(0, 0, baseZ));
  const flyStartPos = useRef(new THREE.Vector3());
  const flyStartLook = useRef(new THREE.Vector3());
  const flyTargetPos = useRef(new THREE.Vector3());
  const _lookTarget = useRef(new THREE.Vector3());

  /* ── Drag-to-pan state ── */
  const panOffset = useRef({ x: 0, y: 0 });
  const panTarget = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panAtDragStart = useRef({ x: 0, y: 0 });

  /* ── Pinch-to-zoom state ── */
  const lastPinchDist = useRef(0);
  const isTouching = useRef(0);

  /* Smooth scroll zoom + pinch zoom in idle */
  useEffect(() => {
    const onWheel = (e) => {
      if (phase.current !== "idle") return;
      targetZ.current = THREE.MathUtils.clamp(
        targetZ.current + e.deltaY * 0.02,
        12 * sceneScale,
        45 * sceneScale
      );
    };

    const onPointerDown = (e) => {
      if (phase.current !== "idle") return;
      // Only left-click drag (not touch — touch uses touchstart)
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      panAtDragStart.current = { x: panTarget.current.x, y: panTarget.current.y };
    };

    const onPointerMove = (e) => {
      if (e.pointerType === "touch") return;
      if (!isDragging.current) return;
      const dx = (e.clientX - dragStart.current.x) * 0.04;
      const dy = (e.clientY - dragStart.current.y) * 0.04;
      const limit = 20 * sceneScale;
      panTarget.current.x = THREE.MathUtils.clamp(panAtDragStart.current.x - dx, -limit, limit);
      panTarget.current.y = THREE.MathUtils.clamp(panAtDragStart.current.y + dy, -limit, limit);
    };

    const onPointerUp = (e) => {
      if (e.pointerType === "touch") return;
      isDragging.current = false;
    };

    /* ── Touch handlers for pinch-zoom & one-finger pan ── */
    const getTouchDist = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e) => {
      isTouching.current = e.touches.length;
      if (phase.current !== "idle") return;

      if (e.touches.length === 2) {
        // Start pinch
        lastPinchDist.current = getTouchDist(e.touches[0], e.touches[1]);
        isDragging.current = false; // cancel any pan
      } else if (e.touches.length === 1) {
        // One-finger pan
        isDragging.current = true;
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panAtDragStart.current = { x: panTarget.current.x, y: panTarget.current.y };
      }
    };

    const onTouchMove = (e) => {
      if (phase.current !== "idle") return;

      if (e.touches.length === 2) {
        // Pinch zoom
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        if (lastPinchDist.current > 0) {
          const delta = lastPinchDist.current - dist;
          targetZ.current = THREE.MathUtils.clamp(
            targetZ.current + delta * 0.08,
            15 * sceneScale,
            60 * sceneScale
          );
        }
        lastPinchDist.current = dist;
        isDragging.current = false;
      } else if (e.touches.length === 1 && isDragging.current) {
        // One-finger pan
        const dx = (e.touches[0].clientX - dragStart.current.x) * 0.04;
        const dy = (e.touches[0].clientY - dragStart.current.y) * 0.04;
        const limit = 20 * sceneScale;
        panTarget.current.x = THREE.MathUtils.clamp(panAtDragStart.current.x - dx, -limit, limit);
        panTarget.current.y = THREE.MathUtils.clamp(panAtDragStart.current.y + dy, -limit, limit);
      }
    };

    const onTouchEnd = (e) => {
      isTouching.current = e.touches.length;
      if (e.touches.length < 2) {
        lastPinchDist.current = 0;
      }
      if (e.touches.length === 0) {
        isDragging.current = false;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [sceneScale]);

  /* viewMode transitions */
  useEffect(() => {
    if (viewMode === "flyto-tv") {
      const pos = planetPositionsRef.current.tv;
      flyTargetPos.current.copy(pos);
      savedCamPos.current.copy(camera.position);
      flyStartPos.current.copy(camera.position);
      flyStartLook.current.set(panOffset.current.x, panOffset.current.y, 0);
      phase.current = "flyto-tv";
      time.current = 0;
    } else if (viewMode === "tv") {
      phase.current = "tv-view";
    } else if (viewMode === "flyto-ipod") {
      const pos = planetPositionsRef.current.ipod;
      flyTargetPos.current.copy(pos);
      savedCamPos.current.copy(camera.position);
      flyStartPos.current.copy(camera.position);
      flyStartLook.current.set(panOffset.current.x, panOffset.current.y, 0);
      phase.current = "flyto-ipod";
      time.current = 0;
    } else if (viewMode === "ipod") {
      phase.current = "ipod-view";
    } else if (viewMode === "flyto-soon1") {
      const pos = planetPositionsRef.current.soon1;
      if (!pos) return;
      flyTargetPos.current.copy(pos);
      savedCamPos.current.copy(camera.position);
      flyStartPos.current.copy(camera.position);
      flyStartLook.current.set(panOffset.current.x, panOffset.current.y, 0);
      phase.current = "flyto-soon1";
      time.current = 0;
    } else if (viewMode === "soon1") {
      phase.current = "soon1-view";
    } else if (viewMode === "flyto-snowboard") {
      const pos = planetPositionsRef.current.snowboard;
      if (!pos) return;
      flyTargetPos.current.copy(pos);
      savedCamPos.current.copy(camera.position);
      flyStartPos.current.copy(camera.position);
      flyStartLook.current.set(panOffset.current.x, panOffset.current.y, 0);
      phase.current = "flyto-snowboard";
      time.current = 0;
    } else if (viewMode === "snowboard") {
      phase.current = "snowboard-view";
    } else if (viewMode === "flyto-resume") {
      const pos = planetPositionsRef.current.resume;
      if (!pos) return;
      flyTargetPos.current.copy(pos);
      savedCamPos.current.copy(camera.position);
      flyStartPos.current.copy(camera.position);
      flyStartLook.current.set(panOffset.current.x, panOffset.current.y, 0);
      phase.current = "flyto-resume";
      time.current = 0;
    } else if (viewMode === "resume") {
      phase.current = "resume-view";
    } else if (viewMode === "flyto-galaxy") {
      flyStartPos.current.copy(camera.position);
      // Determine lookAt start based on which view we're returning from
      if (phase.current === "tv-view") {
        const pos = planetPositionsRef.current.tv;
        flyTargetPos.current.copy(pos);
        flyStartLook.current.set(pos.x - 0.15, pos.y, pos.z);
      } else if (phase.current === "ipod-view") {
        const pos = planetPositionsRef.current.ipod;
        flyTargetPos.current.copy(pos);
        flyStartLook.current.set(pos.x, pos.y, pos.z);
      } else if (phase.current === "resume-view") {
        const pos = planetPositionsRef.current.resume;
        if (pos) {
          flyTargetPos.current.copy(pos);
          flyStartLook.current.set(pos.x, pos.y, pos.z);
        }
      } else if (phase.current === "snowboard-view") {
        const pos = planetPositionsRef.current.snowboard;
        if (pos) {
          flyTargetPos.current.copy(pos);
          flyStartLook.current.set(pos.x, pos.y, pos.z);
        }
      } else if (phase.current === "soon1-view") {
        const pos = planetPositionsRef.current.soon1;
        if (pos) {
          flyTargetPos.current.copy(pos);
          flyStartLook.current.set(pos.x, pos.y, pos.z);
        }
      }
      phase.current = "return-to-galaxy";
      time.current = 0;
    } else if (viewMode === "galaxy" && phase.current === "return-to-galaxy") {
      phase.current = "idle";
      time.current = 0;
    }
  }, [viewMode, camera, planetPositionsRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const tp = flyTargetPos.current;

    if (phase.current === "entry") {
      time.current += dt;
      const progress = Math.min(time.current / 3.0, 1);
      const e = easeInOutCubic(progress);
      camera.position.x = THREE.MathUtils.lerp(entryStart.current.x, 0, e);
      camera.position.y = THREE.MathUtils.lerp(entryStart.current.y, 0, e);
      camera.position.z = THREE.MathUtils.lerp(entryStart.current.z, baseZ, e);
      camera.lookAt(0, 0, 0);
      if (progress >= 1) {
        phase.current = "idle";
        time.current = 0;
      }
    } else if (phase.current === "idle") {
      zDist.current = THREE.MathUtils.lerp(zDist.current, targetZ.current, dt * 3);
      panOffset.current.x = THREE.MathUtils.lerp(panOffset.current.x, panTarget.current.x, dt * 5);
      panOffset.current.y = THREE.MathUtils.lerp(panOffset.current.y, panTarget.current.y, dt * 5);
      camera.position.set(panOffset.current.x, panOffset.current.y, zDist.current);
      camera.lookAt(panOffset.current.x, panOffset.current.y, 0);
    } else if (phase.current === "flyto-tv") {
      time.current += dt;
      const duration = 2.8;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalX = tp.x - 0.15;
      const goalY = tp.y;
      const goalZ = tp.z + 4.0;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, goalX, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, goalY, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, tp.x - 0.15, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, tp.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, tp.z, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        onArrived();
      }
    } else if (phase.current === "tv-view") {
      camera.position.set(tp.x - 0.15, tp.y, tp.z + 4.0);
      camera.lookAt(tp.x - 0.15, tp.y, tp.z);
    } else if (phase.current === "flyto-ipod") {
      time.current += dt;
      const duration = 2.8;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalX = tp.x;
      const goalY = tp.y;
      const goalZ = tp.z + 3.0;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, goalX, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, goalY, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, tp.x, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, tp.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, tp.z, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        onArrived();
      }
    } else if (phase.current === "ipod-view") {
      camera.position.set(tp.x, tp.y, tp.z + 3.0);
      camera.lookAt(tp.x, tp.y, tp.z);
    } else if (phase.current === "flyto-resume") {
      time.current += dt;
      const duration = 2.8;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalX = tp.x;
      const goalY = tp.y;
      const goalZ = tp.z + 3.5;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, goalX, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, goalY, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, tp.x, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, tp.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, tp.z, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        onArrived();
      }
    } else if (phase.current === "resume-view") {
      camera.position.set(tp.x, tp.y, tp.z + 3.5);
      camera.lookAt(tp.x, tp.y, tp.z);
    } else if (phase.current === "flyto-snowboard") {
      time.current += dt;
      const duration = 2.8;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalX = tp.x;
      const goalY = tp.y;
      const goalZ = tp.z + 5.0;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, goalX, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, goalY, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, tp.x, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, tp.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, tp.z, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        onArrived();
      }
    } else if (phase.current === "snowboard-view") {
      camera.position.set(tp.x, tp.y, tp.z + 5.0);
      camera.lookAt(tp.x, tp.y, tp.z);
    } else if (phase.current === "flyto-soon1") {
      time.current += dt;
      const duration = 2.8;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalX = tp.x;
      const goalY = tp.y + 0.5;
      const goalZ = tp.z + 3.0;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, goalX, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, goalY, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, tp.x, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, tp.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, tp.z, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        onArrived();
      }
    } else if (phase.current === "soon1-view") {
      camera.position.set(tp.x, tp.y + 0.5, tp.z + 3.0);
      camera.lookAt(tp.x, tp.y, tp.z);
    } else if (phase.current === "return-to-galaxy") {
      time.current += dt;
      const duration = 2.5;
      const progress = Math.min(time.current / duration, 1);
      const e = easeInOutCubic(progress);

      const goalZ = savedCamPos.current.z;

      camera.position.x = THREE.MathUtils.lerp(flyStartPos.current.x, panOffset.current.x, e);
      camera.position.y = THREE.MathUtils.lerp(flyStartPos.current.y, panOffset.current.y, e);
      camera.position.z = THREE.MathUtils.lerp(flyStartPos.current.z, goalZ, e);

      _lookTarget.current.x = THREE.MathUtils.lerp(flyStartLook.current.x, panOffset.current.x, e);
      _lookTarget.current.y = THREE.MathUtils.lerp(flyStartLook.current.y, panOffset.current.y, e);
      _lookTarget.current.z = THREE.MathUtils.lerp(flyStartLook.current.z, 0, e);
      camera.lookAt(_lookTarget.current);

      if (progress >= 1) {
        zDist.current = goalZ;
        targetZ.current = goalZ;
        onArrived();
      }
    }
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════
   Scene (assembles everything inside Canvas)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   FloatingModel — GLB model orbiting the scene (decorative)
   ═══════════════════════════════════════════════════════════ */
function FloatingModel({ url, orbitRadius, speed, inclination, phase, scale: modelScale, tumbleSpeed, sceneScale }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const angleRef = useRef(phase || 0);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    angleRef.current += speed * delta;
    const a = angleRef.current;
    const r = orbitRadius * sceneScale;
    const ci = Math.cos(inclination);
    const si = Math.sin(inclination);
    const x = r * Math.cos(a);
    const z = r * Math.sin(a) * ci;
    const y = r * Math.sin(a) * si;
    groupRef.current.position.set(x, y, z);
    if (meshRef.current) {
      meshRef.current.rotation.x += (tumbleSpeed || 0.2) * delta;
      meshRef.current.rotation.y += (tumbleSpeed || 0.2) * 0.7 * delta;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive ref={meshRef} object={cloned} scale={modelScale || 0.1} />
    </group>
  );
}

function Scene({ onNavigate, onViewModeChange, onBackRef }) {
  const [flyTarget, setFlyTarget] = useState(null);
  const [viewMode, _setViewMode] = useState("galaxy"); // galaxy | flyto-tv | tv | flyto-ipod | ipod | flyto-galaxy
  const [hoveredPlanetId, setHoveredPlanetId] = useState(null);
  // Sound disabled
  // const clickAudio = useRef(null);
  const tvState = useTvState();
  const ipodState = useIpodState();

  // Responsive scale factor based on viewport width
  const [sceneScale, setSceneScale] = useState(getScenScale);
  useEffect(() => {
    const onResize = () => setSceneScale(getScenScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Shared position store — updated each frame by each Planet's useFrame
  const planetPositionsRef = useRef(
    Object.fromEntries(PLANETS.map((p) => [p.id, new THREE.Vector3()]))
  );

  const setViewMode = useCallback((mode) => {
    _setViewMode(mode);
    onViewModeChange?.(mode);
  }, [onViewModeChange]);

  useEffect(() => {
    // Sound disabled
    // clickAudio.current = new Audio("/assets/sounds/43676__stijn__click10.wav");
    // clickAudio.current.volume = 0.3;
  }, []);

  // Enable/disable iPod keyboard when entering/leaving iPod mode
  useEffect(() => {
    if (viewMode === "ipod") {
      ipodState.setKeyboardEnabled(true);
    } else {
      ipodState.setKeyboardEnabled(false);
    }
  }, [viewMode, ipodState.setKeyboardEnabled]);

  // Compute focusedId for Planet visibility
  const focusedId = useMemo(() => {
    if (viewMode === "flyto-tv" || viewMode === "tv") return "tv";
    if (viewMode === "flyto-ipod" || viewMode === "ipod") return "ipod";
    if (viewMode === "flyto-resume" || viewMode === "resume") return "resume";
    if (viewMode === "flyto-snowboard" || viewMode === "snowboard") return "snowboard";
    if (viewMode === "flyto-soon1" || viewMode === "soon1") return "soon1";
    if (viewMode === "flyto-galaxy" && flyTarget) return flyTarget.id;
    return null;
  }, [viewMode, flyTarget]);

  const handleSelect = useCallback((planet) => {
    // Sound disabled

    if (planet.id === "tv") {
      if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
        onNavigate("/tv");
        return;
      }
      setFlyTarget(planet);
      setViewMode("flyto-tv");
    } else if (planet.id === "ipod") {
      setFlyTarget(planet);
      setViewMode("flyto-ipod");
    } else if (planet.id === "resume") {
      setFlyTarget(planet);
      setViewMode("flyto-resume");
    } else if (planet.id === "snowboard") {
      setFlyTarget(planet);
      setViewMode("flyto-snowboard");
    } else if (planet.id === "soon1") {
      setFlyTarget(planet);
      setViewMode("flyto-soon1");
    } else {
      setFlyTarget(planet);
    }
  }, [onNavigate, setViewMode]);

  const handleArrived = useCallback(() => {
    if (viewMode === "flyto-tv") {
      setViewMode("tv");
    } else if (viewMode === "flyto-ipod") {
      setViewMode("ipod");
    } else if (viewMode === "flyto-resume") {
      setViewMode("resume");
    } else if (viewMode === "flyto-snowboard") {
      setViewMode("snowboard");
    } else if (viewMode === "flyto-soon1") {
      setViewMode("soon1");
    } else if (viewMode === "flyto-galaxy") {
      setViewMode("galaxy");
      setFlyTarget(null);
    } else if (flyTarget?.route && flyTarget.id !== "tv" && flyTarget.id !== "ipod") {
      onNavigate(flyTarget.route);
    }
  }, [viewMode, flyTarget, onNavigate, setViewMode]);

  const handleBack = useCallback(() => {
    if (viewMode === "tv") {
      setViewMode("flyto-galaxy");
    } else if (viewMode === "ipod") {
      ipodState.cleanup();
      setViewMode("flyto-galaxy");
    } else if (viewMode === "resume") {
      setViewMode("flyto-galaxy");
    } else if (viewMode === "snowboard") {
      setViewMode("flyto-galaxy");
    } else if (viewMode === "soon1") {
      setViewMode("flyto-galaxy");
    }
  }, [viewMode, setViewMode, ipodState]);

  // Expose handleBack to parent Galaxy component
  useEffect(() => {
    if (onBackRef) onBackRef.current = handleBack;
  }, [handleBack, onBackRef]);

  /* Escape key to go back from TV or iPod mode */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (viewMode === "tv" || viewMode === "flyto-tv") {
          setViewMode("flyto-galaxy");
        } else if (viewMode === "ipod" || viewMode === "flyto-ipod") {
          ipodState.cleanup();
          setViewMode("flyto-galaxy");
        } else if (viewMode === "resume" || viewMode === "flyto-resume") {
          setViewMode("flyto-galaxy");
        } else if (viewMode === "snowboard" || viewMode === "flyto-snowboard") {
          setViewMode("flyto-galaxy");
        } else if (viewMode === "soon1" || viewMode === "flyto-soon1") {
          setViewMode("flyto-galaxy");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, setViewMode, ipodState]);

  return (
    <>
      <fog attach="fog" args={["#2a1878", 100, 250]} />
      <color attach="background" args={["#1a1060"]} />

      {/* Ambient fill — boosted for brightness */}
      <ambientLight intensity={0.9} color="#aa99ee" />

      {/* Key light — blue-white from upper-right */}
      <directionalLight position={[30, 20, 25]} intensity={3.0} color="#ccddff" />

      {/* Rim light — magenta-pink from lower-left */}
      <directionalLight position={[-20, -12, 15]} intensity={1.6} color="#ff88bb" />

      {/* Backlight — purple from behind */}
      <directionalLight position={[0, 5, -30]} intensity={1.2} color="#bb88ff" />

      {/* Fill from below — warm uplight */}
      <directionalLight position={[0, -20, 10]} intensity={0.6} color="#cc99ff" />

      {/* Warm accent */}
      <directionalLight position={[20, 10, -10]} intensity={0.8} color="#ffaa66" />

      {/* Scattered point lights — bright galaxy clusters */}
      <pointLight position={[50, 30, 40]} intensity={45} distance={180} decay={2} color="#aabbff" />
      <pointLight position={[-40, 20, -30]} intensity={35} distance={150} decay={2} color="#dd88ff" />
      <pointLight position={[15, -25, -40]} intensity={25} distance={130} decay={2} color="#ff88aa" />
      <pointLight position={[-15, 15, 20]} intensity={20} distance={100} decay={2} color="#88ffdd" />

      <NebulaClouds />
      <Stars radius={140} depth={100} count={12000} factor={6} saturation={1.0} fade speed={0.4} />

      <Sun />
      <AsteroidBelt sceneScale={sceneScale} />

      {/* Floating decorative GLB models */}
      {/* asteroids.glb meshes are now used in AsteroidBelt */}
      <FloatingModel url="/models/model2.glb" orbitRadius={30} speed={0.025} inclination={-0.1} phase={4.0} scale={3} tumbleSpeed={0.25} sceneScale={sceneScale} />

      {PLANETS.filter((p) => !p.noOrbitRing).map((p) => (
        <OrbitRing key={`ring-${p.id}`} radius={p.orbit.radius * sceneScale} inclination={p.orbit.inclination} planet={p} onSelect={handleSelect} hoveredPlanetId={hoveredPlanetId} />
      ))}

      {PLANETS.map((p) => {
        // Freeze planet when it's the fly-to target or in its active view
        const isFrozen =
          (p.id === "ipod" && (viewMode === "flyto-ipod" || viewMode === "ipod" || (viewMode === "flyto-galaxy" && flyTarget?.id === "ipod"))) ||
          (p.id === "tv" && (viewMode === "flyto-tv" || viewMode === "tv" || (viewMode === "flyto-galaxy" && flyTarget?.id === "tv"))) ||
          (p.id === "resume" && (viewMode === "flyto-resume" || viewMode === "resume" || (viewMode === "flyto-galaxy" && flyTarget?.id === "resume"))) ||
          (p.id === "snowboard" && (viewMode === "flyto-snowboard" || viewMode === "snowboard" || (viewMode === "flyto-galaxy" && flyTarget?.id === "snowboard"))) ||
          (p.id === "soon1" && (viewMode === "flyto-soon1" || viewMode === "soon1" || (viewMode === "flyto-galaxy" && flyTarget?.id === "soon1")));

        return (
          <Planet
            key={p.id}
            planet={p}
            onSelect={handleSelect}
            viewMode={viewMode}
            focusedId={focusedId}
            tvState={p.id === "tv" ? tvState : undefined}
            ipodState={p.id === "ipod" ? ipodState : undefined}
            onBack={(p.id === "tv" || p.id === "ipod" || p.id === "resume" || p.id === "soon1") ? handleBack : undefined}
            frozen={isFrozen}
            planetPositionsRef={planetPositionsRef}
            sceneScale={sceneScale}
            onHover={setHoveredPlanetId}
          />
        );
      })}

      <CameraController
        viewMode={viewMode}
        onArrived={handleArrived}
        planetPositionsRef={planetPositionsRef}
        sceneScale={sceneScale}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Galaxy (exported component)
   ═══════════════════════════════════════════════════════════ */
export default function Galaxy() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState("galaxy");
  const [showHelp, setShowHelp] = useState(false);
  const backRef = useRef(null);

  const handleNavigate = useCallback(
    (route) => {
      router.push(route);
    },
    [router]
  );

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    if (mode !== "ipod") setShowHelp(false);
  }, []);

  const handleDomBack = useCallback(() => {
    if (backRef.current) backRef.current();
  }, []);

  return (
    <div className="galaxy-wrapper">
      {/* overlay text — hide when not in galaxy mode */}
      <div className="galaxy-overlay" style={{ opacity: viewMode !== "galaxy" ? 0 : 1, transition: "opacity 0.5s" }}>
        <h1 className="galaxy-title">Enrique Chong</h1>
        <p className="galaxy-subtitle">Select a planet to explore</p>
      </div>

      {/* DOM-level Back button — works reliably on touch devices */}
      {(viewMode === "tv" || viewMode === "ipod" || viewMode === "resume" || viewMode === "snowboard" || viewMode === "soon1") && (
        <button className="dom-back-btn" onClick={handleDomBack}>
          &larr; Back
        </button>
      )}

      {/* iPod help button — visible only in iPod mode */}
      {viewMode === "ipod" && (
        <>
          <button className="ipod-help-btn" onClick={() => setShowHelp(!showHelp)} aria-label="Help">?</button>
          {showHelp && (
            <div className="ipod-instructions">
              <p><strong>Desktop Controls</strong></p>
              <p><strong>Up:</strong> <span>&uarr; Up Arrow</span></p>
              <p><strong>Down:</strong> <span>&darr; Down Arrow</span></p>
              <p><strong>Select:</strong> <span>&rarr; Right Arrow</span></p>
              <p><strong>Back:</strong> <span>&larr; Left Arrow</span></p>
              <p><strong>Play:</strong> <span>Space Bar</span></p>
              <p style={{marginTop:6,color:'#777',fontSize:11}}>Or scroll on the click wheel</p>
            </div>
          )}
        </>
      )}

      <Canvas
        camera={{ position: [0, 8, 70], fov: 60 }}
        style={{ width: "100%", height: "100vh" }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Scene onNavigate={handleNavigate} onViewModeChange={handleViewModeChange} onBackRef={backRef} />
      </Canvas>
    </div>
  );
}
