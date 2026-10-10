import {
  applyIdleHeadMotion,
  createGlbHeadRig,
  renderRigFrame,
  rigToPngBlob,
  type GlbHeadRig,
} from "@/lib/avaturn-glb-rig";
import { requestServerAvatarRender } from "@/lib/avaturn-render-api";

export interface AnimatedAvatarResult {
  video: Blob;
  poster: Blob;
  mediaType: "video";
  mimeType: string;
}

const LOOP_SECONDS = 2.5;
const FPS = 24;

function pickWebmMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

async function recordWebmLoop(rig: GlbHeadRig, mimeType: string): Promise<Blob> {
  const stream = rig.renderer.domElement.captureStream(FPS);
  const chunks: Blob[] = [];

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 900_000,
  });

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.start(Math.round(1000 / FPS));

  const start = performance.now();
  const frameMs = 1000 / FPS;
  let lastFrame = start;

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      if (elapsed >= LOOP_SECONDS) {
        applyIdleHeadMotion(rig, LOOP_SECONDS % 1.3);
        renderRigFrame(rig);
        recorder.stop();
        resolve();
        return;
      }

      if (now - lastFrame >= frameMs) {
        applyIdleHeadMotion(rig, elapsed);
        renderRigFrame(rig);
        lastFrame = now;
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await stopped;

  if (chunks.length === 0) {
    throw new Error("Could not encode animated avatar video.");
  }

  return new Blob(chunks, { type: mimeType });
}

/** Offscreen head-framed loop (WebM) + static PNG poster from an Avaturn GLB. */
export async function renderGlbAnimatedAvatar(glbUrl: string): Promise<AnimatedAvatarResult> {
  const serverResult = await requestServerAvatarRender(glbUrl);
  if (serverResult) {
    return serverResult;
  }

  const rig = await createGlbHeadRig(glbUrl, 512);

  try {
    const poster = await rigToPngBlob(rig);
    const mimeType = pickWebmMimeType();

    if (!mimeType) {
      return {
        video: poster,
        poster,
        mediaType: "video",
        mimeType: "image/png",
      };
    }

    const video = await recordWebmLoop(rig, mimeType);

    return {
      video,
      poster,
      mediaType: "video",
      mimeType,
    };
  } finally {
    rig.dispose();
  }
}

/** Static head portrait (PNG) — used as fallback poster. */
export async function renderGlbHeadPortrait(glbUrl: string): Promise<Blob> {
  const rig = await createGlbHeadRig(glbUrl, 512);
  try {
    return rigToPngBlob(rig);
  } finally {
    rig.dispose();
  }
}

/** @deprecated Use renderGlbHeadPortrait */
export const renderGlbAvatarPortrait = renderGlbHeadPortrait;
