import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AIPlanetVisualizerProps {
  isListening?: boolean;
  audioVolume?: number;
  /** @deprecated Use isListening */
  active?: boolean;
  /** @deprecated Use audioVolume */
  amplitude?: number;
  className?: string;
}

const GRAIN_SIZE = 300;
const GRAIN_ALPHA = 28;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Compact 2D Simplex noise — drives organic cloud motion. */
function createSimplex2D(): (x: number, y: number) => number {
  const perm = new Uint8Array(512);
  const grad = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = perm[i & 255]!;

  const dot = (g: readonly [number, number], x: number, y: number) => g[0] * x + g[1] * y;
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  return (xin: number, yin: number) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]!]! % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]!]! % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]!]! % 8;

    let n0 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot(grad[gi0]!, x0, y0);
    }

    let n1 = 0;
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot(grad[gi1]!, x1, y1);
    }

    let n2 = 0;
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot(grad[gi2]!, x2, y2);
    }

    return 70 * (n0 + n1 + n2);
  };
}

function createFilmGrainCanvas(): HTMLCanvasElement {
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = GRAIN_SIZE;
  noiseCanvas.height = GRAIN_SIZE;

  const nCtx = noiseCanvas.getContext("2d");
  if (!nCtx) return noiseCanvas;

  const imgData = nCtx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const val = Math.random() * 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = GRAIN_ALPHA;
  }

  nCtx.putImageData(imgData, 0, 0);
  return noiseCanvas;
}

const FLUID_BLOBS = [
  { r: 0.52, speed: 0.38, phase: 0, inner: "rgba(134, 239, 172, 0.55)", outer: "rgba(134, 239, 172, 0)" },
  { r: 0.62, speed: 0.52, phase: 2.1, inner: "rgba(59, 130, 246, 0.42)", outer: "rgba(59, 130, 246, 0)" },
  { r: 0.44, speed: 0.31, phase: 4.3, inner: "rgba(125, 211, 252, 0.38)", outer: "rgba(125, 211, 252, 0)" },
  { r: 0.7, speed: 0.24, phase: 1.7, inner: "rgba(16, 185, 129, 0.28)", outer: "rgba(16, 185, 129, 0)" },
  { r: 0.36, speed: 0.65, phase: 5.9, inner: "rgba(186, 230, 253, 0.32)", outer: "rgba(186, 230, 253, 0)" },
] as const;

