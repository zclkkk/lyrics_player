import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

import { applyAccent, getDominantColors } from "./color";
import { parseLrc } from "./lrc";
import type { LyricLine } from "./types";
import {
  debounce,
  formatLrcTimestamp,
  formatSignedMilliseconds,
  formatTime,
  getFileExtension,
  getLyricPreview
} from "./utils";

const TEXT = {
  pageTitle: "AppleMusic 风格歌词录制页",
  desktopOnlyKicker: "Desktop Only",
  desktopOnlyTitle: "请使用桌面端打开",
  desktopOnlyDescription: "这个工具现在只为桌面录制工作流设计。请把窗口放宽到至少 1100px，或直接在桌面浏览器中使用。",
  panelButton: "面板",
  recordingMode: "录制模式",
  exitRecordingMode: "退出录制模式",
  shortcuts: "空格 播放 / 暂停 · R 录制模式 · H 隐藏面板",
  panelTitle: "录制控制台",
  loadDemo: "加载示例",
  resetView: "回到开头",
  songTitleLabel: "歌名",
  artistLabel: "歌手 / 署名",
  coverLabel: "封面",
  coverPicker: "选择封面图片",
  audioLabel: "音频",
  audioPicker: "选择音频文件",
  lrcLabel: "LRC 歌词",
  lrcPlaceholder: "粘贴 .lrc 内容，例如：\n[00:00.00]你的翻唱标题\n[00:12.30]第一句歌词",
  lrcCalibrationLabel: "歌词校准",
  lrcCalibrationHint: "整首都快或慢一点时，用整体偏移；从某一句开始偏时，先播放到那句，再点“从当前句起对齐”。",
  lrcOffsetLabel: "整体偏移",
  lrcNudgeBack: "整体 -100 ms",
  lrcNudgeForward: "整体 +100 ms",
  lrcAlignCurrent: "从当前句起对齐",
  lrcReset: "重置校准",
  lrcCalibrationEmpty: "当前 LRC 没有可校准的时间标签。",
  fontScaleLabel: "歌词字号",
  coverScaleLabel: "封面尺寸",
  bgDarknessLabel: "背景深浅",
  bgBlurLabel: "模糊强度",
  bgAnimateLabel: "动态背景呼吸效果",
  playPause: "播放 / 暂停",
  exportButton: "● [BETA]导出视频（保留原音频）",
  exportStopButton: "■ 结束录制并封装",
  exportPreparingButton: "正在准备导出引擎…",
  exportMuxingButton: "正在封装原音频…",
  exportIdleHint: "首次导出会联网加载 FFmpeg 内核（约 31 MB）。",
  exportPreparingHint: "正在联网加载 FFmpeg 内核，首次可能需要几十秒，请稍候。",
  exportPickTabHint: "请在浏览器弹窗中选择当前标签页，确认后开始录制。",
  exportRecordingHint: "正在录制画面；录制结束后会自动把你导入的原始音频封装进 MKV。",
  exportMuxingHint: "正在把录制画面与原始音频封装到同一个 MKV 文件中。",
  exportDoneHint: "导出完成，已下载包含原始音频的 MKV 文件。",
  exportCancelledHint: "已取消导出。",
  exportEmptyCaptureHint: "录制结束过快，未捕获到任何画面，请重试。",
  exportFallbackHint: "原音频封装失败，已回退下载纯画面录制文件。",
  exportRequiresAudio: "请先导入音频文件！",
  exportRequiresOriginalAudio: "请通过文件选择或拖拽导入原始音频后再导出，这样才能保留原音频。",
  exportUnsupported: "当前浏览器不支持网页录屏导出，请改用新版 Chrome / Edge 或 OBS。",
  exportEngineFailed: "导出内核加载失败。请检查网络后重试。",
  exportStartFailed: "一键导出启动失败，请重试，或改用 OBS / 系统录屏。",
  exportMuxFailed: "原音频封装失败，已回退为纯画面录制文件。",
  workflowHint:
    "建议工作流：导入封面、音频、LRC，点播放后切到录制模式，再用 OBS 或系统录屏采集这个页面。拖动底部进度条可以定位到任意时间。",
  nowPlayingEyebrow: "Now Playing",
  coverAlt: "歌曲封面",
  defaultTitle: "你的翻唱作品",
  defaultArtist: "你的名字 / 原唱信息",
  untitledSong: "未命名作品",
  unknownArtist: "未知歌手",
  demoTitle: "夜空中最亮的星（翻唱）",
  demoArtist: "你的名字 · Cover"
} as const;

