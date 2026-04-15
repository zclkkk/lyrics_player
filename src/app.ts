import type { FFmpeg } from "@ffmpeg/ffmpeg";

import { applyAccent, getDominantColors } from "./color";
import {
  downloadBlob,
  EXPORT_RECORDING_MIME_TYPE,
  loadFfmpegCore,
  muxRecordedVideo,
  observeAudioPlaybackStart,
  observeMediaRecorderStart,
  supportsInlineExport,
} from "./export";
import { parseLrc } from "./lrc";
import { DEMO, TEXT } from "./text";
import type { LyricLine } from "./types";
import { debounce, formatLrcTimestamp, formatSignedMilliseconds, formatTime, getLyricPreview } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: abstract constructor signature requires any[]
const getEl = <T extends Element>(sel: string, type: abstract new (...args: any[]) => T): T => {
  const found = document.querySelector(sel);
  if (!found) throw new Error(`Missing: ${sel}`);
  if (!(found instanceof type)) throw new TypeError(`${sel} is not ${type.name}`);
  return found;
};

const el = {
  app: getEl("#app", HTMLDivElement),
  audio: getEl("#audio", HTMLAudioElement),
  desktopOnlyKicker: getEl("#desktopOnlyKicker", HTMLDivElement),
  desktopOnlyTitle: getEl("#desktopOnlyTitle", HTMLHeadingElement),
  desktopOnlyDescription: getEl("#desktopOnlyDescription", HTMLParagraphElement),
  exportVideoBtn: getEl("#exportVideoBtn", HTMLButtonElement),
  exportStatus: getEl("#exportStatus", HTMLDivElement),
  cover: getEl("#cover", HTMLImageElement),
  eyebrow: getEl("#eyebrow", HTMLDivElement),
  title: getEl("#title", HTMLHeadingElement),
  artist: getEl("#artist", HTMLDivElement),
  lyricsViewport: getEl("#lyricsViewport", HTMLDivElement),
  lyricsTrack: getEl("#lyricsTrack", HTMLDivElement),
  currentTime: getEl("#currentTime", HTMLDivElement),
  duration: getEl("#duration", HTMLDivElement),
  progress: getEl("#progress", HTMLInputElement),
  panel: getEl("#panel", HTMLDialogElement),
  titleInput: getEl("#titleInput", HTMLInputElement),
  artistInput: getEl("#artistInput", HTMLInputElement),
  lrcInput: getEl("#lrcInput", HTMLTextAreaElement),
  coverInput: getEl("#coverInput", HTMLInputElement),
  audioInput: getEl("#audioInput", HTMLInputElement),
  fontScaleInput: getEl("#fontScaleInput", HTMLInputElement),
  coverScaleInput: getEl("#coverScaleInput", HTMLInputElement),
  playBtn: getEl("#playBtn", HTMLButtonElement),
  togglePanelBtn: getEl("#togglePanelBtn", HTMLButtonElement),
  toggleRecordingBtn: getEl("#toggleRecordingBtn", HTMLButtonElement),
  loadDemoBtn: getEl("#loadDemoBtn", HTMLButtonElement),
  resetViewBtn: getEl("#resetViewBtn", HTMLButtonElement),
  shortcutsBadge: getEl("#shortcutsBadge", HTMLDivElement),
  panelTitle: getEl("#panelTitle", HTMLDivElement),
  songTitleLabel: getEl("#songTitleLabel", HTMLLabelElement),
  artistLabel: getEl("#artistLabel", HTMLLabelElement),
  coverLabel: getEl("#coverLabel", HTMLLabelElement),
  coverPickerLabel: getEl("#coverPickerLabel", HTMLLabelElement),
  audioLabel: getEl("#audioLabel", HTMLLabelElement),
  audioPickerLabel: getEl("#audioPickerLabel", HTMLLabelElement),
  lrcLabel: getEl("#lrcLabel", HTMLLabelElement),
  lrcCalibrationLabel: getEl("#lrcCalibrationLabel", HTMLLabelElement),
  lrcCalibrationHint: getEl("#lrcCalibrationHint", HTMLDivElement),
  lrcOffsetLabel: getEl("#lrcOffsetLabel", HTMLLabelElement),
  lrcOffsetInput: getEl("#lrcOffsetInput", HTMLInputElement),
  lrcOffsetValue: getEl("#lrcOffsetValue", HTMLDivElement),
  nudgeLrcBackBtn: getEl("#nudgeLrcBackBtn", HTMLButtonElement),
  nudgeLrcForwardBtn: getEl("#nudgeLrcForwardBtn", HTMLButtonElement),
  alignCurrentLyricBtn: getEl("#alignCurrentLyricBtn", HTMLButtonElement),
  resetLrcCalibrationBtn: getEl("#resetLrcCalibrationBtn", HTMLButtonElement),
  lrcCalibrationStatus: getEl("#lrcCalibrationStatus", HTMLDivElement),
  fontScaleLabel: getEl("#fontScaleLabel", HTMLLabelElement),
  coverScaleLabel: getEl("#coverScaleLabel", HTMLLabelElement),
  bgDarknessInput: getEl("#bgDarknessInput", HTMLInputElement),
  bgDarknessLabel: getEl("#bgDarknessLabel", HTMLLabelElement),
  bgBlurInput: getEl("#bgBlurInput", HTMLInputElement),
  bgBlurLabel: getEl("#bgBlurLabel", HTMLLabelElement),
  bgAnimateInput: getEl("#bgAnimateInput", HTMLInputElement),
  bgAnimateLabel: getEl("#bgAnimateLabel", HTMLSpanElement),
  workflowHint: getEl("#workflowHint", HTMLDivElement),
  bg: getEl(".bg", HTMLDivElement),
} as const;

