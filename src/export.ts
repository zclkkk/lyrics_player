import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import {
  elements,
  setRecordingMode,
  state,
  updateLyricCalibrationUi,
} from "./app";
import { TEXT } from "./text";
import {
  EXPORT_RECORDING_MIME_TYPE,
  EXPORT_START_TIMEOUT_MS,
  FFMPEG_CORE_BASE,
} from "./types";
import { getFileExtension } from "./utils";

const supportsInlineExport = (): boolean =>
  Boolean(navigator.mediaDevices?.getDisplayMedia) &&
  typeof MediaRecorder === "function" &&
  typeof Promise.withResolvers === "function" &&
  typeof AbortSignal.timeout === "function" &&
  Boolean(MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE));

const isPlaybackInteractionLocked = (): boolean => state.isExporting;

export const setExportStatus = (text: string): void => {
  elements.exportStatus.textContent = text;
};

export const updateExportUi = (): void => {
  const playbackInteractionLocked = isPlaybackInteractionLocked();
  elements.playBtn.disabled = playbackInteractionLocked;
  elements.progress.disabled = playbackInteractionLocked;

  if (state.isExporting) {
    elements.exportVideoBtn.disabled = false;
    elements.exportVideoBtn.textContent = TEXT.exportStopButton;
    updateLyricCalibrationUi();
    return;
  }

  if (state.ffmpegLoadPromise) {
    elements.exportVideoBtn.disabled = true;
    elements.exportVideoBtn.textContent = TEXT.exportPreparingButton;
    updateLyricCalibrationUi();
    return;
  }

  if (state.isMuxing) {
    elements.exportVideoBtn.disabled = true;
    elements.exportVideoBtn.textContent = TEXT.exportMuxingButton;
    updateLyricCalibrationUi();
    return;
  }

  elements.exportVideoBtn.disabled = false;
  elements.exportVideoBtn.textContent = TEXT.exportButton;
  updateLyricCalibrationUi();
};

const revokeFfmpegAssetUrls = (): void => {
  for (const url of state.ffmpegAssetUrls) URL.revokeObjectURL(url);
  state.ffmpegAssetUrls = [];
};

const ensureFfmpeg = async (): Promise<FFmpeg> => {
  if (state.ffmpeg) return state.ffmpeg;

  if (!supportsInlineExport()) throw new Error("EXPORT_UNSUPPORTED");

  if (!state.ffmpegLoadPromise) {
    updateExportUi();
    setExportStatus(TEXT.exportPreparingHint);

    state.ffmpegLoadPromise = (async () => {
      let ffmpeg: FFmpeg | null = null;

      try {
        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
          toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
        ]);

        state.ffmpegAssetUrls = [coreURL, wasmURL];

        ffmpeg = new FFmpeg();
        ffmpeg.on("progress", ({ progress }) => {
          if (!state.isMuxing) return;
          const percent = Math.max(
            1,
            Math.min(99, Math.round((progress || 0) * 100)),
          );
          setExportStatus(`正在把录制画面与原始音频封装到 MKV… ${percent}%`);
        });

        await ffmpeg.load({ coreURL, wasmURL });
        state.ffmpeg = ffmpeg;
        return ffmpeg;
      } catch (error) {
        ffmpeg?.terminate();
        state.ffmpeg = null;
        revokeFfmpegAssetUrls();
        throw error;
      }
    })().finally(() => {
      state.ffmpegLoadPromise = null;
      updateExportUi();
    });
  }

  return state.ffmpegLoadPromise;
};

const releaseDisplayStream = (): void => {
  if (state.displayStream) {
    for (const track of state.displayStream.getTracks()) track.stop();
    state.displayStream = null;
  }
};

const clearPendingRecordingStart = (): void => {
  state.pendingRecordingStartAc?.abort();
  state.pendingRecordingStartAc = null;
};

const clearPendingPlaybackStart = (): void => {
  state.pendingPlaybackStartAc?.abort();
  state.pendingPlaybackStartAc = null;
};

const clearPendingExportStartObservers = (): void => {
  clearPendingRecordingStart();
  clearPendingPlaybackStart();
};