const demo = {
  title: TEXT.demoTitle,
  artist: TEXT.demoArtist,
  lrc: `[00:00.00]夜空中最亮的星（翻唱）
[00:04.00]你的名字 · Cover
[00:10.40]夜空中最亮的星
[00:15.30]能否听清
[00:20.10]那仰望的人
[00:24.40]心底的孤独和叹息
[00:31.10]夜空中最亮的星
[00:35.90]能否记起
[00:40.60]曾与我同行
[00:45.00]消失在风里的身影
[00:52.00]
[00:56.50]我祈祷拥有一颗透明的心灵
[01:03.00]和会流泪的眼睛
[01:08.30]给我再去相信的勇气
[01:13.80]越过谎言去拥抱你
[01:19.60]每当我找不到存在的意义
[01:26.00]每当我迷失在黑夜里
[01:31.40]夜空中最亮的星
[01:36.00]请指引我靠近你`
} as const satisfies {
  title: string;
  artist: string;
  lrc: string;
};

const FFMPEG_CORE_VERSION = "0.12.15";
const FFMPEG_CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
const EXPORT_RECORDING_MIME_TYPE = "video/webm;codecs=vp9";
const EXPORT_START_TIMEOUT_MS = 1200;

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

type ElementConstructor<T extends Element> = Function & {
  new(): T;
  readonly name: string;
};

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
  lastDurationText: ""
};

const getRequiredElement = <T extends Element>(id: string, type: ElementConstructor<T>) => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  if (!(element instanceof type)) {
    throw new TypeError(`Expected #${id} to be a ${type.name}, got <${element.tagName.toLowerCase()}>.`);
  }

  return element;
};

const getRequiredQuery = <T extends Element>(selector: string, type: ElementConstructor<T>) => {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  if (!(element instanceof type)) {
    throw new TypeError(`Expected ${selector} to be a ${type.name}, got <${element.tagName.toLowerCase()}>.`);
  }

  return element;
};

const elements = {
  app: getRequiredElement("app", HTMLDivElement),
  audio: getRequiredElement("audio", HTMLAudioElement),
  desktopOnlyKicker: getRequiredElement("desktopOnlyKicker", HTMLDivElement),
  desktopOnlyTitle: getRequiredElement("desktopOnlyTitle", HTMLHeadingElement),
  desktopOnlyDescription: getRequiredElement("desktopOnlyDescription", HTMLParagraphElement),
  exportVideoBtn: getRequiredElement("exportVideoBtn", HTMLButtonElement),
  exportStatus: getRequiredElement("exportStatus", HTMLDivElement),
  cover: getRequiredElement("cover", HTMLImageElement),
  eyebrow: getRequiredElement("eyebrow", HTMLDivElement),
  title: getRequiredElement("title", HTMLHeadingElement),
  artist: getRequiredElement("artist", HTMLDivElement),
  lyricsViewport: getRequiredElement("lyricsViewport", HTMLDivElement),
  lyricsTrack: getRequiredElement("lyricsTrack", HTMLDivElement),
  currentTime: getRequiredElement("currentTime", HTMLDivElement),
  duration: getRequiredElement("duration", HTMLDivElement),
  progress: getRequiredElement("progress", HTMLInputElement),
  panel: getRequiredElement("panel", HTMLDialogElement),
  titleInput: getRequiredElement("titleInput", HTMLInputElement),
  artistInput: getRequiredElement("artistInput", HTMLInputElement),
  lrcInput: getRequiredElement("lrcInput", HTMLTextAreaElement),
  coverInput: getRequiredElement("coverInput", HTMLInputElement),
  audioInput: getRequiredElement("audioInput", HTMLInputElement),
  fontScaleInput: getRequiredElement("fontScaleInput", HTMLInputElement),
  coverScaleInput: getRequiredElement("coverScaleInput", HTMLInputElement),
  playBtn: getRequiredElement("playBtn", HTMLButtonElement),
  togglePanelBtn: getRequiredElement("togglePanelBtn", HTMLButtonElement),
  toggleRecordingBtn: getRequiredElement("toggleRecordingBtn", HTMLButtonElement),
  loadDemoBtn: getRequiredElement("loadDemoBtn", HTMLButtonElement),
  resetViewBtn: getRequiredElement("resetViewBtn", HTMLButtonElement),
  shortcutsBadge: getRequiredElement("shortcutsBadge", HTMLDivElement),
  panelTitle: getRequiredElement("panelTitle", HTMLDivElement),
  songTitleLabel: getRequiredElement("songTitleLabel", HTMLLabelElement),
  artistLabel: getRequiredElement("artistLabel", HTMLLabelElement),
  coverLabel: getRequiredElement("coverLabel", HTMLLabelElement),
  coverPickerLabel: getRequiredElement("coverPickerLabel", HTMLLabelElement),
  audioLabel: getRequiredElement("audioLabel", HTMLLabelElement),
  audioPickerLabel: getRequiredElement("audioPickerLabel", HTMLLabelElement),
  lrcLabel: getRequiredElement("lrcLabel", HTMLLabelElement),
  lrcCalibrationLabel: getRequiredElement("lrcCalibrationLabel", HTMLLabelElement),
  lrcCalibrationHint: getRequiredElement("lrcCalibrationHint", HTMLDivElement),
  lrcOffsetLabel: getRequiredElement("lrcOffsetLabel", HTMLLabelElement),
  lrcOffsetInput: getRequiredElement("lrcOffsetInput", HTMLInputElement),
  lrcOffsetValue: getRequiredElement("lrcOffsetValue", HTMLDivElement),
  nudgeLrcBackBtn: getRequiredElement("nudgeLrcBackBtn", HTMLButtonElement),
  nudgeLrcForwardBtn: getRequiredElement("nudgeLrcForwardBtn", HTMLButtonElement),
  alignCurrentLyricBtn: getRequiredElement("alignCurrentLyricBtn", HTMLButtonElement),
  resetLrcCalibrationBtn: getRequiredElement("resetLrcCalibrationBtn", HTMLButtonElement),
  lrcCalibrationStatus: getRequiredElement("lrcCalibrationStatus", HTMLDivElement),
  fontScaleLabel: getRequiredElement("fontScaleLabel", HTMLLabelElement),
  coverScaleLabel: getRequiredElement("coverScaleLabel", HTMLLabelElement),
  bgDarknessInput: getRequiredElement("bgDarknessInput", HTMLInputElement),
  bgDarknessLabel: getRequiredElement("bgDarknessLabel", HTMLLabelElement),
  bgBlurInput: getRequiredElement("bgBlurInput", HTMLInputElement),
  bgBlurLabel: getRequiredElement("bgBlurLabel", HTMLLabelElement),
  bgAnimateInput: getRequiredElement("bgAnimateInput", HTMLInputElement),
  bgAnimateLabel: getRequiredElement("bgAnimateLabel", HTMLSpanElement),
  workflowHint: getRequiredElement("workflowHint", HTMLDivElement),
  bg: getRequiredQuery(".bg", HTMLDivElement)
} as const;