interface AppState {
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  audioFile: File | null;
  lyrics: LyricLine[];
  originalLyrics: LyricLine[];
  lyricsGlobalOffsetMs: number;
  currentIndex: number;
  recordingMode: boolean;
  panelHidden: boolean;
  objectUrls: string[];
  lastExportUrl: string | null;
  isExporting: boolean;
  isMuxing: boolean;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  displayStream: MediaStream | null;
  shouldSaveExport: boolean;
  exportBaseName: string;
  exportAudioLeadInMs: number;
  pendingRecordingStartAc: AbortController | null;
  pendingPlaybackStartAc: AbortController | null;
  playbackSyncFrame: number;
  ffmpeg: FFmpeg | null;
  ffmpegLoadPromise: Promise<FFmpeg> | null;
  ffmpegAssetUrls: string[];
  exportJobCount: number;
  exportEndedAc: AbortController | null;
  lyricLineElements: HTMLDivElement[];
  lastProgressPercent: string;
  lastProgressValue: string;
  lastTimeText: string;
  lastDurationText: string;
}

const state: AppState = {
  title: TEXT.defaultTitle,
  artist: TEXT.defaultArtist,
  coverUrl: "",
  audioUrl: "",
  audioFile: null,
  lyrics: [],
  originalLyrics: [],
  lyricsGlobalOffsetMs: 0,
  currentIndex: -1,
  recordingMode: false,
  panelHidden: false,
  objectUrls: [],
  lastExportUrl: null,
  isExporting: false,
  isMuxing: false,
  mediaRecorder: null,
  recordedChunks: [],
  displayStream: null,
  shouldSaveExport: false,
  exportBaseName: "",
  exportAudioLeadInMs: 0,
  pendingRecordingStartAc: null,
  pendingPlaybackStartAc: null,
  playbackSyncFrame: 0,
  ffmpeg: null,
  ffmpegLoadPromise: null,
  ffmpegAssetUrls: [],
  exportJobCount: 0,
  exportEndedAc: null,
  lyricLineElements: [],
  lastProgressPercent: "",
  lastProgressValue: "",
  lastTimeText: "",
  lastDurationText: "",
};

const revokeAll = (urls: string[]) => {
  for (const u of urls) URL.revokeObjectURL(u);
};

const isExportBusy = () => state.isExporting || state.isMuxing || !!state.ffmpegLoadPromise;

const setExportStatus = (text: string) => {
  el.exportStatus.textContent = text;
};

const staticTextMap: [keyof typeof el, keyof typeof TEXT][] = [
  ["desktopOnlyKicker", "desktopOnlyKicker"],
  ["desktopOnlyTitle", "desktopOnlyTitle"],
  ["desktopOnlyDescription", "desktopOnlyDescription"],
  ["togglePanelBtn", "panelButton"],
  ["toggleRecordingBtn", "recordingMode"],
  ["shortcutsBadge", "shortcuts"],
  ["panelTitle", "panelTitle"],
  ["loadDemoBtn", "loadDemo"],
  ["resetViewBtn", "resetView"],
  ["songTitleLabel", "songTitleLabel"],
  ["artistLabel", "artistLabel"],
  ["coverLabel", "coverLabel"],
  ["coverPickerLabel", "coverPicker"],
  ["audioLabel", "audioLabel"],
  ["audioPickerLabel", "audioPicker"],
  ["lrcLabel", "lrcLabel"],
  ["lrcCalibrationLabel", "lrcCalibrationLabel"],
  ["lrcCalibrationHint", "lrcCalibrationHint"],
  ["lrcOffsetLabel", "lrcOffsetLabel"],
  ["nudgeLrcBackBtn", "lrcNudgeBack"],
  ["nudgeLrcForwardBtn", "lrcNudgeForward"],
  ["alignCurrentLyricBtn", "lrcAlignCurrent"],
  ["resetLrcCalibrationBtn", "lrcReset"],
  ["fontScaleLabel", "fontScaleLabel"],
  ["coverScaleLabel", "coverScaleLabel"],
  ["bgDarknessLabel", "bgDarknessLabel"],
  ["bgBlurLabel", "bgBlurLabel"],
  ["bgAnimateLabel", "bgAnimateLabel"],
  ["playBtn", "playPause"],
  ["exportVideoBtn", "exportButton"],
  ["workflowHint", "workflowHint"],
  ["eyebrow", "nowPlayingEyebrow"],
  ["lrcCalibrationStatus", "lrcCalibrationEmpty"],
];

