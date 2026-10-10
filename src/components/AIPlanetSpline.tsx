import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const SPLINE_SCENE =
  "https://prod.spline.design/ZrjZk7bfhBZZWnO2zUZ7e1Ws/scene.splinecode";
const SPLINE_IFRAME = "https://my.spline.design/planet-ZrjZk7bfhBZZWnO2zUZ7e1Ws/";
const LOAD_TIMEOUT_MS = 12_000;

const Spline = lazy(() => import("@splinetool/react-spline"));

interface AIPlanetSplineProps {
  isListening?: boolean;
  audioVolume?: number;
  /** @deprecated Use isListening */
  active?: boolean;
  /** @deprecated Use audioVolume */
  amplitude?: number;
  className?: string;
}

interface SplineErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

interface SplineErrorBoundaryState {
  hasError: boolean;
}

class SplineErrorBoundary extends Component<SplineErrorBoundaryProps, SplineErrorBoundaryState> {
  state: SplineErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SplineErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="h-20 w-20 animate-ping rounded-full border border-cyan-400/40 bg-cyan-500/20" />
      <span className="font-mono text-xs text-slate-400">Loading 3D Planet...</span>
    </div>
  );
}

function SplineIframe() {
  return (
    <iframe
      src={SPLINE_IFRAME}
      title="AI Planet"
      className="pointer-events-none h-full w-full border-0"
      loading="lazy"
    />
  );
}

interface SplineCanvasProps {
  onReady: () => void;
  onFail: () => void;
}

function SplineCanvas({ onReady, onFail }: SplineCanvasProps) {
  const timeoutRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  const settle = useCallback(
    (success: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (success) onReady();
      else onFail();
    },
    [onReady, onFail],
  );

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => settle(false), LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [settle]);

  return (
    <SplineErrorBoundary onError={() => settle(false)}>
      <Spline
        scene={SPLINE_SCENE}
        className="pointer-events-none h-full w-full [&_canvas]:pointer-events-none"
        onLoad={() => settle(true)}
      />
    </SplineErrorBoundary>
  );
}

export function AIPlanetSpline({
  isListening: isListeningProp,
  audioVolume: audioVolumeProp,
  active,
  amplitude,
  className,
}: AIPlanetSplineProps) {
  const [mounted, setMounted] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isListening = isListeningProp ?? active ?? false;
  const audioVolume = audioVolumeProp ?? amplitude ?? 0.2;
  const scale = isListening ? 1 + Math.min(audioVolume * 0.15, 0.2) : 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFail = useCallback(() => {
    setUseFallback(true);
  }, []);

  const handleReady = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-800/80 bg-[#080C14] shadow-2xl",
        className,
      )}
    >
      {!mounted ? (
        <LoadingFallback />
      ) : (
        <div
          className="pointer-events-none flex h-full w-full items-center justify-center transition-transform duration-100 ease-out"
          style={{ transform: `scale(${scale})` }}
        >
          {useFallback ? (
            <SplineIframe />
          ) : (
            <Suspense fallback={<LoadingFallback />}>
              {!loaded && <LoadingFallback />}
              <div className={cn("h-full w-full", loaded ? "opacity-100" : "opacity-0")}>
                <SplineCanvas onReady={handleReady} onFail={handleFail} />
              </div>
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
