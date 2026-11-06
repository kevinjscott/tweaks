import { getCanvas } from "./viewport";
import { useStudio } from "@/store/studio";

export function recordingSupported() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

function pickMime() {
  const options = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
}

/** Play a tour from the start while recording the WebGL canvas to a WebM blob. */
export function recordTour(tourId: string, opts: { fps?: number; bitrate?: number } = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = getCanvas();
    if (!canvas) return reject(new Error("3D viewport is not available. Open the Flythroughs page first."));
    if (!recordingSupported()) return reject(new Error("MediaRecorder / canvas capture is not supported in this browser."));
    const stream = canvas.captureStream(opts.fps ?? 30);
    const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: opts.bitrate ?? 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onerror = () => reject(new Error("Recording failed."));
    rec.onstop = () => {
      unsub();
      useStudio.getState().setPlayback({ recording: false });
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
    const st = useStudio.getState();
    st.setPlayback({ tourId, state: "paused", t: 0, loop: false, recording: true, speed: 1, seek: { id: Date.now(), t: 0 } });
    rec.start(250);
    const unsub = useStudio.subscribe((s, prev) => {
      if (s.playback.recording && prev.playback.state === "playing" && s.playback.state === "idle") {
        setTimeout(() => rec.state !== "inactive" && rec.stop(), 400);
      }
    });
    setTimeout(() => useStudio.getState().setPlayback({ state: "playing" }), 350);
  });
}
