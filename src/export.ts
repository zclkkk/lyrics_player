import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import { getFileExtension } from "./utils";

const FFMPEG_CORE_VERSION = "0.12.15";
const FFMPEG_CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
export const EXPORT_RECORDING_MIME_TYPE = "video/webm;codecs=vp9";

export const supportsInlineExport = () =>
  !!navigator.mediaDevices?.getDisplayMedia &&
  typeof MediaRecorder === "function" &&
  typeof Promise.withResolvers === "function" &&
  typeof AbortSignal.timeout === "function" &&
  !!MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE);

const OBSERVE_START_TIMEOUT_MS = 1200;

interface ObserveStartOptions {
  target: EventTarget;
  startEvents: readonly string[];
  errorEvents: readonly string[];
  hasStarted: () => boolean;
  getError: () => Error;
  cancelledErrorMessage: string;
}

const observeStart = ({
  target, startEvents, errorEvents,
  hasStarted, getError, cancelledErrorMessage,
}: ObserveStartOptions) => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  void promise.catch(() => {});
  const fallbackSignal = AbortSignal.timeout(OBSERVE_START_TIMEOUT_MS);
  let settled = false;

  const finalize = (cb: () => void) => {
    if (settled) return;
    settled = true;
    ac.abort();
    cb();
  };

  const handleStart = () => finalize(() => resolve(performance.now()));
  const handleError = () => finalize(() => reject(getError()));

  for (const e of startEvents) target.addEventListener(e, handleStart, { signal });
  for (const e of errorEvents) target.addEventListener(e, handleError, { signal });

  fallbackSignal.addEventListener("abort", () => {
    if (hasStarted()) handleStart();
  }, { once: true, signal });

  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      reject(new Error(cancelledErrorMessage));
    }
  });

  return { promise, ac };
};

export const observeMediaRecorderStart = (mr: MediaRecorder) =>
  observeStart({
    target: mr,
    startEvents: ["start"],
    errorEvents: ["error"],
    hasStarted: () => mr.state === "recording",
    getError: () => new Error("MEDIA_RECORDER_START_FAILED"),
    cancelledErrorMessage: "MEDIA_RECORDER_START_CANCELLED",
  });

export const observeAudioPlaybackStart = (audio: HTMLAudioElement) =>
  observeStart({
    target: audio,
    startEvents: ["playing", "timeupdate"],
    errorEvents: ["error"],
    hasStarted: () => !audio.paused,
    getError: () => new Error(audio.error?.message || "AUDIO_PLAYBACK_START_FAILED"),
    cancelledErrorMessage: "AUDIO_PLAYBACK_START_CANCELLED",
  });

export const loadFfmpegCore = async (onMuxProgress: (percent: number) => void) => {
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  ]);

  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    onMuxProgress(Math.max(1, Math.min(99, Math.round((progress || 0) * 100))));
  });

  try {
    await ffmpeg.load({ coreURL, wasmURL });
  } catch (error) {
    ffmpeg.terminate();
    URL.revokeObjectURL(coreURL);
    URL.revokeObjectURL(wasmURL);
    throw error;
  }

  return { ffmpeg, assetUrls: [coreURL, wasmURL] };
};

const cleanupFfmpegFiles = async (ffmpeg: FFmpeg, names: string[]) => {
  await Promise.all(names.map(async (n) => {
    try { await ffmpeg.deleteFile(n); }
    catch (e) { console.warn("清理 ffmpeg 临时文件失败：", n, e); }
  }));
};

export const muxRecordedVideo = async (
  ffmpeg: FFmpeg,
  jobId: number,
  recordedBlob: Blob,
  audioFile: File,
  audioLeadInMs = 0,
) => {
  const ext = getFileExtension(audioFile.name) || ".bin";
  const captureName = `capture-${jobId}.webm`;
  const audioName = `audio-${jobId}${ext}`;
  const outputName = `export-${jobId}.mkv`;
  const offsetSec = Math.max(0, audioLeadInMs) / 1000;
  const offsetArgs = offsetSec > 0.001 ? ["-itsoffset", offsetSec.toFixed(3)] : [];

  try {
    await ffmpeg.writeFile(captureName, await recordedBlob.bytes());
    await ffmpeg.writeFile(audioName, await audioFile.bytes());
    await ffmpeg.exec([
      "-i", captureName, ...offsetArgs, "-i", audioName,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "copy",
      "-shortest", outputName,
    ]);

    const out = await ffmpeg.readFile(outputName);
    if (!(out instanceof Uint8Array)) throw new TypeError("FFmpeg output must be binary data");
    return new Blob([out.slice()], { type: "video/x-matroska" });
  } finally {
    await cleanupFfmpegFiles(ffmpeg, [captureName, audioName, outputName]);
  }
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
};