const resetExportSession = (): void => {
  clearPendingExportStartObservers();
  state.mediaRecorder = null;
  state.recordedChunks = [];
  state.shouldSaveExport = false;
  state.exportBaseName = "";
  state.exportAudioLeadInMs = 0;
};

const teardownExportUi = (): void => {
  state.isExporting = false;
  document.body.classList.remove("is-exporting");
  setRecordingMode(false);
  clearPendingExportStartObservers();
  elements.audio.pause();
  state.exportEndedAc?.abort();
  state.exportEndedAc = null;
  updateExportUi();
};

const getSafeExportBaseName = (): string => {
  const rawName = state.title || TEXT.defaultTitle || "lyrics-export";
  const safeName = rawName.replace(/[<>:"/\\|?*\p{C}]/gu, "_").trim();
  return safeName || "lyrics-export";
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);

  if (state.lastExportUrl) URL.revokeObjectURL(state.lastExportUrl);
  state.lastExportUrl = url;

  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => anchor.remove(), 100);
};

const cleanupFfmpegFiles = async (
  ffmpeg: FFmpeg,
  fileNames: string[],
): Promise<void> => {
  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        await ffmpeg.deleteFile(fileName);
      } catch {}
    }),
  );
};

const muxRecordedVideo = async (
  recordedBlob: Blob,
  audioFile: File,
  audioLeadInMs = 0,
): Promise<Blob> => {
  if (!state.ffmpeg) throw new Error("EXPORT_ENGINE_NOT_READY");
  if (!audioFile) throw new Error("EXPORT_AUDIO_FILE_MISSING");

  state.exportJobCount += 1;
  const jobId = state.exportJobCount;
  const ffmpeg = state.ffmpeg;
  const audioExtension = getFileExtension(audioFile.name) || ".bin";
  const captureInputName = `capture-${jobId}.webm`;
  const audioInputName = `audio-${jobId}${audioExtension}`;
  const outputName = `export-${jobId}.mkv`;
  const audioOffsetSeconds = Math.max(0, audioLeadInMs) / 1000;
  const audioOffsetArgs =
    audioOffsetSeconds > 0.001
      ? ["-itsoffset", audioOffsetSeconds.toFixed(3)]
      : [];

  try {
    await ffmpeg.writeFile(
      captureInputName,
      new Uint8Array(await recordedBlob.arrayBuffer()),
    );
    await ffmpeg.writeFile(
      audioInputName,
      new Uint8Array(await audioFile.arrayBuffer()),
    );
    await ffmpeg.exec([
      "-i",
      captureInputName,
      ...audioOffsetArgs,
      "-i",
      audioInputName,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-shortest",
      outputName,
    ]);

    const outputData = await ffmpeg.readFile(outputName);
    return new Blob([outputData as BlobPart], { type: "video/x-matroska" });
  } finally {
    await cleanupFfmpegFiles(ffmpeg, [
      captureInputName,
      audioInputName,
      outputName,
    ]);
  }
};

const observeMediaRecorderStart = (
  mediaRecorder: MediaRecorder,
): { promise: Promise<number>; ac: AbortController } => {
  const ac = new AbortController();
  const { signal } = ac;
  const {
    promise,
    resolve: resolveStart,
    reject: rejectStart,
  } = Promise.withResolvers<number>();
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
  const handleError = () =>
    finalize(() => rejectStart(new Error("MEDIA_RECORDER_START_FAILED")));

  mediaRecorder.addEventListener("start", handleStart, { signal });
  mediaRecorder.addEventListener("error", handleError, { signal });
  fallbackSignal.addEventListener(
    "abort",
    () => {
      if (mediaRecorder.state === "recording") handleStart();
    },
    { once: true, signal },
  );

  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      rejectStart(new Error("MEDIA_RECORDER_START_CANCELLED"));
    }
  });

  return { promise, ac };
};

