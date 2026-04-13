export interface LyricLine {
  time: number;
  text: string;
  isError?: boolean;
}

export interface AppState {
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
  ffmpeg: unknown;
  ffmpegLoadPromise: Promise<unknown> | null;
  ffmpegAssetUrls: string[];
  exportJobCount: number;
  exportEndedAc: AbortController | null;
  lyricLineElements: HTMLElement[];
  lastProgressPercent: string;
  lastProgressValue: string;
  lastTimeText: string;
  lastDurationText: string;
}

export interface AppElements {
  app: HTMLElement;
  audio: HTMLAudioElement;
  exportVideoBtn: HTMLButtonElement;
  exportStatus: HTMLElement;
  cover: HTMLImageElement;
  title: HTMLElement;
  artist: HTMLElement;
  lyricsViewport: HTMLElement;
  lyricsTrack: HTMLElement;
  currentTime: HTMLElement;
  duration: HTMLElement;
  progress: HTMLInputElement;
  panel: HTMLDialogElement;
  titleInput: HTMLInputElement;
  artistInput: HTMLInputElement;
  lrcInput: HTMLTextAreaElement;
  coverInput: HTMLInputElement;
  audioInput: HTMLInputElement;
  fontScaleInput: HTMLInputElement;
  coverScaleInput: HTMLInputElement;
  playBtn: HTMLButtonElement;
  togglePanelBtn: HTMLButtonElement;
  toggleRecordingBtn: HTMLButtonElement;
  loadDemoBtn: HTMLButtonElement;
  resetViewBtn: HTMLButtonElement;
  shortcutsBadge: HTMLElement;
  panelTitle: HTMLElement;
  songTitleLabel: HTMLElement;
  artistLabel: HTMLElement;
  coverLabel: HTMLElement;
  coverPickerLabel: HTMLElement;
  audioLabel: HTMLElement;
  audioPickerLabel: HTMLElement;
  lrcLabel: HTMLElement;
  lrcCalibrationLabel: HTMLElement;
  lrcCalibrationHint: HTMLElement;
  lrcOffsetLabel: HTMLElement;
  lrcOffsetInput: HTMLInputElement;
  lrcOffsetValue: HTMLElement;
  nudgeLrcBackBtn: HTMLButtonElement;
  nudgeLrcForwardBtn: HTMLButtonElement;
  alignCurrentLyricBtn: HTMLButtonElement;
  resetLrcCalibrationBtn: HTMLButtonElement;
  lrcCalibrationStatus: HTMLElement;
  fontScaleLabel: HTMLElement;
  coverScaleLabel: HTMLElement;
  bgDarknessInput: HTMLInputElement;
  bgDarknessLabel: HTMLElement;
  bgBlurInput: HTMLInputElement;
  bgBlurLabel: HTMLElement;
  bgAnimateInput: HTMLInputElement;
  bgAnimateLabel: HTMLElement;
  workflowHint: HTMLElement;
}

export interface TextConstants {
  [key: string]: string;
}

export interface DemoData {
  title: string;
  artist: string;
  lrc: string;
}