const applyStaticText = () => {
  document.title = TEXT.pageTitle;
  for (const [k, t] of staticTextMap) el[k].textContent = TEXT[t];
  el.lrcInput.placeholder = TEXT.lrcPlaceholder;
  el.cover.alt = TEXT.coverAlt;
  setExportStatus(TEXT.exportIdleHint);
};

const revokeObjectUrls = () => {
  revokeAll(state.objectUrls);
  state.objectUrls = [];
};

const revokeTrackedObjectUrl = (url: string) => {
  if (!url.startsWith("blob:")) {
    return;
  }

  URL.revokeObjectURL(url);
  state.objectUrls = state.objectUrls.filter((trackedUrl) => trackedUrl !== url);
};

const revokeFfmpegAssetUrls = () => {
  revokeAll(state.ffmpegAssetUrls);
  state.ffmpegAssetUrls = [];
};

const createTrackedObjectUrl = (file: Blob) => {
  const objectUrl = URL.createObjectURL(file);
  state.objectUrls.push(objectUrl);
  return objectUrl;
};

const applyLyricsData = (lyrics: LyricLine[]) => {
  state.originalLyrics = structuredClone(lyrics);
  state.lyrics = structuredClone(lyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
};

const getLyricsOffsetSeconds = () => state.lyricsGlobalOffsetMs / 1000;

const getEffectiveLyricTime = (time: number) => time + getLyricsOffsetSeconds();

const getCalibrationAnchorIndex = () => {
  if (state.lyrics.length === 0) {
    return -1;
  }

  if (state.currentIndex >= 0) {
    return state.currentIndex;
  }

  const currentTime = el.audio.currentTime || 0;

  for (const [index, line] of state.lyrics.entries()) {
    if (getEffectiveLyricTime(line.time) >= currentTime) {
      return index;
    }
  }

  return state.lyrics.length - 1;
};

const isLyricCalibrationLocked = () => isExportBusy();

const updateLyricCalibrationUi = () => {
  const hasLyrics = state.lyrics.length > 0;
  const anchorIndex = getCalibrationAnchorIndex();
  const anchorLine = anchorIndex >= 0 ? state.lyrics[anchorIndex] : undefined;
  const calibrationLocked = isLyricCalibrationLocked();

  el.lrcOffsetInput.disabled = !hasLyrics || calibrationLocked;
  el.nudgeLrcBackBtn.disabled = !hasLyrics || calibrationLocked;
  el.nudgeLrcForwardBtn.disabled = !hasLyrics || calibrationLocked;
  el.alignCurrentLyricBtn.disabled = !anchorLine || calibrationLocked;
  el.resetLrcCalibrationBtn.disabled = !hasLyrics || calibrationLocked;

  el.lrcOffsetInput.value = String(state.lyricsGlobalOffsetMs);
  el.lrcOffsetValue.textContent = formatSignedMilliseconds(state.lyricsGlobalOffsetMs);

  if (!hasLyrics) {
    el.lrcCalibrationStatus.textContent = TEXT.lrcCalibrationEmpty;
    return;
  }

  if (!anchorLine) {
    el.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 先播放到要校准的那一句。`;
    return;
  }

  el.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 对齐句：${getLyricPreview(anchorLine.text)} · 时间 ${formatLrcTimestamp(getEffectiveLyricTime(anchorLine.time))}`;
};

const updateProgress = () => {
  const currentTime = el.audio.currentTime || 0;
  const duration = el.audio.duration || 0;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const progressPercent = `${progressRatio * 100}%`;

  if (state.lastProgressPercent !== progressPercent) {
    state.lastProgressPercent = progressPercent;
    el.app.style.setProperty("--progress", progressPercent);
  }

  const progressValue = String(Math.round(progressRatio * Number(el.progress.max)));

  if (state.lastProgressValue !== progressValue) {
    state.lastProgressValue = progressValue;
    el.progress.value = progressValue;
  }

  const timeText = formatTime(currentTime);

  if (state.lastTimeText !== timeText) {
    state.lastTimeText = timeText;
    el.currentTime.textContent = timeText;
  }

  const durationText = formatTime(duration);

  if (state.lastDurationText !== durationText) {
    state.lastDurationText = durationText;
    el.duration.textContent = durationText;
  }

  updateLyrics();
};

const syncLyricsUi = ({ rerender = false }: { rerender?: boolean } = {}) => {
  if (rerender) {
    el.lyricsTrack.replaceChildren();

    for (const [i, line] of state.lyrics.entries()) {
      const div = document.createElement("div");
      div.classList.add("lyric-line");
      if (!(line.text || "").trim()) div.classList.add("empty");
      div.textContent = line.text || " ";
      div.dataset.index = String(i);
      el.lyricsTrack.appendChild(div);
    }

    state.lyricLineElements = [...el.lyricsTrack.children] as HTMLDivElement[];
  }

  updateProgress();
};

const applyLyricsText = (text: string) => {
  applyLyricsData(parseLrc(text));
  syncLyricsUi({ rerender: true });
};

const setLyricsGlobalOffset = (nextOffsetMs: string | number) => {
  const clamped = Math.max(-5000, Math.min(5000, Math.round(Number(nextOffsetMs) || 0)));
  state.lyricsGlobalOffsetMs = clamped;
  updateProgress();
};

const shiftLyricsFromIndex = (startIndex: number, deltaSeconds: number) => {
  const anchorLine = state.lyrics[startIndex];

  if (!anchorLine || !Number.isFinite(deltaSeconds)) {
    return;
  }

  let appliedDelta = deltaSeconds;
  let minimumDelta = -anchorLine.time;

  const previousLine = state.lyrics[startIndex - 1];

  if (previousLine) {
    minimumDelta = Math.max(minimumDelta, previousLine.time - anchorLine.time + 0.01);
  }

  appliedDelta = Math.max(appliedDelta, minimumDelta);

  if (Math.abs(appliedDelta) < 0.0005) {
    return;
  }

  state.lyrics = state.lyrics.map((line, index) => {
    if (index < startIndex) {
      return line;
    }

    return {
      ...line,
      time: Math.max(0, line.time + appliedDelta),
    };
  });

  updateProgress();
};

const alignLyricsFromCurrentLine = () => {
  const anchorIndex = getCalibrationAnchorIndex();

  if (anchorIndex < 0) {
    return;
  }

  const anchorLine = state.lyrics[anchorIndex];

  if (!anchorLine) {
    return;
  }

  const currentTime = el.audio.currentTime || 0;
  const displayedTime = getEffectiveLyricTime(anchorLine.time);

  shiftLyricsFromIndex(anchorIndex, currentTime - displayedTime);
};

const resetLyricsCalibration = () => {
  state.lyrics = structuredClone(state.originalLyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
  syncLyricsUi({ rerender: true });
};

const syncTextInputs = () => {
  el.title.textContent = state.title || TEXT.untitledSong;
  el.artist.textContent = state.artist || TEXT.unknownArtist;

  if (el.titleInput.value !== state.title) {
    el.titleInput.value = state.title;
  }

  if (el.artistInput.value !== state.artist) {
    el.artistInput.value = state.artist;
  }
};

const recalcCoverColor = () => {
  if (!state.coverUrl) {
    return;
  }

  const coverUrl = state.coverUrl;
  const probeImage = new Image();

  probeImage.addEventListener(
    "load",
    () => {
      if (state.coverUrl !== coverUrl) {
        return;
      }

      try {
        const { colors } = getDominantColors(probeImage);
        applyAccent(colors);
      } catch (error) {
        console.warn("取色失败，已保留当前配色。", error);
      }
    },
    { once: true },
  );

  probeImage.src = coverUrl;
};

const setCover = (url: string) => {
  if (state.coverUrl && state.coverUrl !== url) {
    revokeTrackedObjectUrl(state.coverUrl);
  }

  state.coverUrl = url;
  el.cover.src = url;

  const cssUrl = url.replace(/[\\"'()]/g, (char) => `\\${char}`);
  el.app.style.setProperty("--bg-image", `url("${cssUrl}")`);
  recalcCoverColor();
};

const setAudio = (url: string, file: File | null = null) => {
  if (state.audioUrl && state.audioUrl !== url) {
    revokeTrackedObjectUrl(state.audioUrl);
  }

  state.audioUrl = url;
  state.audioFile = file;
  el.audio.src = url;
  el.audio.load();
};

const importLyricsText = (text: string) => {
  el.lrcInput.value = text;
  applyLyricsText(text);
};

const isLrcFile = (file: File | null | undefined) => {
  const fileName = String(file?.name || "");
  return fileName.toLowerCase().endsWith(".lrc") || file?.type === "text/plain";
};

const importCoverFile = (file: File | null | undefined) => {
  if (!file?.type.startsWith("image/")) {
    return false;
  }

  setCover(createTrackedObjectUrl(file));
  return true;
};

const importAudioFile = (file: File | null | undefined) => {
  if (!file?.type.startsWith("audio/")) {
    return false;
  }

  setAudio(createTrackedObjectUrl(file), file);
  setExportStatus(TEXT.exportIdleHint);
  return true;
};

const importLrcFile = async (file: File | null | undefined) => {
  if (!file || !isLrcFile(file)) {
    return false;
  }

  importLyricsText(await file.text());
  return true;
};

const importDroppedFile = async (file: File) => {
  if (importCoverFile(file) || importAudioFile(file)) {
    return true;
  }

  return importLrcFile(file);
};

const updateLyrics = (force = false) => {
  const lyricLines = state.lyricLineElements;

  if (!lyricLines.length) {
    updateLyricCalibrationUi();
    return;
  }

  let activeIndex = -1;
  const currentTime = el.audio.currentTime || 0;

  for (const [index, line] of state.lyrics.entries()) {
    if (getEffectiveLyricTime(line.time) <= currentTime) {
      activeIndex = index;
    } else {
      break;
    }
  }

  const previousActiveIndex = state.currentIndex;

  if (!force && activeIndex === previousActiveIndex) {
    updateLyricCalibrationUi();
    return;
  }

  state.currentIndex = activeIndex;

  const indicesToUpdate = new Set([
    previousActiveIndex - 1,
    previousActiveIndex,
    previousActiveIndex + 1,
    activeIndex - 1,
    activeIndex,
    activeIndex + 1,
  ]);

  for (const index of indicesToUpdate) {
    if (index < 0 || index >= lyricLines.length) {
      continue;
    }

    const lineElement = lyricLines[index];

    if (!lineElement) {
      continue;
    }

    lineElement.classList.toggle("active", index === activeIndex);
    lineElement.classList.toggle("near", Math.abs(index - activeIndex) <= 1 && index !== activeIndex);
  }

  const activeLine = activeIndex >= 0 ? lyricLines[activeIndex] : lyricLines[0];

  if (activeLine) {
    const viewportHeight = el.lyricsViewport.clientHeight || el.lyricsTrack.clientHeight;
    const targetOffset = viewportHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;

    el.app.style.setProperty("--lyrics-offset", `${targetOffset}px`);
  }

  updateLyricCalibrationUi();
};

const stopPlaybackSyncLoop = () => {
  if (state.playbackSyncFrame) {
    cancelAnimationFrame(state.playbackSyncFrame);
    state.playbackSyncFrame = 0;
  }
};

const startPlaybackSyncLoop = () => {
  if (state.playbackSyncFrame) {
    return;
  }

  const tick = () => {
    updateProgress();

    if (el.audio.paused || el.audio.ended) {
      state.playbackSyncFrame = 0;
      return;
    }

    state.playbackSyncFrame = requestAnimationFrame(tick);
  };

  state.playbackSyncFrame = requestAnimationFrame(tick);
};

const clearPendingRecordingStart = () => {
  if (state.pendingRecordingStartAc) {
    state.pendingRecordingStartAc.abort();
    state.pendingRecordingStartAc = null;
  }
};

const clearPendingPlaybackStart = () => {
  if (state.pendingPlaybackStartAc) {
    state.pendingPlaybackStartAc.abort();
    state.pendingPlaybackStartAc = null;
  }
};

const clearPendingExportStartObservers = () => {
  clearPendingRecordingStart();
  clearPendingPlaybackStart();
};

const seekByProgressValue = (rawValue: string) => {
  if (state.isExporting) {
    return;
  }

  const max = Number(el.progress.max) || 1000;
  const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));

  if (Number.isFinite(el.audio.duration) && el.audio.duration > 0) {
    el.audio.currentTime = ratio * el.audio.duration;
    updateProgress();
  }
};

const setRecordingMode = (enabled: boolean) => {
  state.recordingMode = enabled;
  document.body.classList.toggle("recording-mode", enabled);
  el.toggleRecordingBtn.textContent = enabled ? TEXT.exitRecordingMode : TEXT.recordingMode;
};

const setPanelHidden = (hidden: boolean) => {
  state.panelHidden = hidden;

  if (hidden) {
    el.panel.close();
  } else {
    el.panel.show();
  }
};

const updateExportUi = () => {
  el.playBtn.disabled = state.isExporting;
  el.progress.disabled = state.isExporting;

  if (state.isExporting) {
    el.exportVideoBtn.disabled = false;
    el.exportVideoBtn.textContent = TEXT.exportStopButton;
    updateLyricCalibrationUi();
    return;
  }

  if (state.ffmpegLoadPromise) {
    el.exportVideoBtn.disabled = true;
    el.exportVideoBtn.textContent = TEXT.exportPreparingButton;
    updateLyricCalibrationUi();
    return;
  }

  if (state.isMuxing) {
    el.exportVideoBtn.disabled = true;
    el.exportVideoBtn.textContent = TEXT.exportMuxingButton;
    updateLyricCalibrationUi();
    return;
  }

  el.exportVideoBtn.disabled = false;
  el.exportVideoBtn.textContent = TEXT.exportButton;
  updateLyricCalibrationUi();
};

const ensureFfmpeg = async () => {
  if (state.ffmpeg) return state.ffmpeg;
  if (!supportsInlineExport()) throw new Error("EXPORT_UNSUPPORTED");

  if (!state.ffmpegLoadPromise) {
    updateExportUi();
    setExportStatus(TEXT.exportPreparingHint);

    state.ffmpegLoadPromise = (async () => {
      try {
        const { ffmpeg, assetUrls } = await loadFfmpegCore((percent) => {
          if (state.isMuxing) {
            setExportStatus(`正在把录制画面与原始音频封装到 MKV… ${percent}%`);
          }
        });
        state.ffmpegAssetUrls = assetUrls;
        state.ffmpeg = ffmpeg;
        return ffmpeg;
      } catch (error) {
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

const releaseDisplayStream = () => {
  if (!state.displayStream) return;
  for (const track of state.displayStream.getTracks()) track.stop();
  state.displayStream = null;
};

const resetExportSession = () => {
  clearPendingExportStartObservers();
  state.mediaRecorder = null;
  state.recordedChunks = [];
  state.shouldSaveExport = false;
  state.exportBaseName = "";
  state.exportAudioLeadInMs = 0;
};

const teardownExportUi = () => {
  state.isExporting = false;
  document.body.classList.remove("is-exporting");
  setRecordingMode(false);
  clearPendingExportStartObservers();
  el.audio.pause();

  if (state.exportEndedAc) {
    state.exportEndedAc.abort();
    state.exportEndedAc = null;
  }

  updateExportUi();
};

const getSafeExportBaseName = () => {
  const rawName = state.title || TEXT.defaultTitle || "lyrics-export";
  const safeName = rawName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return safeName || "lyrics-export";
};

const doDownload = (blob: Blob, filename: string) => {
  if (state.lastExportUrl) URL.revokeObjectURL(state.lastExportUrl);
  state.lastExportUrl = downloadBlob(blob, filename);
};

const loadDemo = () => {
  state.title = DEMO.title;
  state.artist = DEMO.artist;
  el.lrcInput.value = DEMO.lrc;
  syncTextInputs();
  applyLyricsText(DEMO.lrc);

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff7a90" />
          <stop offset="55%" stop-color="#ffb86b" />
          <stop offset="100%" stop-color="#6e9dff" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#gradient)" />
      <circle cx="240" cy="250" r="180" fill="rgba(255,255,255,0.18)" />
      <circle cx="940" cy="900" r="260" fill="rgba(255,255,255,0.12)" />
      <text x="90" y="930" fill="rgba(255,255,255,0.95)" font-size="108" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', sans-serif" font-weight="700">翻唱 Demo</text>
      <text x="96" y="1020" fill="rgba(255,255,255,0.72)" font-size="44" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif">AppleMusic 风格歌词页</text>
    </svg>
  `);

  setCover(`data:image/svg+xml;charset=utf-8,${svg}`);
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  document.body.classList.remove("drag-over");

  if (state.isExporting) {
    return;
  }

  const files = Array.from(event.dataTransfer?.files || []);
  await Promise.allSettled(files.map((file) => importDroppedFile(file)));

  if (files.length === 0) {
    const text = event.dataTransfer?.getData("text/plain");

    if (text) {
      importLyricsText(text);
    }
  }
};

const handleTitleInput = () => {
  state.title = el.titleInput.value;
  syncTextInputs();
};

const handleArtistInput = () => {
  state.artist = el.artistInput.value;
  syncTextInputs();
};

const handleLyricsInput = debounce(() => {
  applyLyricsText(el.lrcInput.value);
}, 300);

const handleCoverUpload = () => {
  const file = el.coverInput.files?.[0];
  el.coverInput.value = "";
  importCoverFile(file);
};

const handleAudioUpload = () => {
  const file = el.audioInput.files?.[0];
  el.audioInput.value = "";
  importAudioFile(file);
};

const handleFontScale = () => {
  const scale = Number(el.fontScaleInput.value) / 100;
  document.documentElement.style.setProperty("--lyrics-scale", String(scale));
  updateLyrics(true);
};

const handleCoverScale = () => {
  const minSlider = Number(el.coverScaleInput.min) || 26;
  const maxSlider = Number(el.coverScaleInput.max) || 42;
  const sliderValue = Number(el.coverScaleInput.value);
  const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
  const coverSize = Math.round(280 + 160 * ratio);

  document.documentElement.style.setProperty("--cover-size", `${coverSize}px`);
};

const handleBgDarkness = () => {
  const value = Number(el.bgDarknessInput.value) / 100;
  document.documentElement.style.setProperty("--bg-darkness", String(value));
};

const handleBgBlur = () => {
  const value = Number(el.bgBlurInput.value);
  document.documentElement.style.setProperty("--bg-blur", `${value}px`);
};

const handleBgAnimate = () => {
  el.bg.classList.toggle("animate", el.bgAnimateInput.checked);
};

const handleLyricsOffsetInput = () => {
  setLyricsGlobalOffset(el.lrcOffsetInput.value);
};

const handleLyricsNudge = (deltaMs: number) => {
  setLyricsGlobalOffset(state.lyricsGlobalOffsetMs + deltaMs);
};

const finalizeRecordedVideo = async () => {
  const requestedSave = state.shouldSaveExport;
  const hasRecordedChunks = state.recordedChunks.length > 0;
  const shouldSave = requestedSave && hasRecordedChunks;
  const recordingMimeType = state.recordedChunks[0]?.type || EXPORT_RECORDING_MIME_TYPE;

  if (!shouldSave) {
    state.isMuxing = false;
    setExportStatus(requestedSave ? TEXT.exportEmptyCaptureHint : TEXT.exportCancelledHint);
    updateExportUi();
    resetExportSession();
    return;
  }

  const recordedBlob = new Blob(state.recordedChunks, { type: recordingMimeType });
  const exportBaseName = state.exportBaseName || getSafeExportBaseName();
  const audioFile = state.audioFile;
  const audioLeadInMs = state.exportAudioLeadInMs;

  resetExportSession();
  setExportStatus(TEXT.exportMuxingHint);

  try {
    if (!audioFile) {
      throw new Error("EXPORT_AUDIO_FILE_MISSING");
    }

    if (!state.ffmpeg) throw new Error("EXPORT_ENGINE_NOT_READY");
    const muxedBlob = await muxRecordedVideo(
      state.ffmpeg,
      ++state.exportJobCount,
      recordedBlob,
      audioFile,
      audioLeadInMs,
    );
    doDownload(muxedBlob, `${exportBaseName}.mkv`);
    setExportStatus(TEXT.exportDoneHint);
  } catch (error) {
    console.error("Muxing failed, falling back to raw capture:", error);
    doDownload(recordedBlob, `${exportBaseName}-capture.webm`);
    alert(
      error instanceof Error && error.message === "EXPORT_AUDIO_FILE_MISSING"
        ? TEXT.exportRequiresOriginalAudio
        : TEXT.exportMuxFailed,
    );
    setExportStatus(TEXT.exportFallbackHint);
  } finally {
    state.isMuxing = false;
    updateExportUi();
  }
};

const stopExporting = (shouldSave = true) => {
  if (!state.isExporting && !state.mediaRecorder && !state.displayStream) {
    return;
  }

  teardownExportUi();
  state.shouldSaveExport = shouldSave;
  state.isMuxing = shouldSave;
  updateExportUi();
  setExportStatus(shouldSave ? TEXT.exportMuxingHint : TEXT.exportCancelledHint);

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  } else {
    releaseDisplayStream();
    void finalizeRecordedVideo();
    return;
  }

  releaseDisplayStream();
};

const handleExportButtonClick = () => {
  if (state.isExporting) {
    stopExporting();
    return;
  }

  if (state.isMuxing || state.ffmpegLoadPromise) {
    return;
  }

  void startExporting();
};

const startExporting = async () => {
  if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise) {
    return;
  }

  if (!el.audio.src) {
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

    el.audio.pause();
    el.audio.currentTime = 0;

    state.displayStream = videoStream;
    state.recordedChunks = [];
    state.shouldSaveExport = true;
    state.exportAudioLeadInMs = 0;
    state.mediaRecorder = new MediaRecorder(videoStream, { mimeType: EXPORT_RECORDING_MIME_TYPE });

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };

    state.mediaRecorder.onstop = () => {
      void finalizeRecordedVideo();
    };

    videoTrack.onended = () => {
      if (state.isExporting) {
        stopExporting();
      }
    };

    state.isExporting = true;
    document.body.classList.add("is-exporting");
    setRecordingMode(true);
    state.exportBaseName = getSafeExportBaseName();
    updateExportUi();
    setExportStatus(TEXT.exportRecordingHint);

    const recordingStartObserver = observeMediaRecorderStart(state.mediaRecorder);
    state.pendingRecordingStartAc = recordingStartObserver.ac;
    state.mediaRecorder.start(1000);

    try {
      const recordingStartedAt = await recordingStartObserver.promise;
      state.pendingRecordingStartAc = null;

      const playbackStartObserver = observeAudioPlaybackStart(el.audio);
      state.pendingPlaybackStartAc = playbackStartObserver.ac;
      await el.audio.play();
      const playbackStartedAt = await playbackStartObserver.promise;
      state.pendingPlaybackStartAc = null;
      state.exportAudioLeadInMs = Math.max(0, playbackStartedAt - recordingStartedAt);
    } catch (error) {
      clearPendingExportStartObservers();

      if (
        error instanceof Error &&
        ["MEDIA_RECORDER_START_CANCELLED", "AUDIO_PLAYBACK_START_CANCELLED"].includes(error.message) &&
        !state.isExporting
      ) {
        return;
      }

      console.error(
        error instanceof Error && error.message === "MEDIA_RECORDER_START_FAILED"
          ? "Recorder failed to start during export:"
          : "Audio playback failed during export:",
        error,
      );
      stopExporting(false);
      return;
    }

    if (!state.isExporting) {
      return;
    }

    state.exportEndedAc = new AbortController();
    el.audio.addEventListener("ended", () => stopExporting(), {
      once: true,
      signal: state.exportEndedAc.signal,
    });
  } catch (error) {
    console.error("Recording failed or rejected:", error);

    if (state.isExporting || state.mediaRecorder || state.displayStream) {
      stopExporting(false);
    } else {
      updateExportUi();
    }

    if (error instanceof Error && error.message === "EXPORT_UNSUPPORTED") {
      alert(TEXT.exportUnsupported);
      setExportStatus(TEXT.exportUnsupported);
      return;
    }

    if (error instanceof Error && error.message.startsWith("ffmpeg failed to fetch file")) {
      alert(TEXT.exportEngineFailed);
      setExportStatus(TEXT.exportEngineFailed);
      return;
    }

    if (error instanceof DOMException && ["AbortError", "NotAllowedError"].includes(error.name)) {
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

const togglePlayback = async () => {
  if (!el.audio.src || state.isExporting) {
    return;
  }

  if (el.audio.paused) {
    try {
      await el.audio.play();
    } catch (error) {
      console.warn(error);
    }

    return;
  }

  el.audio.pause();
};

const bindEvents = () => {
  el.titleInput.addEventListener("input", handleTitleInput);
  el.artistInput.addEventListener("input", handleArtistInput);
  el.lrcInput.addEventListener("input", handleLyricsInput);
  el.coverInput.addEventListener("change", handleCoverUpload);
  el.audioInput.addEventListener("change", handleAudioUpload);
  el.fontScaleInput.addEventListener("input", handleFontScale);
  el.coverScaleInput.addEventListener("input", handleCoverScale);
  el.bgDarknessInput.addEventListener("input", handleBgDarkness);
  el.bgBlurInput.addEventListener("input", handleBgBlur);
  el.bgAnimateInput.addEventListener("change", handleBgAnimate);
  el.lrcOffsetInput.addEventListener("input", handleLyricsOffsetInput);
  el.nudgeLrcBackBtn.addEventListener("click", () => handleLyricsNudge(-100));
  el.nudgeLrcForwardBtn.addEventListener("click", () => handleLyricsNudge(100));
  el.alignCurrentLyricBtn.addEventListener("click", alignLyricsFromCurrentLine);
  el.resetLrcCalibrationBtn.addEventListener("click", resetLyricsCalibration);

  el.playBtn.addEventListener("click", () => {
    void togglePlayback();
  });
  el.exportVideoBtn.addEventListener("click", handleExportButtonClick);
  el.togglePanelBtn.addEventListener("click", () => setPanelHidden(!state.panelHidden));
  el.toggleRecordingBtn.addEventListener("click", () => setRecordingMode(!state.recordingMode));
  el.loadDemoBtn.addEventListener("click", loadDemo);
  el.resetViewBtn.addEventListener("click", () => {
    el.audio.currentTime = 0;
    updateProgress();
    updateLyrics(true);
  });

  el.audio.addEventListener("play", startPlaybackSyncLoop);
  el.audio.addEventListener("pause", () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });
  el.audio.addEventListener("loadedmetadata", updateProgress);
  el.audio.addEventListener("ended", () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });

  el.progress.addEventListener("input", () => {
    seekByProgressValue(el.progress.value);
  });

  window.addEventListener("keydown", (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.code === "Space") {
      if (target instanceof HTMLButtonElement || target instanceof HTMLSelectElement) {
        return;
      }

      if (state.isExporting) {
        return;
      }

      event.preventDefault();
      el.playBtn.click();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      if (state.isExporting) {
        stopExporting();
        return;
      }

      if (state.isMuxing || state.ffmpegLoadPromise) {
        return;
      }

      setRecordingMode(!state.recordingMode);
      return;
    }

    if (event.key === "Escape") {
      if (state.isExporting) {
        stopExporting();
        return;
      }

      if (state.isMuxing || state.ffmpegLoadPromise) {
        return;
      }

      if (state.recordingMode) {
        setRecordingMode(false);
        return;
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      return;
    }

    if (event.key.toLowerCase() === "h") {
      if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise) {
        return;
      }

      setPanelHidden(!state.panelHidden);
      return;
    }

    if (event.key === "ArrowRight") {
      if (state.isExporting) {
        return;
      }

      el.audio.currentTime = Math.min(el.audio.duration || 0, (el.audio.currentTime || 0) + 5);
      updateProgress();
      return;
    }

    if (event.key === "ArrowLeft") {
      if (state.isExporting) {
        return;
      }

      el.audio.currentTime = Math.max(0, (el.audio.currentTime || 0) - 5);
      updateProgress();
    }
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    document.body.classList.add("drag-over");
  });

  window.addEventListener("dragleave", (event) => {
    event.preventDefault();

    if (!event.relatedTarget || (event.clientX === 0 && event.clientY === 0)) {
      document.body.classList.remove("drag-over");
    }
  });

  window.addEventListener("drop", (event) => {
    void handleDrop(event);
  });

  window.addEventListener("beforeunload", () => {
    stopPlaybackSyncLoop();
    clearPendingExportStartObservers();
    revokeObjectUrls();
    revokeFfmpegAssetUrls();

    if (state.ffmpeg) {
      state.ffmpeg.terminate();
    }

    if (state.lastExportUrl) {
      URL.revokeObjectURL(state.lastExportUrl);
    }
  });
};

export const init = () => {
  applyStaticText();
  applyLyricsData([]);
  syncTextInputs();
  bindEvents();
  handleFontScale();
  handleCoverScale();
  handleBgDarkness();
  handleBgBlur();
  loadDemo();
  updateExportUi();
};