const observeAudioPlaybackStart = (
  audioElement: HTMLAudioElement,
): { promise: Promise<number>; ac: AbortController } => {
  const ac = new AbortController();
  const { signal } = ac;
  const {
    promise,
    resolve: resolvePlayback,
    reject: rejectPlayback,
  } = Promise.withResolvers<number>();
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
  const handleError = () =>
    finalize(() =>
      rejectPlayback(
        audioElement.error || new Error("AUDIO_PLAYBACK_START_FAILED"),
      ),
    );

  audioElement.addEventListener("playing", handleStart, { signal });
  audioElement.addEventListener("timeupdate", handleStart, { signal });
  audioElement.addEventListener("error", handleError, { signal });

  fallbackSignal.addEventListener(
    "abort",
    () => {
      if (!audioElement.paused) handleStart();
    },
    { once: true, signal },
  );

  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      rejectPlayback(new Error("AUDIO_PLAYBACK_START_CANCELLED"));
    }
  });

  return { promise, ac };
};

const finalizeRecordedVideo = async (): Promise<void> => {
  const requestedSave = state.shouldSaveExport;
  const hasRecordedChunks = state.recordedChunks.length > 0;
  const shouldSave = requestedSave && hasRecordedChunks;
  const recordingMimeType =
    state.recordedChunks[0]?.type || EXPORT_RECORDING_MIME_TYPE;

  if (!shouldSave) {
    state.isMuxing = false;
    setExportStatus(
      requestedSave ? TEXT.exportEmptyCaptureHint : TEXT.exportCancelledHint,
    );
    updateExportUi();
    resetExportSession();
    return;
  }

  const recordedBlob = new Blob(state.recordedChunks, {
    type: recordingMimeType,
  });
  const exportBaseName = state.exportBaseName || getSafeExportBaseName();
  const audioFile = state.audioFile;
  const audioLeadInMs = state.exportAudioLeadInMs;
  resetExportSession();
  setExportStatus(TEXT.exportMuxingHint);

  try {
    const muxedBlob = await muxRecordedVideo(
      recordedBlob,
      audioFile!,
      audioLeadInMs,
    );
    downloadBlob(muxedBlob, `${exportBaseName}.mkv`);
    setExportStatus(TEXT.exportDoneHint);
  } catch (error) {
    console.error("Muxing failed, falling back to raw capture:", error);
    downloadBlob(recordedBlob, `${exportBaseName}-capture.webm`);
    alert(
      (error as Error)?.message === "EXPORT_AUDIO_FILE_MISSING"
        ? TEXT.exportRequiresOriginalAudio
        : TEXT.exportMuxFailed,
    );
    setExportStatus(TEXT.exportFallbackHint);
  } finally {
    state.isMuxing = false;
    updateExportUi();
  }
};

export const stopExporting = (shouldSave = true): void => {
  if (!state.isExporting && !state.mediaRecorder && !state.displayStream)
    return;

  const saveExport = shouldSave !== false;

  teardownExportUi();
  state.shouldSaveExport = saveExport;
  state.isMuxing = saveExport;
  updateExportUi();
  setExportStatus(
    saveExport ? TEXT.exportMuxingHint : TEXT.exportCancelledHint,
  );

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  } else {
    releaseDisplayStream();
    void finalizeRecordedVideo();
    return;
  }

  releaseDisplayStream();
};

