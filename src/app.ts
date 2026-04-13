import { applyAccent, getDominantColors } from "./color";
import type { LyricLine } from "./lrc";
import { parseLrc } from "./lrc";
import { demo, TEXT } from "./text";
import type { AppElements, AppState } from "./types";
import {
  debounce,
  formatLrcTimestamp,
  formatSignedMilliseconds,
  formatTime,
  getLyricPreview,
} from "./utils";

export const state: AppState = {
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

const $ = (id: string): HTMLElement => document.getElementById(id)!;

export const elements: AppElements = {
  app: $("app") as HTMLDivElement,
  audio: $("audio") as HTMLAudioElement,
  exportVideoBtn: $("exportVideoBtn") as HTMLButtonElement,
  exportStatus: $("exportStatus") as HTMLDivElement,
  cover: $("cover") as HTMLImageElement,
  title: $("title") as HTMLHeadingElement,
  artist: $("artist") as HTMLDivElement,
  lyricsViewport: $("lyricsViewport") as HTMLDivElement,
  lyricsTrack: $("lyricsTrack") as HTMLDivElement,
  currentTime: $("currentTime") as HTMLDivElement,
  duration: $("duration") as HTMLDivElement,
  progress: $("progress") as HTMLInputElement,
  panel: $("panel") as HTMLDialogElement,
  titleInput: $("titleInput") as HTMLInputElement,
  artistInput: $("artistInput") as HTMLInputElement,
  lrcInput: $("lrcInput") as HTMLTextAreaElement,
  coverInput: $("coverInput") as HTMLInputElement,
  audioInput: $("audioInput") as HTMLInputElement,
  fontScaleInput: $("fontScaleInput") as HTMLInputElement,
  coverScaleInput: $("coverScaleInput") as HTMLInputElement,
  playBtn: $("playBtn") as HTMLButtonElement,
  togglePanelBtn: $("togglePanelBtn") as HTMLButtonElement,
  toggleRecordingBtn: $("toggleRecordingBtn") as HTMLButtonElement,
  loadDemoBtn: $("loadDemoBtn") as HTMLButtonElement,
  resetViewBtn: $("resetViewBtn") as HTMLButtonElement,
  shortcutsBadge: $("shortcutsBadge") as HTMLDivElement,
  panelTitle: $("panelTitle") as HTMLDivElement,
  songTitleLabel: $("songTitleLabel") as HTMLLabelElement,
  artistLabel: $("artistLabel") as HTMLLabelElement,
  coverLabel: $("coverLabel") as HTMLLabelElement,
  coverPickerLabel: $("coverPickerLabel") as HTMLLabelElement,
  audioLabel: $("audioLabel") as HTMLLabelElement,
  audioPickerLabel: $("audioPickerLabel") as HTMLLabelElement,
  lrcLabel: $("lrcLabel") as HTMLLabelElement,
  lrcCalibrationLabel: $("lrcCalibrationLabel") as HTMLLabelElement,
  lrcCalibrationHint: $("lrcCalibrationHint") as HTMLDivElement,
  lrcOffsetLabel: $("lrcOffsetLabel") as HTMLLabelElement,
  lrcOffsetInput: $("lrcOffsetInput") as HTMLInputElement,
  lrcOffsetValue: $("lrcOffsetValue") as HTMLDivElement,
  nudgeLrcBackBtn: $("nudgeLrcBackBtn") as HTMLButtonElement,
  nudgeLrcForwardBtn: $("nudgeLrcForwardBtn") as HTMLButtonElement,
  alignCurrentLyricBtn: $("alignCurrentLyricBtn") as HTMLButtonElement,
  resetLrcCalibrationBtn: $("resetLrcCalibrationBtn") as HTMLButtonElement,
  lrcCalibrationStatus: $("lrcCalibrationStatus") as HTMLDivElement,
  fontScaleLabel: $("fontScaleLabel") as HTMLLabelElement,
  coverScaleLabel: $("coverScaleLabel") as HTMLLabelElement,
  bgDarknessInput: $("bgDarknessInput") as HTMLInputElement,
  bgDarknessLabel: $("bgDarknessLabel") as HTMLLabelElement,
  bgBlurInput: $("bgBlurInput") as HTMLInputElement,
  bgBlurLabel: $("bgBlurLabel") as HTMLLabelElement,
  bgAnimateInput: $("bgAnimateInput") as HTMLInputElement,
  bgAnimateLabel: $("bgAnimateLabel") as HTMLSpanElement,
  workflowHint: $("workflowHint") as HTMLDivElement,
};

export const applyStaticText = (): void => {
  document.title = TEXT.pageTitle;
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
  elements.exportStatus.textContent = TEXT.exportIdleHint;
  elements.workflowHint.textContent = TEXT.workflowHint;
  elements.cover.alt = TEXT.coverAlt;
};

const revokeObjectUrls = (): void => {
  for (const url of state.objectUrls) URL.revokeObjectURL(url);
  state.objectUrls = [];
};

export const revokeTrackedObjectUrl = (url: string): void => {
  if (!url?.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
  state.objectUrls = state.objectUrls.filter(
    (trackedUrl) => trackedUrl !== url,
  );
};

const applyLyricsData = (lyrics: LyricLine[]): void => {
  state.originalLyrics = structuredClone(lyrics);
  state.lyrics = structuredClone(lyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
};

export const syncLyricsUi = ({
  rerender = false,
}: {
  rerender?: boolean;
} = {}): void => {
  if (rerender) {
    elements.lyricsTrack.replaceChildren();

    for (const [index, line] of state.lyrics.entries()) {
      const lineElement = document.createElement("div");
      const hasText = Boolean((line.text || "").trim());
      const lineClassNames = ["lyric-line"];

      if (!hasText) lineClassNames.push("empty");
      if (line.isError) lineClassNames.push("error");

      lineElement.className = lineClassNames.join(" ");
      lineElement.textContent = line.text || " ";
      lineElement.dataset.index = String(index);

      elements.lyricsTrack.appendChild(lineElement);
    }

    state.lyricLineElements = Array.from(
      elements.lyricsTrack.children,
    ) as HTMLDivElement[];
  }

  updateProgress();
};

const applyLyricsText = (text: string): void => {
  applyLyricsData(parseLrc(text));
  syncLyricsUi({ rerender: true });
};

export const importLyricsText = (text: string): void => {
  elements.lrcInput.value = text;
  applyLyricsText(text);
};

const getLyricsOffsetSeconds = (): number => state.lyricsGlobalOffsetMs / 1000;

const getEffectiveLyricTime = (time: number): number =>
  Number.isFinite(time) ? time + getLyricsOffsetSeconds() : time;

const getLyricsValidationMessage = (): string =>
  state.lyrics.find((line) => line?.isError)?.text || "";

const hasCalibratableLyrics = (): boolean =>
  state.lyrics.some((line) => Number.isFinite(line.time));

const getCalibrationAnchorIndex = (): number => {
  if (!hasCalibratableLyrics()) return -1;

  if (state.currentIndex >= 0) {
    const currentLine = state.lyrics[state.currentIndex];
    if (currentLine && Number.isFinite(currentLine.time))
      return state.currentIndex;
  }

  const currentTime = elements.audio.currentTime || 0;

  for (let index = 0; index < state.lyrics.length; index += 1) {
    const line = state.lyrics[index]!;
    if (!Number.isFinite(line.time)) continue;
    if (getEffectiveLyricTime(line.time) >= currentTime) return index;
  }

  for (let index = state.lyrics.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(state.lyrics[index]!.time)) return index;
  }

  return -1;
};

const isLyricCalibrationLocked = (): boolean =>
  state.isExporting || state.isMuxing || Boolean(state.ffmpegLoadPromise);

export const updateLyricCalibrationUi = (): void => {
  const lyricsValidationMessage = getLyricsValidationMessage();
  const hasTimedLyrics = hasCalibratableLyrics();
  const anchorIndex = getCalibrationAnchorIndex();
  const anchorLine = anchorIndex >= 0 ? state.lyrics[anchorIndex] : null;
  const calibrationLocked = isLyricCalibrationLocked();

  elements.lrcOffsetInput.disabled = !hasTimedLyrics || calibrationLocked;
  elements.nudgeLrcBackBtn.disabled = !hasTimedLyrics || calibrationLocked;
  elements.nudgeLrcForwardBtn.disabled = !hasTimedLyrics || calibrationLocked;
  elements.alignCurrentLyricBtn.disabled = !anchorLine || calibrationLocked;
  elements.resetLrcCalibrationBtn.disabled =
    !hasTimedLyrics || calibrationLocked;

  elements.lrcOffsetInput.value = String(state.lyricsGlobalOffsetMs);
  elements.lrcOffsetValue.textContent = formatSignedMilliseconds(
    state.lyricsGlobalOffsetMs,
  );

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

  elements.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 对齐句：${getLyricPreview(anchorLine.text)} · 时间 ${formatLrcTimestamp(getEffectiveLyricTime(anchorLine.time))}`;
};

const setLyricsGlobalOffset = (nextOffsetMs: number): void => {
  const clamped = Math.max(
    -5000,
    Math.min(5000, Math.round(Number(nextOffsetMs) || 0)),
  );
  state.lyricsGlobalOffsetMs = clamped;
  updateProgress();
};

export const shiftLyricsFromIndex = (
  startIndex: number,
  deltaSeconds: number,
): void => {
  const anchorLine = state.lyrics[startIndex];

  if (
    !anchorLine ||
    !Number.isFinite(anchorLine.time) ||
    !Number.isFinite(deltaSeconds)
  )
    return;

  let appliedDelta = deltaSeconds;
  let minimumDelta = -anchorLine.time;

  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const previousLine = state.lyrics[index]!;
    if (!Number.isFinite(previousLine.time)) continue;
    minimumDelta = Math.max(
      minimumDelta,
      previousLine.time - anchorLine.time + 0.01,
    );
    break;
  }

  appliedDelta = Math.max(appliedDelta, minimumDelta);

  if (Math.abs(appliedDelta) < 0.0005) return;

  state.lyrics = state.lyrics.map((line, index) => {
    if (index < startIndex || !Number.isFinite(line.time)) return line;
    return { ...line, time: Math.max(0, line.time + appliedDelta) };
  });

  updateProgress();
};

export const alignLyricsFromCurrentLine = (): void => {
  const anchorIndex = getCalibrationAnchorIndex();
  if (anchorIndex < 0) return;

  const anchorLine = state.lyrics[anchorIndex]!;
  const currentTime = elements.audio.currentTime || 0;
  const displayedTime = getEffectiveLyricTime(anchorLine.time);

  shiftLyricsFromIndex(anchorIndex, currentTime - displayedTime);
};

export const resetLyricsCalibration = (): void => {
  state.lyrics = structuredClone(state.originalLyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
  syncLyricsUi({ rerender: true });
};

export const syncTextInputs = (): void => {
  elements.title.textContent = state.title || TEXT.untitledSong;
  elements.artist.textContent = state.artist || TEXT.unknownArtist;
  if (elements.titleInput.value !== state.title)
    elements.titleInput.value = state.title;
  if (elements.artistInput.value !== state.artist)
    elements.artistInput.value = state.artist;
};

const recalcCoverColor = (): void => {
  if (!state.coverUrl) return;

  const probeImage = new Image();
  probeImage.crossOrigin = "anonymous";

  probeImage.onload = () => {
    try {
      const { colors } = getDominantColors(probeImage);
      applyAccent(colors);
    } catch {}
  };

  probeImage.src = state.coverUrl;
};

export const setCover = (url: string): void => {
  if (state.coverUrl && state.coverUrl !== url)
    revokeTrackedObjectUrl(state.coverUrl);

  state.coverUrl = url;
  elements.cover.src = url;
  const cssUrl = url.replace(/[\\"'()]/g, (ch) => `\\${ch}`);
  elements.app.style.setProperty("--bg-image", `url("${cssUrl}")`);
  recalcCoverColor();
};

export const setAudio = (url: string, file: File | null = null): void => {
  if (state.audioUrl && state.audioUrl !== url)
    revokeTrackedObjectUrl(state.audioUrl);

  state.audioUrl = url;
  state.audioFile = file;
  elements.audio.src = url;
  elements.audio.load();
};

const createTrackedObjectUrl = (file: File): string => {
  const objectUrl = URL.createObjectURL(file);
  state.objectUrls.push(objectUrl);
  return objectUrl;
};

const isLrcFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".lrc") || file.type === "text/plain";
};

export const importCoverFile = (file: File | undefined): boolean => {
  if (!file?.type.startsWith("image/")) return false;
  setCover(createTrackedObjectUrl(file));
  return true;
};

export const importAudioFile = (file: File | undefined): boolean => {
  if (!file?.type.startsWith("audio/")) return false;
  setAudio(createTrackedObjectUrl(file), file);
  elements.exportStatus.textContent = TEXT.exportIdleHint;
  return true;
};

const importLrcFile = async (file: File): Promise<boolean> => {
  if (!isLrcFile(file)) return false;
  importLyricsText(await file.text());
  return true;
};

export const importDroppedFile = async (file: File): Promise<boolean> => {
  if (importCoverFile(file) || importAudioFile(file)) return true;
  return importLrcFile(file);
};

export const updateLyrics = (force = false): void => {
  const lyricLines = state.lyricLineElements;

  if (!lyricLines.length) {
    updateLyricCalibrationUi();
    return;
  }

  let activeIndex = -1;
  const currentTime = elements.audio.currentTime || 0;

  for (let index = 0; index < state.lyrics.length; index += 1) {
    if (getEffectiveLyricTime(state.lyrics[index]!.time) <= currentTime) {
      activeIndex = index;
    } else {
      break;
    }
  }

  if (!force && activeIndex === state.currentIndex) return;

  state.currentIndex = activeIndex;

  for (const [index, lineElement] of lyricLines.entries()) {
    lineElement.classList.toggle("active", index === activeIndex);
    lineElement.classList.toggle(
      "near",
      Math.abs(index - activeIndex) <= 1 && index !== activeIndex,
    );
  }

  const activeLine = activeIndex >= 0 ? lyricLines[activeIndex] : lyricLines[0];

  if (activeLine) {
    const viewportHeight =
      elements.lyricsViewport?.clientHeight ||
      elements.lyricsTrack.clientHeight;
    const targetOffset =
      viewportHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;
    elements.app.style.setProperty("--lyrics-offset", `${targetOffset}px`);
  }

  updateLyricCalibrationUi();
};

export const updateProgress = (): void => {
  const currentTime = elements.audio.currentTime || 0;
  const duration = elements.audio.duration || 0;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const progressPercent = `${progressRatio * 100}%`;

  if (state.lastProgressPercent !== progressPercent) {
    state.lastProgressPercent = progressPercent;
    elements.app.style.setProperty("--progress", progressPercent);
  }

  const progressValue = String(
    Math.round(progressRatio * Number(elements.progress.max)),
  );
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

export const stopPlaybackSyncLoop = (): void => {
  if (state.playbackSyncFrame) {
    cancelAnimationFrame(state.playbackSyncFrame);
    state.playbackSyncFrame = 0;
  }
};

export const startPlaybackSyncLoop = (): void => {
  if (state.playbackSyncFrame) return;

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

export const seekByProgressValue = (rawValue: string | number): void => {
  if (state.isExporting) return;

  const max = Number(elements.progress.max) || 1000;
  const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));

  if (Number.isFinite(elements.audio.duration) && elements.audio.duration > 0) {
    elements.audio.currentTime = ratio * elements.audio.duration;
    updateProgress();
  }
};

export const setRecordingMode = (enabled: boolean): void => {
  state.recordingMode = enabled;
  document.body.classList.toggle("recording-mode", enabled);
  elements.toggleRecordingBtn.textContent = enabled
    ? TEXT.exitRecordingMode
    : TEXT.recordingMode;
};

export const setPanelHidden = (hidden: boolean): void => {
  state.panelHidden = hidden;
  if (hidden) {
    elements.panel.close();
  } else {
    elements.panel.show();
  }
};

export const togglePlayback = async (): Promise<void> => {
  if (!elements.audio.src || state.isExporting) return;

  if (elements.audio.paused) {
    try {
      await elements.audio.play();
    } catch {}
    return;
  }

  elements.audio.pause();
};

export const loadDemo = (): void => {
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

export const handleTitleInput = (event: Event): void => {
  state.title = (event.target as HTMLInputElement).value;
  syncTextInputs();
};

export const handleArtistInput = (event: Event): void => {
  state.artist = (event.target as HTMLInputElement).value;
  syncTextInputs();
};

export const handleLyricsInput = debounce((event: Event): void => {
  applyLyricsText((event.target as HTMLTextAreaElement).value);
}, 300);

export const handleCoverUpload = (event: Event): void => {
  const file = (event.target as HTMLInputElement).files?.[0];
  importCoverFile(file);
};

export const handleAudioUpload = (event: Event): void => {
  const file = (event.target as HTMLInputElement).files?.[0];
  importAudioFile(file);
};

export const handleFontScale = (event: Event): void => {
  const scale = Number((event.target as HTMLInputElement).value) / 100;
  document.documentElement.style.setProperty("--lyrics-scale", String(scale));
  updateLyrics(true);
};

export const handleCoverScale = (event: Event): void => {
  const minSlider = 26;
  const maxSlider = 42;
  const minCoverSize = 280;
  const maxCoverSize = 440;
  const sliderValue = Number((event.target as HTMLInputElement).value);
  const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
  const coverSize = Math.round(
    minCoverSize + (maxCoverSize - minCoverSize) * ratio,
  );
  document.documentElement.style.setProperty("--cover-size", `${coverSize}px`);
};

export const handleBgDarkness = (event: Event): void => {
  const value = Number((event.target as HTMLInputElement).value) / 100;
  document.documentElement.style.setProperty("--bg-darkness", String(value));
};

export const handleBgBlur = (event: Event): void => {
  const value = Number((event.target as HTMLInputElement).value);
  document.documentElement.style.setProperty("--bg-blur", `${value}px`);
};

export const handleBgAnimate = (event: Event): void => {
  const bgElement = document.querySelector(".bg");
  if (bgElement)
    bgElement.classList.toggle(
      "animate",
      (event.target as HTMLInputElement).checked,
    );
};

export const handleLyricsOffsetInput = (event: Event): void => {
  setLyricsGlobalOffset(Number((event.target as HTMLInputElement).value));
};

export const handleLyricsNudge = (deltaMs: number): void => {
  setLyricsGlobalOffset(state.lyricsGlobalOffsetMs + deltaMs);
};

export const handleDrop = async (event: DragEvent): Promise<void> => {
  event.preventDefault();
  document.body.classList.remove("drag-over");
  if (state.isExporting) return;

  const files = Array.from(event.dataTransfer?.files || []);

  await Promise.allSettled(files.map((file) => importDroppedFile(file)));

  if (!files.length) {
    const text = event.dataTransfer?.getData("text/plain");
    if (text) importLyricsText(text);
  }
};

export const cleanup = (): void => {
  stopPlaybackSyncLoop();
  revokeObjectUrls();
};