const cloneLyrics = (lyrics: LyricLine[]) => structuredClone(lyrics) as LyricLine[];

const setExportStatus = (text: string) => {
  elements.exportStatus.textContent = text;
};

const applyStaticText = () => {
  document.title = TEXT.pageTitle;
  elements.desktopOnlyKicker.textContent = TEXT.desktopOnlyKicker;
  elements.desktopOnlyTitle.textContent = TEXT.desktopOnlyTitle;
  elements.desktopOnlyDescription.textContent = TEXT.desktopOnlyDescription;
  elements.togglePanelBtn.textContent = TEXT.panelButton;
  elements.toggleRecordingBtn.textContent = TEXT.recordingMode;
  elements.shortcutsBadge.textContent = TEXT.shortcuts;
  elements.panelTitle.textContent = TEXT.panelTitle;
  elements.loadDemoBtn.textContent = TEXT.loadDemo;
  elements.resetViewBtn.textContent = TEXT.resetView;
  elements.songTitleLabel.textContent = TEXT.songTitleLabel;
  elements.artistLabel.textContent = TEXT.artistLabel;
  elements.coverLabel.textContent = TEXT.coverLabel;
  elements.coverPickerLabel.textContent = TEXT.coverPicker;
  elements.audioLabel.textContent = TEXT.audioLabel;
  elements.audioPickerLabel.textContent = TEXT.audioPicker;
  elements.lrcLabel.textContent = TEXT.lrcLabel;
  elements.lrcInput.placeholder = TEXT.lrcPlaceholder;
  elements.lrcCalibrationLabel.textContent = TEXT.lrcCalibrationLabel;
  elements.lrcCalibrationHint.textContent = TEXT.lrcCalibrationHint;
  elements.lrcOffsetLabel.textContent = TEXT.lrcOffsetLabel;
  elements.nudgeLrcBackBtn.textContent = TEXT.lrcNudgeBack;
  elements.nudgeLrcForwardBtn.textContent = TEXT.lrcNudgeForward;
  elements.alignCurrentLyricBtn.textContent = TEXT.lrcAlignCurrent;
  elements.resetLrcCalibrationBtn.textContent = TEXT.lrcReset;
  elements.fontScaleLabel.textContent = TEXT.fontScaleLabel;
  elements.coverScaleLabel.textContent = TEXT.coverScaleLabel;
  elements.bgDarknessLabel.textContent = TEXT.bgDarknessLabel;
  elements.bgBlurLabel.textContent = TEXT.bgBlurLabel;
  elements.bgAnimateLabel.textContent = TEXT.bgAnimateLabel;
  elements.playBtn.textContent = TEXT.playPause;
  elements.exportVideoBtn.textContent = TEXT.exportButton;
  elements.workflowHint.textContent = TEXT.workflowHint;
  elements.eyebrow.textContent = TEXT.nowPlayingEyebrow;
  elements.cover.alt = TEXT.coverAlt;
  elements.lrcCalibrationStatus.textContent = TEXT.lrcCalibrationEmpty;
  setExportStatus(TEXT.exportIdleHint);
};