export const startExporting = async (): Promise<void> => {
  if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise) return;

  if (!elements.audio.src) {
    alert(TEXT.exportRequiresAudio);
    setExportStatus(TEXT.exportRequiresAudio);
    return;
  }

  if (!state.audioFile) {
    alert(TEXT.exportRequiresOriginalAudio);
    setExportStatus(TEXT.exportRequiresOriginalAudio);
    return;
  }

  if (!supportsInlineExport()) {
    alert(TEXT.exportUnsupported);
    setExportStatus(TEXT.exportUnsupported);
    return;
  }

  try {
    await ensureFfmpeg();
    setExportStatus(TEXT.exportPickTabHint);

    const videoStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    } as DisplayMediaStreamOptions);
    const videoTrack = videoStream.getVideoTracks()[0];

    if (!videoTrack) {
      for (const track of videoStream.getTracks()) track.stop();
      throw new Error("EXPORT_VIDEO_TRACK_MISSING");
    }

    elements.audio.pause();
    elements.audio.currentTime = 0;

    state.displayStream = videoStream;
    state.recordedChunks = [];
    state.shouldSaveExport = true;
    state.exportAudioLeadInMs = 0;
    state.mediaRecorder = new MediaRecorder(videoStream, {
      mimeType: EXPORT_RECORDING_MIME_TYPE,
    });

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0)
        state.recordedChunks.push(event.data);
    };

    state.mediaRecorder.onstop = () => {
      void finalizeRecordedVideo();
    };

    videoTrack.onended = () => {
      if (state.isExporting) stopExporting();
    };

    state.isExporting = true;
    document.body.classList.add("is-exporting");
    setRecordingMode(true);
    state.exportBaseName = getSafeExportBaseName();
    updateExportUi();
    setExportStatus(TEXT.exportRecordingHint);

    const recordingStartObserver = observeMediaRecorderStart(
      state.mediaRecorder,
    );
    state.pendingRecordingStartAc = recordingStartObserver.ac;
    state.mediaRecorder.start(1000);

    try {
      const recordingStartedAt = await recordingStartObserver.promise;
      state.pendingRecordingStartAc = null;

      const playbackStartObserver = observeAudioPlaybackStart(elements.audio);
      state.pendingPlaybackStartAc = playbackStartObserver.ac;
      await elements.audio.play();
      const playbackStartedAt = await playbackStartObserver.promise;
      state.pendingPlaybackStartAc = null;
      state.exportAudioLeadInMs = Math.max(
        0,
        playbackStartedAt - recordingStartedAt,
      );
    } catch (error) {
      clearPendingExportStartObservers();
      if (
        [
          "MEDIA_RECORDER_START_CANCELLED",
          "AUDIO_PLAYBACK_START_CANCELLED",
        ].includes((error as Error)?.message) &&
        !state.isExporting
      ) {
        return;
      }
      console.error(
        (error as Error)?.message === "MEDIA_RECORDER_START_FAILED"
          ? "Recorder failed to start during export:"
          : "Audio playback failed during export:",
        error,
      );
      stopExporting(false);
      return;
    }

    if (!state.isExporting) return;

    state.exportEndedAc = new AbortController();
    elements.audio.addEventListener("ended", () => stopExporting(), {
      once: true,
      signal: state.exportEndedAc.signal,
    });
  } catch (err) {
    console.error("Recording failed or rejected:", err);
    if (state.isExporting || state.mediaRecorder || state.displayStream) {
      stopExporting(false);
    } else {
      updateExportUi();
    }
    if ((err as Error)?.message === "EXPORT_UNSUPPORTED") {
      alert(TEXT.exportUnsupported);
      setExportStatus(TEXT.exportUnsupported);
      return;
    }
    if (
      String((err as Error)?.message || "").startsWith(
        "FFMPEG_ASSET_FETCH_FAILED",
      )
    ) {
      alert(TEXT.exportEngineFailed);
      setExportStatus(TEXT.exportEngineFailed);
      return;
    }
    if (
      ["AbortError", "NotAllowedError"].includes((err as Error)?.name ?? "")
    ) {
      setExportStatus(TEXT.exportCancelledHint);
      return;
    }
    if (!state.ffmpeg) {
      alert(TEXT.exportEngineFailed);
      setExportStatus(TEXT.exportEngineFailed);
      return;
    }
    alert(TEXT.exportStartFailed);
    setExportStatus(TEXT.exportStartFailed);
  }
};

export const handleExportButtonClick = (): void => {
  if (state.isExporting) {
    stopExporting();
    return;
  }

  if (state.isMuxing || state.ffmpegLoadPromise) return;

  void startExporting();
};

export const revokeFfmpegAssets = (): void => {
  revokeFfmpegAssetUrls();
  if (state.ffmpeg) {
    state.ffmpeg.terminate();
  }
  if (state.lastExportUrl) {
    URL.revokeObjectURL(state.lastExportUrl);
  }
};
