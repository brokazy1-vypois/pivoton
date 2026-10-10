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
import type { Application } from "@splinetool/runtime";
import { attachFastHeadTracking } from "@/lib/robot-head-tracking";
import { ROBOT_SPLINE_IFRAME, ROBOT_SPLINE_SCENE } from "@/lib/spline-robot";

const Spline = lazy(() => import("@splinetool/react-spline"));
const LOAD_TIMEOUT_MS = 14_000;

/** Uniform scale — original proportions; wider frame + shifted right for full shoulders. */
const ROBOT_EMBED_STYLE = {
  left: "56%",
  top: "42%",
  width: "152%",
  height: "130%",
  transform: "translate(-50%, -50%) scale(0.8)",
  transformOrigin: "center center",
} as const;

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

function RobotIframeFallback() {
  return (
    <iframe
      src={ROBOT_SPLINE_IFRAME}
      title="3D AI Broker"
      className="pointer-events-auto absolute border-0 bg-transparent"
      style={ROBOT_EMBED_STYLE}
      loading="eager"
      allow="autoplay; fullscreen"
    />
  );
}

interface RobotSplineCanvasProps {
  onReady: () => void;
  onFail: () => void;
  onLoadApp: (app: Application) => void;
}

function RobotSplineCanvas({ onReady, onFail, onLoadApp }: RobotSplineCanvasProps) {
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

  const handleLoad = useCallback(
    (app: Application) => {
      onLoadApp(app);
      settle(true);
    },
    [onLoadApp, settle],
  );

  return (
    <SplineErrorBoundary onError={() => settle(false)}>
      <Spline
        scene={ROBOT_SPLINE_SCENE}
        renderOnDemand
        className="pointer-events-auto absolute border-0 bg-transparent [&_canvas]:pointer-events-auto"
        style={ROBOT_EMBED_STYLE}
        onLoad={handleLoad}
      />
    </SplineErrorBoundary>
  );
}

/**
 * Landing hero robot — runtime canvas with instant global head tracking.
 * Falls back to the Spline iframe if the local scene fails to load.
 */
export function HeroRobotAvatar() {
  const [mounted, setMounted] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const trackingCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      trackingCleanupRef.current?.();
      trackingCleanupRef.current = null;
    };
  }, []);

  const handleFail = useCallback(() => {
    trackingCleanupRef.current?.();
    trackingCleanupRef.current = null;
    setUseFallback(true);
  }, []);

  const handleReady = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleLoadApp = useCallback((app: Application) => {
    trackingCleanupRef.current?.();
    app.setBackgroundColor("rgba(0,0,0,0)");
    trackingCleanupRef.current = attachFastHeadTracking(app);
  }, []);

  return (
    <div
      className="relative z-10 ml-auto w-full max-w-[640px] overflow-visible bg-transparent lg:max-w-[680px]"
      style={{ minHeight: "min(52vw, 520px)" }}
      aria-label="Interactive 3D AI broker"
    >
      {!mounted || useFallback ? (
        <RobotIframeFallback />
      ) : (
        <Suspense fallback={<RobotIframeFallback />}>
          {!loaded && <RobotIframeFallback />}
          <div className={loaded ? "absolute inset-0 overflow-visible opacity-100" : "absolute inset-0 overflow-visible opacity-0"}>
            <RobotSplineCanvas
              onReady={handleReady}
              onFail={handleFail}
              onLoadApp={handleLoadApp}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
