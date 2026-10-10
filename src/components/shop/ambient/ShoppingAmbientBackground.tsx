import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { AMBIENT_SCENE_FADE_MS, SHOP_AMBIENT_BG } from "@/components/shop/ambient/constants";
import { createAmbientScene } from "@/components/shop/ambient/ambient-scenes";
import { useAmbientSceneLoop } from "@/components/shop/ambient/useAmbientSceneLoop";

interface ShoppingAmbientBackgroundProps {
  enabled?: boolean;
  className?: string;
}

/**
 * Fixed full-viewport ambient canvas (Three.js) with blur readability overlay.
 * Scenes auto-rotate every 10s while `enabled` is true.
 */
export function ShoppingAmbientBackground({
  enabled = true,
  className,
}: ShoppingAmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scene, opacity } = useAmbientSceneLoop(enabled);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const runtime = createAmbientScene(scene);
    let animationId = 0;
    let visible = true;
    let elapsed = 0;
    let lastTime = performance.now();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      runtime.camera.aspect = width / height;
      runtime.camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    const tick = (now: number) => {
      animationId = requestAnimationFrame(tick);
      if (!visible || disposed) return;

      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += delta;

      runtime.update(delta, elapsed);
      renderer.render(runtime.scene, runtime.camera);
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      runtime.dispose();
      renderer.dispose();
    };
  }, [enabled, scene]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
      style={{ backgroundColor: SHOP_AMBIENT_BG }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          opacity,
          transition: `opacity ${AMBIENT_SCENE_FADE_MS}ms ease-in-out`,
        }}
      />
      <div className="absolute inset-0 bg-[#0b132b]/28 backdrop-blur-[4px]" />
    </div>
  );
}
