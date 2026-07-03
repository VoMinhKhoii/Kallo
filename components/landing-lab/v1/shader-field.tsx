'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { LabMood } from '../use-demo';

/**
 * v1's signature: a full-viewport warm "silk/steam" gradient field —
 * domain-warped fbm noise ramped through the brand palette, rendered by a
 * ~60-line fragment shader on a fullscreen triangle. Zero dependencies.
 *
 * The field *reacts to the demo*: mood targets (energy, turbulence, hue
 * drift, speed) ease toward new values in the rAF loop via refs, so React
 * never re-renders per frame.
 *
 * Fallbacks: no WebGL / context lost → the production hero's blurred
 * blobs; reduced motion → a single static frame.
 */

interface MoodTarget {
  energy: number;
  turb: number;
  hue: number; // +1 → umber depth (analyzing), -1 → sage whisper (result)
  speed: number;
}

const MOODS: Record<LabMood, MoodTarget> = {
  idle: { energy: 0.15, turb: 0.3, hue: 0, speed: 0.35 },
  typing: { energy: 0.35, turb: 0.5, hue: 0, speed: 0.6 },
  analyzing: { energy: 0.7, turb: 0.85, hue: 0.35, speed: 1.0 },
  result: { energy: 0.28, turb: 0.35, hue: -0.25, speed: 0.45 },
};

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_energy;
uniform float u_turb;
uniform float u_hue;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 1.6;
  float t = u_time * 0.06;

  // Classic silk: warp the domain twice before the final lookup.
  vec2 q = vec2(fbm(p + t * 0.9), fbm(p + vec2(5.2, 1.3) - t * 0.6));
  vec2 r = vec2(
    fbm(p + u_turb * 2.2 * q + vec2(1.7, 9.2) + t * 0.4),
    fbm(p + u_turb * 2.2 * q + vec2(8.3, 2.8) - t * 0.3)
  );
  float f = fbm(p + 2.4 * r);

  vec3 cream = vec3(0.996, 0.984, 0.965);
  vec3 biscotti = vec3(0.910, 0.835, 0.710);
  vec3 tan = vec3(0.788, 0.659, 0.486);
  vec3 umber = vec3(0.412, 0.369, 0.306);
  vec3 sage = vec3(0.486, 0.639, 0.408);

  // Mood shifts the accent stop: toward umber while deriving,
  // a sage whisper on the result.
  vec3 tint = u_hue > 0.0
    ? mix(tan, umber, u_hue)
    : mix(tan, sage, -u_hue * 0.6);

  vec3 col = mix(cream, biscotti, smoothstep(0.30, 0.85, f) * (0.45 + 0.55 * u_energy));
  float band = smoothstep(0.46, 0.60, f) - smoothstep(0.60, 0.80, f);
  col = mix(col, tint, clamp(band, 0.0, 1.0) * (0.22 + 0.5 * u_energy));
  float deep = smoothstep(0.72, 0.95, f) * length(r) * 0.5;
  col = mix(col, umber, clamp(deep, 0.0, 1.0) * 0.06);

  // Quiet ground near the top edge so the fixed header never fights the field.
  col = mix(col, cream, smoothstep(0.72, 1.0, uv.y) * 0.85);

  // Fine grain, matching the SVG grain used elsewhere on the site.
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.016;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** The production hero's ambient blobs — served when WebGL isn't. */
export function FallbackBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#E8D5B5]/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#C9A87C]/10 blur-[100px]" />
    </div>
  );
}

export function ShaderField({ mood }: { mood: LabMood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const targetRef = useRef<MoodTarget>(MOODS.idle);

  useEffect(() => {
    targetRef.current = MOODS[mood];
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let gl: WebGLRenderingContext | null = null;
    let raf = 0;
    let disposed = false;
    let running = false;
    let inView = true;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    // Current values ease toward the mood targets each frame.
    const cur: MoodTarget = { ...MOODS.idle };
    let timeAcc = 0;
    let last = 0;

    const resize = () => {
      if (!gl) {
        return;
      }
      const coarse =
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 768;
      const dpr = coarse ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      // fbm is soft — clamp the backing store and let CSS upscale.
      const w = Math.min(Math.round(canvas.clientWidth * dpr), 1600);
      const h = Math.min(Math.round(canvas.clientHeight * dpr), 1000);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const drawFrame = (now: number) => {
      if (!gl) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const target = targetRef.current;
      // Frame-rate-independent damping toward the mood target.
      const ease = 1 - Math.exp(-dt * 2.5);
      cur.energy += (target.energy - cur.energy) * ease;
      cur.turb += (target.turb - cur.turb) * ease;
      cur.hue += (target.hue - cur.hue) * ease;
      cur.speed += (target.speed - cur.speed) * ease;
      timeAcc += dt * cur.speed;

      gl.uniform2f(uniforms.u_res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.u_time, timeAcc);
      gl.uniform1f(uniforms.u_energy, cur.energy);
      gl.uniform1f(uniforms.u_turb, cur.turb);
      gl.uniform1f(uniforms.u_hue, cur.hue);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (disposed || !running) {
        return;
      }
      drawFrame(now);
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (disposed || running || !gl || prefersReducedMotion) {
        return;
      }
      if (document.visibilityState === 'hidden' || !inView) {
        return;
      }
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const compile = (type: number, source: string): WebGLShader | null => {
      if (!gl) {
        return null;
      }
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return null;
      }
      return shader;
    };

    const init = () => {
      if (disposed) {
        return;
      }
      gl = canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      });
      if (!gl) {
        setFailed(true);
        return;
      }
      const vert = compile(gl.VERTEX_SHADER, VERT);
      const frag = compile(gl.FRAGMENT_SHADER, FRAG);
      const program = gl.createProgram();
      if (!vert || !frag || !program) {
        setFailed(true);
        return;
      }
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        setFailed(true);
        return;
      }
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook
      gl.useProgram(program);

      // One triangle covering the viewport — no index buffer, no quad seam.
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uniforms = Object.fromEntries(
        ['u_res', 'u_time', 'u_energy', 'u_turb', 'u_hue'].map((name) => [
          name,
          gl?.getUniformLocation(program, name) ?? null,
        ])
      );

      resize();

      if (prefersReducedMotion) {
        // A beautiful still, not a dead cream wall.
        timeAcc = 8;
        cur.energy = MOODS.idle.energy;
        drawFrame(performance.now());
        return;
      }
      startLoop();
    };

    // Defer GL init so hydration and LCP settle first.
    const hasIdleCallback = typeof window.requestIdleCallback === 'function';
    const idleHandle = hasIdleCallback
      ? window.requestIdleCallback(init, { timeout: 600 })
      : window.setTimeout(init, 200);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopLoop();
      } else {
        startLoop();
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stopLoop();
      setFailed(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onContextLost);

    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        startLoop();
      } else {
        stopLoop();
      }
    });
    intersection.observe(canvas);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        if (gl && prefersReducedMotion) {
          drawFrame(performance.now());
        }
      }, 150);
    });
    resizeObserver.observe(canvas);

    return () => {
      disposed = true;
      stopLoop();
      clearTimeout(resizeTimer);
      if (hasIdleCallback) {
        window.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      intersection.disconnect();
      resizeObserver.disconnect();
    };
  }, [prefersReducedMotion]);

  if (failed) {
    return <FallbackBlobs />;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Radial cream veil — keeps the centered copy on calm ground no
          matter how energetic the field gets. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 58% at 50% 44%, rgba(254,251,246,0.94), rgba(254,251,246,0.5) 55%, transparent 82%)',
        }}
      />
    </div>
  );
}
