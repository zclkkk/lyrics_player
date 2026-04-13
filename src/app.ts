import type { AppState, DOMElements, LyricLine } from './types';
import { TEXT, DEMO } from './text';
import { debounce, formatTime, formatSignedMilliseconds, formatLrcTimestamp, getLyricPreview } from './utils';
import { parseLrc } from './lrc';
import { getDominantColors, applyAccent } from './color';
import {
  ensureFfmpeg,
  supportsInlineExport,
  observeMediaRecorderStart,
  observeAudioPlaybackStart,
  muxRecordedVideo,
  terminateFfmpeg,
  EXPORT_RECORDING_MIME_TYPE,
} from './export';

const state: AppState = {
  title: TEXT.defaultTitle,
  artist: TEXT.defaultArtist,
  coverUrl: '',
  audioUrl: '',
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
  exportBaseName: '',
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
  lastProgressPercent: '',
  lastProgressValue: '',
  lastTimeText: '',
  lastDurationText: '',
};

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const elements: DOMElements = {
  app: $('app'),
  audio: $('audio'),
  exportVideoBtn: $('exportVideoBtn'),
  exportStatus: $('exportStatus'),
  cover: $('cover'),
  title: $('title'),
  artist: $('artist'),
  lyricsViewport: $('lyricsViewport'),
  lyricsTrack: $('lyricsTrack'),
  currentTime: $('currentTime'),
  duration: $('duration'),
  progress: $('progress'),
  panel: $('panel'),
  titleInput: $('titleInput'),
  artistInput: $('artistInput'),
  lrcInput: $('lrcInput'),
  coverInput: $('coverInput'),
  audioInput: $('audioInput'),
  fontScaleInput: $('fontScaleInput'),
  coverScaleInput: $('coverScaleInput'),
  playBtn: $('playBtn'),
  togglePanelBtn: $('togglePanelBtn'),
  toggleRecordingBtn: $('toggleRecordingBtn'),
  loadDemoBtn: $('loadDemoBtn'),
  resetViewBtn: $('resetViewBtn'),
  shortcutsBadge: $('shortcutsBadge'),
  panelTitle: $('panelTitle'),
  songTitleLabel: $('songTitleLabel'),
  artistLabel: $('artistLabel'),
  coverLabel: $('coverLabel'),
  coverPickerLabel: $('coverPickerLabel'),
  audioLabel: $('audioLabel'),
  audioPickerLabel: $('audioPickerLabel'),
  lrcLabel: $('lrcLabel'),
  lrcCalibrationLabel: $('lrcCalibrationLabel'),
  lrcCalibrationHint: $('lrcCalibrationHint'),
  lrcOffsetLabel: $('lrcOffsetLabel'),
  lrcOffsetInput: $('lrcOffsetInput'),
  lrcOffsetValue: $('lrcOffsetValue'),
  nudgeLrcBackBtn: $('nudgeLrcBackBtn'),
  nudgeLrcForwardBtn: $('nudgeLrcForwardBtn'),
  alignCurrentLyricBtn: $('alignCurrentLyricBtn'),
  resetLrcCalibrationBtn: $('resetLrcCalibrationBtn'),
  lrcCalibrationStatus: $('lrcCalibrationStatus'),
  fontScaleLabel: $('fontScaleLabel'),
  coverScaleLabel: $('coverScaleLabel'),
  bgDarknessInput: $('bgDarknessInput'),
  bgDarknessLabel: $('bgDarknessLabel'),
  bgBlurInput: $('bgBlurInput'),
  bgBlurLabel: $('bgBlurLabel'),
  bgAnimateInput: $('bgAnimateInput'),
  bgAnimateLabel: $('bgAnimateLabel'),
  workflowHint: $('workflowHint'),
};