export function AIPlanetVisualizer({
  isListening: isListeningProp,
  audioVolume: audioVolumeProp,
  active,
  amplitude,
  className,
}: AIPlanetVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const isListeningRef = useRef(false);
  const audioVolumeRef = useRef(0.2);
  const smoothVolumeRef = useRef(0.2);

  const isListening = isListeningProp ?? active ?? false;
  const audioVolume = audioVolumeProp ?? amplitude ?? 0.2;

  isListeningRef.current = isListening;
  audioVolumeRef.current = audioVolume;

  useEffect(() => {
    grainRef.current = createFilmGrainCanvas();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const noise2D = createSimplex2D();
    let animId = 0;
    let time = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = parent.clientWidth;
      const height = 280;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);

    const render = () => {
      time += 0.01;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      const listening = isListeningRef.current;
      const targetVolume = listening ? audioVolumeRef.current : 0.12;
      smoothVolumeRef.current = lerp(smoothVolumeRef.current, targetVolume, 0.1);
      const volume = smoothVolumeRef.current;
      const energy = listening ? Math.min(1, volume * 1.5) : 0.12;

      ctx.clearRect(0, 0, w, h);

      const baseR = Math.min(w, h) * 0.36;
      const pulse = listening ? volume * 18 : Math.sin(time * 2) * 2.5;
      const r = baseR + pulse;

      // 1. Soft atmospheric glow — fades into card bg (#0b0f19)
      const atmosGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r * 1.3);
      atmosGrad.addColorStop(0, `rgba(125, 211, 252, ${0.28 + energy * 0.12})`);
      atmosGrad.addColorStop(0.45, `rgba(52, 211, 153, ${0.12 + energy * 0.08})`);
      atmosGrad.addColorStop(0.75, "rgba(11, 15, 25, 0.35)");
      atmosGrad.addColorStop(1, "rgba(11, 15, 25, 0)");

      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Clip all planet layers to sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // 2. Core planet — top-right offset light (ElevenLabs reference)
      const lightX = cx + r * 0.45 + noise2D(time * 0.15, 0) * r * 0.04;
      const lightY = cy - r * 0.35 + noise2D(0, time * 0.15) * r * 0.04;
      const shadowX = cx - r * 0.2;
      const shadowY = cy + r * 0.2;

      const planetGrad = ctx.createRadialGradient(lightX, lightY, r * 0.05, shadowX, shadowY, r * 1.1);
      planetGrad.addColorStop(0, "#FFFFFF");
      planetGrad.addColorStop(0.18, "#BAE6FD");
      planetGrad.addColorStop(0.42, "#86EFAC");
      planetGrad.addColorStop(0.68, "#3B82F6");
      planetGrad.addColorStop(0.92, "#1D4ED8");
      planetGrad.addColorStop(1, "#0F172A");

      ctx.fillStyle = planetGrad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // 3. Organic fluid cloud layers (Simplex-driven blob motion)
      ctx.globalCompositeOperation = "screen";
      for (const blob of FLUID_BLOBS) {
        const nX = noise2D(blob.phase + time * blob.speed, blob.phase * 0.7 + time * 0.2);
        const nY = noise2D(blob.phase * 1.3 + time * 0.18, blob.phase + time * blob.speed * 0.85);
        const bx = cx + nX * r * 0.38;
        const by = cy + nY * r * 0.32 + r * 0.08;

        const blobGrad = ctx.createRadialGradient(bx, by, 0, bx, by, r * blob.r * (1 + energy * 0.08));
        blobGrad.addColorStop(0, blob.inner);
        blobGrad.addColorStop(1, blob.outer);

        ctx.fillStyle = blobGrad;
        ctx.beginPath();
        ctx.arc(bx, by, r * blob.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Secondary soft-light turbulence for depth
      ctx.globalCompositeOperation = "soft-light";
      const turbX = cx + noise2D(time * 0.22, 3.7) * r * 0.25;
      const turbY = cy + r * 0.15 + noise2D(3.7, time * 0.22) * r * 0.2;
      const turbGrad = ctx.createRadialGradient(turbX, turbY, r * 0.05, turbX, turbY, r * 0.85);
      turbGrad.addColorStop(0, `rgba(255, 255, 255, ${0.12 + energy * 0.1})`);
      turbGrad.addColorStop(0.4, `rgba(134, 239, 172, ${0.08 + energy * 0.06})`);
      turbGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = turbGrad;
      ctx.beginPath();
      ctx.arc(turbX, turbY, r * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // 5. Pinpoint top-right specular
      ctx.globalCompositeOperation = "lighter";
      const specGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, r * 0.38);
      specGrad.addColorStop(0, `rgba(255, 255, 255, ${0.65 + energy * 0.2})`);
      specGrad.addColorStop(0.35, `rgba(186, 230, 253, ${0.25 + energy * 0.15})`);
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(lightX, lightY, r * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // 6. Cached film grain
      const grain = grainRef.current;
      if (grain) {
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.22 + energy * 0.03;
        const pattern = ctx.createPattern(grain, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0b0f19]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(125, 211, 252, 0.04) 0%, rgba(11, 15, 25, 0) 65%)",
        }}
      />
      <canvas
        ref={canvasRef}
        className="relative h-full w-full object-contain contrast-110 saturate-125"
        aria-hidden
      />
    </div>
  );
}