const revokeObjectUrls = () => {
  for (const url of state.objectUrls) {
    URL.revokeObjectURL(url);
  }

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
  for (const url of state.ffmpegAssetUrls) {
    URL.revokeObjectURL(url);
  }

  state.ffmpegAssetUrls = [];
};

const createTrackedObjectUrl = (file: Blob) => {
  const objectUrl = URL.createObjectURL(file);
  state.objectUrls.push(objectUrl);
  return objectUrl;
};

const applyLyricsData = (lyrics: LyricLine[]) => {
  state.originalLyrics = cloneLyrics(lyrics);
  state.lyrics = cloneLyrics(lyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
};

const getLyricsOffsetSeconds = () => state.lyricsGlobalOffsetMs / 1000;

const getEffectiveLyricTime = (time: number) => (
  Number.isFinite(time) ? time + getLyricsOffsetSeconds() : time
);

const getLyricsValidationMessage = () => (
  state.lyrics.find((line) => line.isError)?.text || ""
);

const hasCalibratableLyrics = () => (
  state.lyrics.some((line) => Number.isFinite(line.time))
);

const getCalibrationAnchorIndex = () => {
  if (!hasCalibratableLyrics()) {
    return -1;
  }

  if (state.currentIndex >= 0) {
    const currentLine = state.lyrics[state.currentIndex];

    if (currentLine && Number.isFinite(currentLine.time)) {
      return state.currentIndex;
    }
  }

  const currentTime = elements.audio.currentTime || 0;

  for (let index = 0; index < state.lyrics.length; index += 1) {
    const line = state.lyrics[index];

    if (!line || !Number.isFinite(line.time)) {
      continue;
    }

    if (getEffectiveLyricTime(line.time) >= currentTime) {
      return index;
    }
  }

  for (let index = state.lyrics.length - 1; index >= 0; index -= 1) {
    const line = state.lyrics[index];

    if (line && Number.isFinite(line.time)) {
      return index;
    }
  }

  return -1;
};

const isLyricCalibrationLocked = () => (
  state.isExporting || state.isMuxing || Boolean(state.ffmpegLoadPromise)
);

const updateLyricCalibrationUi = () => {
  const lyricsValidationMessage = getLyricsValidationMessage();
  const hasTimedLyrics = hasCalibratableLyrics();
  const anchorIndex = getCalibrationAnchorIndex();
  const anchorLine = anchorIndex >= 0 ? state.lyrics[anchorIndex] : undefined;
  const calibrationLocked = isLyricCalibrationLocked();

  elements.lrcOffsetInput.disabled = !hasTimedLyrics || calibrationLocked;
  elements.nudgeLrcBackBtn.disabled = !hasTimedLyrics || calibrationLocked;
  elements.nudgeLrcForwardBtn.disabled = !hasTimedLyrics || calibrationLocked;
  elements.alignCurrentLyricBtn.disabled = !anchorLine || calibrationLocked;
  elements.resetLrcCalibrationBtn.disabled = !hasTimedLyrics || calibrationLocked;

  elements.lrcOffsetInput.value = String(state.lyricsGlobalOffsetMs);
  elements.lrcOffsetValue.textContent = formatSignedMilliseconds(state.lyricsGlobalOffsetMs);

  if (lyricsValidationMessage) {
    elements.lrcCalibrationStatus.textContent = lyricsValidationMessage;
    return;
  }

  if (!hasTimedLyrics) {
    elements.lrcCalibrationStatus.textContent = TEXT.lrcCalibrationEmpty;
    return;
  }

  if (!anchorLine) {
    elements.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 先播放到要校准的那一句。`;
    return;
  }

  elements.lrcCalibrationStatus.textContent =
    `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 对齐句：${getLyricPreview(anchorLine.text)} · 时间 ${formatLrcTimestamp(getEffectiveLyricTime(anchorLine.time))}`;
};

const updateProgress = () => {
  const currentTime = elements.audio.currentTime || 0;
  const duration = elements.audio.duration || 0;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const progressPercent = `${progressRatio * 100}%`;

  if (state.lastProgressPercent !== progressPercent) {
    state.lastProgressPercent = progressPercent;
    elements.app.style.setProperty("--progress", progressPercent);
  }

  const progressValue = String(Math.round(progressRatio * Number(elements.progress.max)));

  if (state.lastProgressValue !== progressValue) {
    state.lastProgressValue = progressValue;
    elements.progress.value = progressValue;
  }

  const timeText = formatTime(currentTime);

  if (state.lastTimeText !== timeText) {
    state.lastTimeText = timeText;
    elements.currentTime.textContent = timeText;
  }

  const durationText = formatTime(duration);

  if (state.lastDurationText !== durationText) {
    state.lastDurationText = durationText;
    elements.duration.textContent = durationText;
  }

  updateLyrics();
};

const syncLyricsUi = ({ rerender = false }: { rerender?: boolean } = {}) => {
  if (rerender) {
    elements.lyricsTrack.replaceChildren();

    state.lyrics.forEach((line, index) => {
      const lineElement = document.createElement("div");
      const hasText = Boolean((line.text || "").trim());
      const lineClassNames = ["lyric-line"];

      if (!hasText) {
        lineClassNames.push("empty");
      }

      if (line.isError) {
        lineClassNames.push("error");
      }

      lineElement.className = lineClassNames.join(" ");
      lineElement.textContent = line.text || " ";
      lineElement.dataset.index = String(index);
      elements.lyricsTrack.appendChild(lineElement);
    });

    state.lyricLineElements = Array.from(
      elements.lyricsTrack.children,
      (child) => child as HTMLDivElement
    );
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

  if (!anchorLine || !Number.isFinite(anchorLine.time) || !Number.isFinite(deltaSeconds)) {
    return;
  }

  let appliedDelta = deltaSeconds;
  let minimumDelta = -anchorLine.time;

  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const previousLine = state.lyrics[index];

    if (!previousLine || !Number.isFinite(previousLine.time)) {
      continue;
    }

    minimumDelta = Math.max(minimumDelta, previousLine.time - anchorLine.time + 0.01);
    break;
  }

  appliedDelta = Math.max(appliedDelta, minimumDelta);

  if (Math.abs(appliedDelta) < 0.0005) {
    return;
  }

  state.lyrics = state.lyrics.map((line, index) => {
    if (index < startIndex || !Number.isFinite(line.time)) {
      return line;
    }

    return {
      ...line,
      time: Math.max(0, line.time + appliedDelta)
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

  const currentTime = elements.audio.currentTime || 0;
  const displayedTime = getEffectiveLyricTime(anchorLine.time);

  shiftLyricsFromIndex(anchorIndex, currentTime - displayedTime);
};

const resetLyricsCalibration = () => {
  state.lyrics = cloneLyrics(state.originalLyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
  syncLyricsUi({ rerender: true });
};

const syncTextInputs = () => {
  elements.title.textContent = state.title || TEXT.untitledSong;
  elements.artist.textContent = state.artist || TEXT.unknownArtist;

  if (elements.titleInput.value !== state.title) {
    elements.titleInput.value = state.title;
  }

  if (elements.artistInput.value !== state.artist) {
    elements.artistInput.value = state.artist;
  }
};

const recalcCoverColor = () => {
  if (!state.coverUrl) {
    return;
  }

  const coverUrl = state.coverUrl;
  const probeImage = new Image();
  probeImage.crossOrigin = "anonymous";

  probeImage.addEventListener("load", () => {
    if (state.coverUrl !== coverUrl) {
      return;
    }

    try {
      const { colors } = getDominantColors(probeImage);
      applyAccent(colors);
    } catch (error) {
      console.warn("取色失败，已保留当前配色。", error);
    }
  }, { once: true });

  probeImage.src = coverUrl;
};

const setCover = (url: string) => {
  if (state.coverUrl && state.coverUrl !== url) {
    revokeTrackedObjectUrl(state.coverUrl);
  }

  state.coverUrl = url;
  elements.cover.src = url;

  const cssUrl = url.replace(/[\\"'()]/g, (char) => `\\${char}`);
  elements.app.style.setProperty("--bg-image", `url("${cssUrl}")`);
  recalcCoverColor();
};

const setAudio = (url: string, file: File | null = null) => {
  if (state.audioUrl && state.audioUrl !== url) {
    revokeTrackedObjectUrl(state.audioUrl);
  }

  state.audioUrl = url;
  state.audioFile = file;
  elements.audio.src = url;
  elements.audio.load();
};

const importLyricsText = (text: string) => {
  elements.lrcInput.value = text;
  applyLyricsText(text);
};

const isLrcFile = (file: File | null | undefined) => {
  const fileName = String(file?.name || "");
  return fileName.toLowerCase().endsWith(".lrc") || file?.type === "text/plain";
};

const importCoverFile = (file: File | null | undefined) => {
  if (!file || !file.type.startsWith("image/")) {
    return false;
  }

  setCover(createTrackedObjectUrl(file));
  return true;
};

const importAudioFile = (file: File | null | undefined) => {
  if (!file || !file.type.startsWith("audio/")) {
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
  const currentTime = elements.audio.currentTime || 0;

  for (let index = 0; index < state.lyrics.length; index += 1) {
    const line = state.lyrics[index];

    if (!line) {
      continue;
    }

    if (getEffectiveLyricTime(line.time) <= currentTime) {
      activeIndex = index;
    } else {
      break;
    }
  }

  const previousActiveIndex = state.currentIndex;

  if (!force && activeIndex === previousActiveIndex) {
    return;
  }

  state.currentIndex = activeIndex;

  const indicesToUpdate = new Set([
    previousActiveIndex - 1,
    previousActiveIndex,
    previousActiveIndex + 1,
    activeIndex - 1,
    activeIndex,
    activeIndex + 1
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
    const viewportHeight = elements.lyricsViewport.clientHeight || elements.lyricsTrack.clientHeight;
    const targetOffset = viewportHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;

    elements.app.style.setProperty("--lyrics-offset", `${targetOffset}px`);
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

    if (elements.audio.paused || elements.audio.ended) {
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

const observeMediaRecorderStart = (mediaRecorder: MediaRecorder) => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  void promise.catch(() => {});
  const fallbackSignal = AbortSignal.timeout(EXPORT_START_TIMEOUT_MS);

  let settled = false;

  const finalize = (callback: () => void) => {
    if (settled) {
      return;
    }

    settled = true;
    ac.abort();
    callback();
  };

  const handleStart = () => finalize(() => resolve(performance.now()));
  const handleError = () => finalize(() => reject(new Error("MEDIA_RECORDER_START_FAILED")));

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
      reject(new Error("MEDIA_RECORDER_START_CANCELLED"));
    }
  });

  return { promise, ac };
};

const observeAudioPlaybackStart = (audioElement: HTMLAudioElement) => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  void promise.catch(() => {});
  const fallbackSignal = AbortSignal.timeout(EXPORT_START_TIMEOUT_MS);

  let settled = false;

  const finalize = (callback: () => void) => {
    if (settled) {
      return;
    }

    settled = true;
    ac.abort();
    callback();
  };

  const handleStart = () => finalize(() => resolve(performance.now()));
  const handleError = () => finalize(() => reject(audioElement.error || new Error("AUDIO_PLAYBACK_START_FAILED")));

  audioElement.addEventListener("playing", handleStart, { signal });
  audioElement.addEventListener("timeupdate", handleStart, { signal });
  audioElement.addEventListener("error", handleError, { signal });

  fallbackSignal.addEventListener("abort", () => {
    if (!audioElement.paused) {
      handleStart();
    }
  }, { once: true, signal });

  signal.addEventListener("abort", () => {
    if (!settled) {
      settled = true;
      reject(new Error("AUDIO_PLAYBACK_START_CANCELLED"));
    }
  });

  return { promise, ac };
};

const seekByProgressValue = (rawValue: string) => {
  if (isPlaybackInteractionLocked()) {
    return;
  }

  const max = Number(elements.progress.max) || 1000;
  const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));

  if (Number.isFinite(elements.audio.duration) && elements.audio.duration > 0) {
    elements.audio.currentTime = ratio * elements.audio.duration;
    updateProgress();
  }
};

const setRecordingMode = (enabled: boolean) => {
  state.recordingMode = enabled;
  document.body.classList.toggle("recording-mode", enabled);
  elements.toggleRecordingBtn.textContent = enabled ? TEXT.exitRecordingMode : TEXT.recordingMode;
};

const setPanelHidden = (hidden: boolean) => {
  state.panelHidden = hidden;

  if (hidden) {
    elements.panel.close();
  } else {
    elements.panel.show();
  }
};

const supportsInlineExport = () => (
  Boolean(navigator.mediaDevices?.getDisplayMedia) &&
  typeof MediaRecorder === "function" &&
  typeof Promise.withResolvers === "function" &&
  typeof AbortSignal.timeout === "function" &&
  Boolean(MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE))
);

const isPlaybackInteractionLocked = () => state.isExporting;

const updateExportUi = () => {
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

const ensureFfmpeg = async () => {
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
  if (state.displayStream) {
    state.displayStream.getTracks().forEach((track) => track.stop());
    state.displayStream = null;
  }
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
  elements.audio.pause();

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

const downloadBlob = (blob: Blob, filename: string) => {
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
  window.setTimeout(() => anchor.remove(), 100);
};

const cleanupFfmpegFiles = async (ffmpeg: FFmpeg, fileNames: string[]) => {
  await Promise.all(fileNames.map(async (fileName) => {
    try {
      await ffmpeg.deleteFile(fileName);
    } catch (error) {
      console.warn("清理 ffmpeg 临时文件失败：", fileName, error);
    }
  }));
};

const muxRecordedVideo = async (
  recordedBlob: Blob,
  audioFile: File,
  audioLeadInMs = 0,
) => {
  if (!state.ffmpeg) {
    throw new Error("EXPORT_ENGINE_NOT_READY");
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

    if (!(outputData instanceof Uint8Array)) {
      throw new TypeError("FFmpeg output must be binary data");
    }

    const outputBuffer = outputData.buffer instanceof ArrayBuffer &&
      outputData.byteOffset === 0 &&
      outputData.byteLength === outputData.buffer.byteLength
      ? outputData.buffer
      : outputData.slice().buffer;

    return new Blob([outputBuffer], { type: "video/x-matroska" });
  } finally {
    await cleanupFfmpegFiles(ffmpeg, [captureInputName, audioInputName, outputName]);
  }
};

const loadDemo = () => {
  state.title = demo.title;
  state.artist = demo.artist;
  elements.lrcInput.value = demo.lrc;
  syncTextInputs();
  applyLyricsText(demo.lrc);

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
  state.title = elements.titleInput.value;
  syncTextInputs();
};

const handleArtistInput = () => {
  state.artist = elements.artistInput.value;
  syncTextInputs();
};

const handleLyricsInput = debounce(() => {
  applyLyricsText(elements.lrcInput.value);
}, 300);

const handleCoverUpload = () => {
  const file = elements.coverInput.files?.[0];
  elements.coverInput.value = "";
  importCoverFile(file);
};

const handleAudioUpload = () => {
  const file = elements.audioInput.files?.[0];
  elements.audioInput.value = "";
  importAudioFile(file);
};

const handleFontScale = () => {
  const scale = Number(elements.fontScaleInput.value) / 100;
  document.documentElement.style.setProperty("--lyrics-scale", String(scale));
  updateLyrics(true);
};

const handleCoverScale = () => {
  const minSlider = 26;
  const maxSlider = 42;
  const minCoverSize = 280;
  const maxCoverSize = 440;
  const sliderValue = Number(elements.coverScaleInput.value);
  const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
  const coverSize = Math.round(minCoverSize + (maxCoverSize - minCoverSize) * ratio);

  document.documentElement.style.setProperty("--cover-size", `${coverSize}px`);
};

const handleBgDarkness = () => {
  const value = Number(elements.bgDarknessInput.value) / 100;
  document.documentElement.style.setProperty("--bg-darkness", String(value));
};

const handleBgBlur = () => {
  const value = Number(elements.bgBlurInput.value);
  document.documentElement.style.setProperty("--bg-blur", `${value}px`);
};

const handleBgAnimate = () => {
  elements.bg.classList.toggle("animate", elements.bgAnimateInput.checked);
};

const handleLyricsOffsetInput = () => {
  setLyricsGlobalOffset(elements.lrcOffsetInput.value);
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

    const muxedBlob = await muxRecordedVideo(recordedBlob, audioFile, audioLeadInMs);
    downloadBlob(muxedBlob, `${exportBaseName}.mkv`);
    setExportStatus(TEXT.exportDoneHint);
  } catch (error) {
    console.error("Muxing failed, falling back to raw capture:", error);
    downloadBlob(recordedBlob, `${exportBaseName}-capture.webm`);
    alert(error instanceof Error && error.message === "EXPORT_AUDIO_FILE_MISSING"
      ? TEXT.exportRequiresOriginalAudio
      : TEXT.exportMuxFailed);
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

  const saveExport = shouldSave !== false;

  teardownExportUi();
  state.shouldSaveExport = saveExport;
  state.isMuxing = saveExport;
  updateExportUi();
  setExportStatus(saveExport ? TEXT.exportMuxingHint : TEXT.exportCancelledHint);

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
      selfBrowserSurface: "include"
    } as DisplayMediaStreamOptions);
    const videoTrack = videoStream.getVideoTracks()[0];

    if (!videoTrack) {
      videoStream.getTracks().forEach((track) => track.stop());
      throw new Error("EXPORT_VIDEO_TRACK_MISSING");
    }

    elements.audio.pause();
    elements.audio.currentTime = 0;

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

      const playbackStartObserver = observeAudioPlaybackStart(elements.audio);
      state.pendingPlaybackStartAc = playbackStartObserver.ac;
      await elements.audio.play();
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
        error
      );
      stopExporting(false);
      return;
    }

    if (!state.isExporting) {
      return;
    }

    state.exportEndedAc = new AbortController();
    elements.audio.addEventListener("ended", () => stopExporting(), {
      once: true,
      signal: state.exportEndedAc.signal
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

    if (
      error instanceof Error &&
      error.message.startsWith("ffmpeg failed to fetch file")
    ) {
      alert(TEXT.exportEngineFailed);
      setExportStatus(TEXT.exportEngineFailed);
      return;
    }

    if (
      error instanceof DOMException &&
      ["AbortError", "NotAllowedError"].includes(error.name)
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

const togglePlayback = async () => {
  if (!elements.audio.src || isPlaybackInteractionLocked()) {
    return;
  }

  if (elements.audio.paused) {
    try {
      await elements.audio.play();
    } catch (error) {
      console.warn(error);
    }

    return;
  }

  elements.audio.pause();
};

const bindEvents = () => {
  elements.titleInput.addEventListener("input", handleTitleInput);
  elements.artistInput.addEventListener("input", handleArtistInput);
  elements.lrcInput.addEventListener("input", handleLyricsInput);
  elements.coverInput.addEventListener("change", handleCoverUpload);
  elements.audioInput.addEventListener("change", handleAudioUpload);
  elements.fontScaleInput.addEventListener("input", handleFontScale);
  elements.coverScaleInput.addEventListener("input", handleCoverScale);
  elements.bgDarknessInput.addEventListener("input", handleBgDarkness);
  elements.bgBlurInput.addEventListener("input", handleBgBlur);
  elements.bgAnimateInput.addEventListener("change", handleBgAnimate);
  elements.lrcOffsetInput.addEventListener("input", handleLyricsOffsetInput);
  elements.nudgeLrcBackBtn.addEventListener("click", () => handleLyricsNudge(-100));
  elements.nudgeLrcForwardBtn.addEventListener("click", () => handleLyricsNudge(100));
  elements.alignCurrentLyricBtn.addEventListener("click", alignLyricsFromCurrentLine);
  elements.resetLrcCalibrationBtn.addEventListener("click", resetLyricsCalibration);

  elements.playBtn.addEventListener("click", () => {
    void togglePlayback();
  });
  elements.exportVideoBtn.addEventListener("click", handleExportButtonClick);
  elements.togglePanelBtn.addEventListener("click", () => setPanelHidden(!state.panelHidden));
  elements.toggleRecordingBtn.addEventListener("click", () => setRecordingMode(!state.recordingMode));
  elements.loadDemoBtn.addEventListener("click", loadDemo);
  elements.resetViewBtn.addEventListener("click", () => {
    elements.audio.currentTime = 0;
    updateProgress();
    updateLyrics(true);
  });

  elements.audio.addEventListener("play", startPlaybackSyncLoop);
  elements.audio.addEventListener("pause", () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });
  elements.audio.addEventListener("loadedmetadata", updateProgress);
  elements.audio.addEventListener("ended", () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });

  elements.progress.addEventListener("input", () => {
    seekByProgressValue(elements.progress.value);
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

      if (isPlaybackInteractionLocked()) {
        return;
      }

      event.preventDefault();
      elements.playBtn.click();
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
      if (isPlaybackInteractionLocked()) {
        return;
      }

      elements.audio.currentTime = Math.min(
        elements.audio.duration || 0,
        (elements.audio.currentTime || 0) + 5
      );
      updateProgress();
      return;
    }

    if (event.key === "ArrowLeft") {
      if (isPlaybackInteractionLocked()) {
        return;
      }

      elements.audio.currentTime = Math.max(0, (elements.audio.currentTime || 0) - 5);
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