const applyStaticText = () => {
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

const revokeObjectUrls = () => {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
};

const revokeTrackedObjectUrl = (url: string) => {
  if (!url || !url.startsWith('blob:')) return;
  URL.revokeObjectURL(url);
  state.objectUrls = state.objectUrls.filter((trackedUrl) => trackedUrl !== url);
};

const createTrackedObjectUrl = (file: File): string => {
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

const syncLyricsUi = ({ rerender = false } = {}) => {
  if (rerender) {
    elements.lyricsTrack.replaceChildren();

    state.lyrics.forEach((line, index) => {
      const lineElement = document.createElement('div');
      const hasText = Boolean((line.text || '').trim());
      const lineClassNames = ['lyric-line'];

      if (!hasText) lineClassNames.push('empty');
      if (line.isError) lineClassNames.push('error');

      lineElement.className = lineClassNames.join(' ');
      lineElement.textContent = line.text || ' ';
      lineElement.dataset.index = String(index);

      elements.lyricsTrack.appendChild(lineElement);
    });

    state.lyricLineElements = Array.from(elements.lyricsTrack.children) as HTMLElement[];
  }

  updateProgress();
};

const applyLyricsText = (text: string) => {
  applyLyricsData(parseLrc(text));
  syncLyricsUi({ rerender: true });
};

const getLyricsOffsetSeconds = () => state.lyricsGlobalOffsetMs / 1000;

const getEffectiveLyricTime = (time: number) =>
  Number.isFinite(time) ? time + getLyricsOffsetSeconds() : time;

const getLyricsValidationMessage = () =>
  state.lyrics.find((line) => line?.isError)?.text || '';

const hasCalibratableLyrics = () => state.lyrics.some((line) => Number.isFinite(line.time));

const getCalibrationAnchorIndex = () => {
  if (!hasCalibratableLyrics()) return -1;

  if (state.currentIndex >= 0) {
    const currentLine = state.lyrics[state.currentIndex];
    if (currentLine && Number.isFinite(currentLine.time)) return state.currentIndex;
  }

  const currentTime = elements.audio.currentTime || 0;

  for (let index = 0; index < state.lyrics.length; index++) {
    const line = state.lyrics[index];
    if (!Number.isFinite(line!.time)) continue;
    if (getEffectiveLyricTime(line!.time) >= currentTime) return index;
  }

  for (let index = state.lyrics.length - 1; index >= 0; index--) {
    if (Number.isFinite(state.lyrics[index]!.time)) return index;
  }

  return -1;
};

const isLyricCalibrationLocked = () =>
  state.isExporting || state.isMuxing || Boolean(state.ffmpegLoadPromise);

const updateLyricCalibrationUi = () => {
  const lyricsValidationMessage = getLyricsValidationMessage();
  const hasTimedLyrics = hasCalibratableLyrics();
  const anchorIndex = getCalibrationAnchorIndex();
  const anchorLine = anchorIndex >= 0 ? state.lyrics[anchorIndex] : null;
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

  elements.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(state.lyricsGlobalOffsetMs)} · 对齐句：${getLyricPreview(anchorLine.text)} · 时间 ${formatLrcTimestamp(getEffectiveLyricTime(anchorLine.time))}`;
};

const setLyricsGlobalOffset = (nextOffsetMs: number) => {
  const clamped = Math.max(-5000, Math.min(5000, Math.round(Number(nextOffsetMs) || 0)));
  state.lyricsGlobalOffsetMs = clamped;
  updateProgress();
};

const shiftLyricsFromIndex = (startIndex: number, deltaSeconds: number) => {
  const anchorLine = state.lyrics[startIndex];

  if (!anchorLine || !Number.isFinite(anchorLine.time) || !Number.isFinite(deltaSeconds)) return;

  let appliedDelta = deltaSeconds;
  let minimumDelta = -anchorLine.time;

  for (let index = startIndex - 1; index >= 0; index--) {
    const previousLine = state.lyrics[index];
    if (!Number.isFinite(previousLine!.time)) continue;
    minimumDelta = Math.max(minimumDelta, previousLine!.time - anchorLine.time + 0.01);
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

const alignLyricsFromCurrentLine = () => {
  const anchorIndex = getCalibrationAnchorIndex();
  if (anchorIndex < 0) return;

  const anchorLine = state.lyrics[anchorIndex];
  const currentTime = elements.audio.currentTime || 0;
  const displayedTime = getEffectiveLyricTime(anchorLine!.time);

  shiftLyricsFromIndex(anchorIndex, currentTime - displayedTime);
};

const resetLyricsCalibration = () => {
  state.lyrics = structuredClone(state.originalLyrics);
  state.lyricsGlobalOffsetMs = 0;
  state.currentIndex = -1;
  syncLyricsUi({ rerender: true });
};

const syncTextInputs = () => {
  elements.title.textContent = state.title || TEXT.untitledSong;
  elements.artist.textContent = state.artist || TEXT.unknownArtist;
  if (elements.titleInput.value !== state.title) elements.titleInput.value = state.title;
  if (elements.artistInput.value !== state.artist) elements.artistInput.value = state.artist;
};

const recalcCoverColor = () => {
  if (!state.coverUrl) return;

  const probeImage = new Image();
  probeImage.crossOrigin = 'anonymous';

  probeImage.onload = () => {
    try {
      const { colors } = getDominantColors(probeImage);
      applyAccent(colors);
    } catch (error) {
      console.warn('取色失败，已保留当前配色。', error);
    }
  };

  probeImage.src = state.coverUrl;
};

const setCover = (url: string) => {
  if (state.coverUrl && state.coverUrl !== url) revokeTrackedObjectUrl(state.coverUrl);

  state.coverUrl = url;
  elements.cover.src = url;
  const cssUrl = url.replace(/[\\"'()]/g, (ch) => `\\${ch}`);
  elements.app.style.setProperty('--bg-image', `url("${cssUrl}")`);
  recalcCoverColor();
};

const setAudio = (url: string, file: File | null = null) => {
  if (state.audioUrl && state.audioUrl !== url) revokeTrackedObjectUrl(state.audioUrl);

  state.audioUrl = url;
  state.audioFile = file;
  elements.audio.src = url;
  elements.audio.load();
};

const importLyricsText = (text: string) => {
  elements.lrcInput.value = text;
  applyLyricsText(text);
};

const isLrcFile = (file: File) => {
  const fileName = String(file?.name || '');
  return fileName.toLowerCase().endsWith('.lrc') || file?.type === 'text/plain';
};

const importCoverFile = (file: File) => {
  if (!file || !file.type.startsWith('image/')) return false;
  setCover(createTrackedObjectUrl(file));
  return true;
};

const importAudioFile = (file: File) => {
  if (!file || !file.type.startsWith('audio/')) return false;
  setAudio(createTrackedObjectUrl(file), file);
  setExportStatus(TEXT.exportIdleHint);
  return true;
};

const importLrcFile = async (file: File) => {
  if (!file || !isLrcFile(file)) return false;
  importLyricsText(await file.text());
  return true;
};

const importDroppedFile = async (file: File) => {
  if (importCoverFile(file) || importAudioFile(file)) return true;
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

  for (let index = 0; index < state.lyrics.length; index++) {
    if (getEffectiveLyricTime(state.lyrics[index]!.time) <= currentTime) activeIndex = index;
    else break;
  }

  if (!force && activeIndex === state.currentIndex) return;

  state.currentIndex = activeIndex;

  lyricLines.forEach((lineElement, index) => {
    lineElement.classList.toggle('active', index === activeIndex);
    lineElement.classList.toggle('near', Math.abs(index - activeIndex) <= 1 && index !== activeIndex);
  });

  const activeLine = activeIndex >= 0 ? lyricLines[activeIndex] : lyricLines[0];

  if (activeLine) {
    const viewportHeight = elements.lyricsViewport?.clientHeight || elements.lyricsTrack.clientHeight;
    const targetOffset = viewportHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;
    elements.app.style.setProperty('--lyrics-offset', `${targetOffset}px`);
  }

  updateLyricCalibrationUi();
};

const updateProgress = () => {
  const currentTime = elements.audio.currentTime || 0;
  const duration = elements.audio.duration || 0;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const progressPercent = `${progressRatio * 100}%`;

  if (state.lastProgressPercent !== progressPercent) {
    state.lastProgressPercent = progressPercent;
    elements.app.style.setProperty('--progress', progressPercent);
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

const stopPlaybackSyncLoop = () => {
  if (state.playbackSyncFrame) {
    cancelAnimationFrame(state.playbackSyncFrame);
    state.playbackSyncFrame = 0;
  }
};

const startPlaybackSyncLoop = () => {
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

const clearPendingExportStartObservers = () => {
  if (state.pendingRecordingStartAc) {
    state.pendingRecordingStartAc.abort();
    state.pendingRecordingStartAc = null;
  }
  if (state.pendingPlaybackStartAc) {
    state.pendingPlaybackStartAc.abort();
    state.pendingPlaybackStartAc = null;
  }
};

const setExportStatus = (text: string) => {
  elements.exportStatus.textContent = text;
};

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
  state.exportBaseName = '';
  state.exportAudioLeadInMs = 0;
};

const teardownExportUi = () => {
  state.isExporting = false;
  document.body.classList.remove('is-exporting');
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
  const rawName = state.title || TEXT.defaultTitle || 'lyrics-export';
  const safeName = rawName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return safeName || 'lyrics-export';
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);

  if (state.lastExportUrl) URL.revokeObjectURL(state.lastExportUrl);

  state.lastExportUrl = url;

  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => anchor.remove(), 100);
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

  if (!audioFile) {
    state.isMuxing = false;
    setExportStatus(TEXT.exportRequiresOriginalAudio);
    updateExportUi();
    resetExportSession();
    return;
  }

  const audioLeadInMs = state.exportAudioLeadInMs;
  resetExportSession();
  setExportStatus(TEXT.exportMuxingHint);

  try {
    const ffmpeg = await ensureFfmpeg((percent) => {
      setExportStatus(`正在把录制画面与原始音频封装到 MKV… ${percent}%`);
    });

    state.exportJobCount++;
    const muxedBlob = await muxRecordedVideo(ffmpeg, recordedBlob, audioFile, audioLeadInMs, state.exportJobCount);
    downloadBlob(muxedBlob, `${exportBaseName}.mkv`);
    setExportStatus(TEXT.exportDoneHint);
  } catch (error) {
    console.error('Muxing failed, falling back to raw capture:', error);
    downloadBlob(recordedBlob, `${exportBaseName}-capture.webm`);
    alert(
      (error as Error)?.message === 'EXPORT_AUDIO_FILE_MISSING'
        ? TEXT.exportRequiresOriginalAudio
        : TEXT.exportMuxFailed
    );
    setExportStatus(TEXT.exportFallbackHint);
  } finally {
    state.isMuxing = false;
    updateExportUi();
  }
};

const stopExporting = (shouldSave = true) => {
  if (!state.isExporting && !state.mediaRecorder && !state.displayStream) return;

  const saveExport = shouldSave !== false;

  teardownExportUi();
  state.shouldSaveExport = saveExport;
  state.isMuxing = saveExport;
  updateExportUi();
  setExportStatus(saveExport ? TEXT.exportMuxingHint : TEXT.exportCancelledHint);

  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  } else {
    releaseDisplayStream();
    void finalizeRecordedVideo();
    return;
  }

  releaseDisplayStream();
};

const startExporting = async () => {
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
      video: { displaySurface: 'browser' },
      audio: false,
    } as DisplayMediaStreamOptions);
    const videoTrack = videoStream.getVideoTracks()[0];

    if (!videoTrack) {
      videoStream.getTracks().forEach((track) => track.stop());
      throw new Error('EXPORT_VIDEO_TRACK_MISSING');
    }

    elements.audio.pause();
    elements.audio.currentTime = 0;

    state.displayStream = videoStream;
    state.recordedChunks = [];
    state.shouldSaveExport = true;
    state.exportAudioLeadInMs = 0;
    state.mediaRecorder = new MediaRecorder(videoStream, { mimeType: EXPORT_RECORDING_MIME_TYPE });

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) state.recordedChunks.push(event.data);
    };

    state.mediaRecorder.onstop = () => {
      void finalizeRecordedVideo();
    };

    videoTrack.onended = () => {
      if (state.isExporting) stopExporting();
    };

    state.isExporting = true;
    document.body.classList.add('is-exporting');
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
        ['MEDIA_RECORDER_START_CANCELLED', 'AUDIO_PLAYBACK_START_CANCELLED'].includes(
          (error as Error)?.message
        ) &&
        !state.isExporting
      ) {
        return;
      }
      console.error(
        (error as Error)?.message === 'MEDIA_RECORDER_START_FAILED'
          ? 'Recorder failed to start during export:'
          : 'Audio playback failed during export:',
        error
      );
      stopExporting(false);
      return;
    }

    if (!state.isExporting) return;

    state.exportEndedAc = new AbortController();
    elements.audio.addEventListener('ended', () => stopExporting(), {
      once: true,
      signal: state.exportEndedAc.signal,
    });
  } catch (err) {
    console.error('Recording failed or rejected:', err);
    if (state.isExporting || state.mediaRecorder || state.displayStream) {
      stopExporting(false);
    } else {
      updateExportUi();
    }
    if ((err as Error)?.message === 'EXPORT_UNSUPPORTED') {
      alert(TEXT.exportUnsupported);
      setExportStatus(TEXT.exportUnsupported);
      return;
    }
    if (String((err as Error)?.message || '').startsWith('FFMPEG_ASSET_FETCH_FAILED')) {
      alert(TEXT.exportEngineFailed);
      setExportStatus(TEXT.exportEngineFailed);
      return;
    }
    if (['AbortError', 'NotAllowedError'].includes((err as Error)?.name || '')) {
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

const handleExportButtonClick = () => {
  if (state.isExporting) {
    stopExporting();
    return;
  }
  if (state.isMuxing || state.ffmpegLoadPromise) return;
  void startExporting();
};

const setRecordingMode = (enabled: boolean) => {
  state.recordingMode = enabled;
  document.body.classList.toggle('recording-mode', enabled);
  elements.toggleRecordingBtn.textContent = enabled ? TEXT.exitRecordingMode : TEXT.recordingMode;
};

const setPanelHidden = (hidden: boolean) => {
  state.panelHidden = hidden;
  if (hidden) elements.panel.close();
  else elements.panel.show();
};

const seekByProgressValue = (rawValue: string) => {
  if (isPlaybackInteractionLocked()) return;

  const max = Number(elements.progress.max) || 1000;
  const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));

  if (Number.isFinite(elements.audio.duration) && elements.audio.duration > 0) {
    elements.audio.currentTime = ratio * elements.audio.duration;
    updateProgress();
  }
};

const togglePlayback = async () => {
  if (!elements.audio.src || isPlaybackInteractionLocked()) return;

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

const loadDemo = () => {
  state.title = DEMO.title;
  state.artist = DEMO.artist;
  elements.lrcInput.value = DEMO.lrc;
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
  document.body.classList.remove('drag-over');
  if (state.isExporting) return;

  const files = Array.from(event.dataTransfer?.files || []);
  await Promise.allSettled(files.map((file) => importDroppedFile(file)));

  if (!files.length) {
    const text = event.dataTransfer?.getData('text/plain');
    if (text) importLyricsText(text);
  }
};

const handleTitleInput = (event: Event) => {
  state.title = (event.target as HTMLInputElement).value;
  syncTextInputs();
};

const handleArtistInput = (event: Event) => {
  state.artist = (event.target as HTMLInputElement).value;
  syncTextInputs();
};

const handleLyricsInput = debounce((event: Event) => {
  applyLyricsText((event.target as HTMLTextAreaElement).value);
}, 300);

const handleCoverUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) importCoverFile(file);
};

const handleAudioUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) importAudioFile(file);
};

const handleFontScale = (event: Event) => {
  const scale = Number((event.target as HTMLInputElement).value) / 100;
  document.documentElement.style.setProperty('--lyrics-scale', String(scale));
  updateLyrics(true);
};

const handleCoverScale = (event: Event) => {
  const minSlider = 26;
  const maxSlider = 42;
  const minCoverSize = 280;
  const maxCoverSize = 440;
  const sliderValue = Number((event.target as HTMLInputElement).value);
  const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
  const coverSize = Math.round(minCoverSize + (maxCoverSize - minCoverSize) * ratio);

  document.documentElement.style.setProperty('--cover-size', `${coverSize}px`);
};

const handleBgDarkness = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value) / 100;
  document.documentElement.style.setProperty('--bg-darkness', String(value));
};

const handleBgBlur = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  document.documentElement.style.setProperty('--bg-blur', `${value}px`);
};

const handleBgAnimate = (event: Event) => {
  const bgElement = document.querySelector('.bg');
  if (bgElement) bgElement.classList.toggle('animate', (event.target as HTMLInputElement).checked);
};

const handleLyricsOffsetInput = (event: Event) => {
  setLyricsGlobalOffset(Number((event.target as HTMLInputElement).value));
};

const handleLyricsNudge = (deltaMs: number) => {
  setLyricsGlobalOffset(state.lyricsGlobalOffsetMs + deltaMs);
};

const bindEvents = () => {
  elements.titleInput.addEventListener('input', handleTitleInput);
  elements.artistInput.addEventListener('input', handleArtistInput);
  elements.lrcInput.addEventListener('input', handleLyricsInput);
  elements.coverInput.addEventListener('change', handleCoverUpload);
  elements.audioInput.addEventListener('change', handleAudioUpload);
  elements.fontScaleInput.addEventListener('input', handleFontScale);
  elements.coverScaleInput.addEventListener('input', handleCoverScale);
  elements.bgDarknessInput.addEventListener('input', handleBgDarkness);
  elements.bgBlurInput.addEventListener('input', handleBgBlur);
  elements.bgAnimateInput.addEventListener('change', handleBgAnimate);
  elements.lrcOffsetInput.addEventListener('input', handleLyricsOffsetInput);
  elements.nudgeLrcBackBtn.addEventListener('click', () => handleLyricsNudge(-100));
  elements.nudgeLrcForwardBtn.addEventListener('click', () => handleLyricsNudge(100));
  elements.alignCurrentLyricBtn.addEventListener('click', alignLyricsFromCurrentLine);
  elements.resetLrcCalibrationBtn.addEventListener('click', resetLyricsCalibration);

  elements.playBtn.addEventListener('click', togglePlayback);
  elements.exportVideoBtn.addEventListener('click', handleExportButtonClick);
  elements.togglePanelBtn.addEventListener('click', () => setPanelHidden(!state.panelHidden));
  elements.toggleRecordingBtn.addEventListener('click', () => setRecordingMode(!state.recordingMode));
  elements.loadDemoBtn.addEventListener('click', loadDemo);
  elements.resetViewBtn.addEventListener('click', () => {
    elements.audio.currentTime = 0;
    updateProgress();
    updateLyrics(true);
  });

  elements.audio.addEventListener('play', startPlaybackSyncLoop);
  elements.audio.addEventListener('pause', () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });
  elements.audio.addEventListener('loadedmetadata', updateProgress);
  elements.audio.addEventListener('ended', () => {
    stopPlaybackSyncLoop();
    updateProgress();
  });

  elements.progress.addEventListener('input', (event) => {
    seekByProgressValue((event.target as HTMLInputElement).value);
  });

  window.addEventListener('keydown', (event) => {
    if (event.target && ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;

    if (event.code === 'Space') {
      if (event.target && ['BUTTON', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;
      if (isPlaybackInteractionLocked()) return;
      event.preventDefault();
      elements.playBtn.click();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      if (state.isExporting) {
        stopExporting();
        return;
      }
      if (state.isMuxing || state.ffmpegLoadPromise) return;
      setRecordingMode(!state.recordingMode);
      return;
    }

    if (event.key === 'Escape') {
      if (state.isExporting) {
        stopExporting();
        return;
      }
      if (state.isMuxing || state.ffmpegLoadPromise) return;
      if (state.recordingMode) {
        setRecordingMode(false);
        return;
      }
      if (document.activeElement && 'blur' in document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
      return;
    }

    if (event.key.toLowerCase() === 'h') {
      if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise) return;
      setPanelHidden(!state.panelHidden);
      return;
    }

    if (event.key === 'ArrowRight') {
      if (isPlaybackInteractionLocked()) return;
      elements.audio.currentTime = Math.min(
        elements.audio.duration || 0,
        (elements.audio.currentTime || 0) + 5
      );
      updateProgress();
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (isPlaybackInteractionLocked()) return;
      elements.audio.currentTime = Math.max(0, (elements.audio.currentTime || 0) - 5);
      updateProgress();
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-over');
  });
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!e.relatedTarget || (e.clientX === 0 && e.clientY === 0)) {
      document.body.classList.remove('drag-over');
    }
  });
  window.addEventListener('drop', handleDrop);

  window.addEventListener('beforeunload', () => {
    stopPlaybackSyncLoop();
    clearPendingExportStartObservers();
    revokeObjectUrls();
    terminateFfmpeg();
    if (state.lastExportUrl) URL.revokeObjectURL(state.lastExportUrl);
  });
};

export const init = () => {
  applyStaticText();
  applyLyricsData([]);
  syncTextInputs();
  bindEvents();
  handleFontScale(new Event('input'));
  handleCoverScale(new Event('input'));
  handleBgDarkness(new Event('input'));
  handleBgBlur(new Event('input'));
  loadDemo();
  updateExportUi();
};
