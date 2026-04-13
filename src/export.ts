import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { AppState, AppElements } from "./types";
import { TEXT } from "./text";
import { getFileExtension } from "./utils";

const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
const EXPORT_RECORDING_MIME_TYPE = "video/webm;codecs=vp9";
const EXPORT_START_TIMEOUT_MS = 1200;

export const getFfmpegClass = () => FFmpeg;

export const supportsInlineExport = () =>
  Boolean(navigator.mediaDevices?.getDisplayMedia) &&
  typeof MediaRecorder === "function" &&
  typeof Promise.withResolvers === "function" &&
  typeof AbortSignal.timeout === "function" &&
  Boolean(MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE));

export const createBlobUrlFromRemote = async (url: string, mimeType: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FFMPEG_ASSET_FETCH_FAILED: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
};

export const revokeFfmpegAssetUrls = (state: AppState) => {
  state.ffmpegAssetUrls.forEach((url) => URL.revokeObjectURL(url));
  state.ffmpegAssetUrls = [];
};

export const ensureFfmpeg = async (state: AppState, elements: AppElements, updateExportUi: () => void, setExportStatus: (text: string) => void) => {
  if (state.ffmpeg) {
    return state.ffmpeg;
  }
  if (!supportsInlineExport()) {
    throw new Error("EXPORT_UNSUPPORTED");
  }
  if (!state.ffmpegLoadPromise) {
    updateExportUi();
    setExportStatus(TEXT.exportPreparingHint);
    state.ffmpegLoadPromise = (async () => {
      let ffmpeg: FFmpeg | null = null;
      try {
        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
          toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm")
        ]);
        state.ffmpegAssetUrls = [coreURL, wasmURL];
        ffmpeg = new FFmpeg();
        ffmpeg.on("progress", ({ progress }) => {
          if (!state.isMuxing) {
            return;
          }
          const percent = Math.max(1, Math.min(99, Math.round((progress || 0) * 100)));
          setExportStatus(`正在把录制画面与原始音频封装到 MKV… ${percent}%`);
        });
        await ffmpeg.load({ coreURL, wasmURL });
        state.ffmpeg = ffmpeg;
        return ffmpeg;
      } catch (error) {
        if (ffmpeg) {
          ffmpeg.terminate();
        }
        state.ffmpeg = null;
        revokeFfmpegAssetUrls(state);
        throw error;
      }
    })()
      .finally(() => {
        state.ffmpegLoadPromise = null;
        updateExportUi();
      });
  }
  return state.ffmpegLoadPromise;
};

export const releaseDisplayStream = (state: AppState) => {
  if (state.displayStream) {
    state.displayStream.getTracks().forEach((track) => track.stop());
    state.displayStream = null;
  }
};

export const resetExportSession = (state: AppState) => {
  state.mediaRecorder = null;
  state.recordedChunks = [];
  state.shouldSaveExport = false;
  state.exportBaseName = "";
  state.exportAudioLeadInMs = 0;
};

export const getSafeExportBaseName = (state: AppState) => {
  const rawName = state.title || TEXT.defaultTitle || "lyrics-export";
  const safeName = rawName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return safeName || "lyrics-export";
};

export const downloadBlob = (state: AppState, blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  if (state.lastExportUrl) {
    URL.revokeObjectURL(state.lastExportUrl);
  }
  state.lastExportUrl = url;
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => anchor.remove(), 100);
};

export const cleanupFfmpegFiles = async (ffmpeg: FFmpeg, fileNames: string[]) => {
  await Promise.all(fileNames.map(async (fileName) => {
    try {
      await ffmpeg.deleteFile(fileName);
    } catch (error) {
      console.warn("清理 ffmpeg 临时文件失败：", fileName, error);
    }
  }));
};

