import { useEffect, useRef, useState } from "react";
import {
  AMBIENT_SCENE_FADE_MS,
  AMBIENT_SCENE_IDS,
  AMBIENT_SCENE_INTERVAL_MS,
  type AmbientSceneId,
} from "@/components/shop/ambient/constants";

export interface AmbientSceneLoopState {
  scene: AmbientSceneId;
  sceneIndex: number;
  /** 0–1 opacity for cross-fade transitions */
  opacity: number;
  isTransitioning: boolean;
}

/**
 * Cycles ambient marketplace scenes every 10s with smooth fade-out / fade-in.
 */
export function useAmbientSceneLoop(enabled = true): AmbientSceneLoopState {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const indexRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {
      setOpacity(1);
      setIsTransitioning(false);
      return;
    }

    const clearTimers = () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };

    const scheduleNextCycle = () => {
      const cycleTimer = window.setTimeout(() => {
        setIsTransitioning(true);
        setOpacity(0);

        const swapTimer = window.setTimeout(() => {
          indexRef.current = (indexRef.current + 1) % AMBIENT_SCENE_IDS.length;
          setSceneIndex(indexRef.current);
          setOpacity(1);

          const endFadeTimer = window.setTimeout(() => {
            setIsTransitioning(false);
            scheduleNextCycle();
          }, AMBIENT_SCENE_FADE_MS);

          timersRef.current.push(endFadeTimer);
        }, AMBIENT_SCENE_FADE_MS);

        timersRef.current.push(swapTimer);
      }, AMBIENT_SCENE_INTERVAL_MS);

      timersRef.current.push(cycleTimer);
    };

    scheduleNextCycle();

    return () => clearTimers();
  }, [enabled]);

  return {
    scene: AMBIENT_SCENE_IDS[sceneIndex]!,
    sceneIndex,
    opacity,
    isTransitioning,
  };
}
