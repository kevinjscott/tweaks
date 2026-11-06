type Capture = () => string | null;

let current: Capture | null = null;

export function registerViewportCapture(fn: Capture | null) {
  current = fn;
}

/** JPEG data URL of the active 3D viewport (or the plan view), downscaled for vision models. */
export function captureViewport(): string | null {
  try {
    return current ? current() : null;
  } catch {
    return null;
  }
}

export function downscaleCanvas(src: HTMLCanvasElement | HTMLVideoElement, maxW = 1280, quality = 0.72): string | null {
  const w = src instanceof HTMLCanvasElement ? src.width : src.videoWidth;
  const h = src instanceof HTMLCanvasElement ? src.height : src.videoHeight;
  if (!w || !h) return null;
  const k = Math.min(1, maxW / w);
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#050d19";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

let canvasEl: HTMLCanvasElement | null = null;
export function registerCanvas(el: HTMLCanvasElement | null) {
  canvasEl = el;
}
export function getCanvas() {
  return canvasEl;
}

type PoseGetter = () => import("./tours").Pose | null;
let poseGetter: PoseGetter | null = null;
export function registerPoseGetter(fn: PoseGetter | null) {
  poseGetter = fn;
}
export function getCameraPose() {
  return poseGetter ? poseGetter() : null;
}