export const muxRecordedVideo = async (state: AppState, recordedBlob: Blob, audioFile: File, audioLeadInMs = 0) => {
  if (!state.ffmpeg) {
    throw new Error("EXPORT_ENGINE_NOT_READY");
  }
  if (!audioFile) {
    throw new Error("EXPORT_AUDIO_FILE_MISSING");
  }
  state.exportJobCount += 1;
  const jobId = state.exportJobCount;
  const ffmpeg = state.ffmpeg;
  const audioExtension = getFileExtension(audioFile.name) || ".bin";
  const captureInputName = `capture-${jobId}.webm`;
  const audioInputName = `audio-${jobId}${audioExtension}`;
  const outputName = `export-${jobId}.mkv`;
  const audioOffsetSeconds = Math.max(0, audioLeadInMs) / 1000;
  const audioOffsetArgs = audioOffsetSeconds > 0.001
    ? ["-itsoffset", audioOffsetSeconds.toFixed(3)]
    : [];
  try {
    await ffmpeg.writeFile(captureInputName, new Uint8Array(await recordedBlob.arrayBuffer()));
    await ffmpeg.writeFile(audioInputName, new Uint8Array(await audioFile.arrayBuffer()));
    await ffmpeg.exec([
      "-i", captureInputName,
      ...audioOffsetArgs,
      "-i", audioInputName,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "copy",
      "-shortest",
      outputName
    ]);
    const outputData = await ffmpeg.readFile(outputName);
    return new Blob([outputData], { type: "video/x-matroska" });
  } finally {
    await cleanupFfmpegFiles(ffmpeg, [captureInputName, audioInputName, outputName]);
  }
};

export const observeMediaRecorderStart = (mediaRecorder: MediaRecorder) => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve: resolveStart, reject: rejectStart } = Promise.withResolvers<number>();
  promise.catch(() => {});
  const fallbackSignal = AbortSignal.timeout(EXPORT_START_TIMEOUT_MS);
  let settled = false;
  const finalize = (callback: () => void) => {
    if (settled) return;
    settled = true;
    ac.abort();
    callback();
  };
  const handleStart = () => finalize(() => resolveStart(performance.now()));
  const handleError = () => finalize(() => rejectStart(mediaRecorder.error || new Error("MEDIA_RECORDER_START_FAILED")));
  mediaRecorder.addEventListener("start", handleStart, { signal });
  mediaRecorder.addEventListener("error", handleError, { signal });
  fallbackSignal.addEventListener("abort", () => {
    if (mediaRecorder.state === "recording") {
      handleStart();
    }
  }, { once: true, signal });
  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      rejectStart(new Error("MEDIA_RECORDER_START_CANCELLED"));
    }
  });
  return { promise, ac };
};

export const observeAudioPlaybackStart = (audioElement: HTMLAudioElement) => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve: resolvePlayback, reject: rejectPlayback } = Promise.withResolvers<number>();
  promise.catch(() => {});
  const fallbackSignal = AbortSignal.timeout(EXPORT_START_TIMEOUT_MS);
  let settled = false;
  const finalize = (callback: () => void) => {
    if (settled) return;
    settled = true;
    ac.abort();
    callback();
  };
  const handleStart = () => finalize(() => resolvePlayback(performance.now()));
  const handleError = () => finalize(() => rejectPlayback(audioElement.error || new Error("AUDIO_PLAYBACK_START_FAILED")));
  audioElement.addEventListener("playing", handleStart, { signal });
  audioElement.addEventListener("timeupdate", handleStart, { signal });
  audioElement.addEventListener("error", handleError, { signal });
  fallbackSignal.addEventListener("abort", () => {
    if (!audioElement.paused) handleStart();
  }, { once: true, signal });
  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      rejectPlayback(new Error("AUDIO_PLAYBACK_START_CANCELLED"));
    }
  });
  return { promise, ac };
};

export const clearPendingRecordingStart = (state: AppState) => {
  if (state.pendingRecordingStartAc) {
    state.pendingRecordingStartAc.abort();
    state.pendingRecordingStartAc = null;
  }
};

export const clearPendingPlaybackStart = (state: AppState) => {
  if (state.pendingPlaybackStartAc) {
    state.pendingPlaybackStartAc.abort();
    state.pendingPlaybackStartAc = null;
  }
};

export const clearPendingExportStartObservers = (state: AppState) => {
  clearPendingRecordingStart(state);
  clearPendingPlaybackStart(state);
};

export { EXPORT_RECORDING_MIME_TYPE };
