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
  ffmpeg: FFmpeg | null;
  ffmpegLoadPromise: Promise<FFmpeg> | null;
  ffmpegAssetUrls: string[];
  exportJobCount: number;
  exportEndedAc: AbortController | null;
  lyricLineElements: HTMLElement[];
  lastProgressPercent: string;
  lastProgressValue: string;
  lastTimeText: string;
  lastDurationText: string;
}

export interface FFmpegProgressEvent {
  progress: number;
}

export interface FFmpeg {
  on(event: 'progress', callback: (event: FFmpegProgressEvent) => void): void;
  load(options: { coreURL: string; wasmURL: string }): Promise<void>;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  readFile(name: string): Promise<Uint8Array>;
  deleteFile(name: string): Promise<void>;
  exec(args: string[]): Promise<void>;
  terminate(): void;
}

export interface DemoData {
  title: string;
  artist: string;
  lrc: string;
}

export interface TextContent {
  pageTitle: string;
  panelButton: string;
  recordingMode: string;
  exitRecordingMode: string;
  shortcuts: string;
  panelTitle: string;
  loadDemo: string;
  resetView: string;
  songTitleLabel: string;
  artistLabel: string;
  coverLabel: string;
  coverPicker: string;
  audioLabel: string;
  audioPicker: string;
  lrcLabel: string;
  lrcPlaceholder: string;
  lrcCalibrationLabel: string;
  lrcCalibrationHint: string;
  lrcOffsetLabel: string;
  lrcNudgeBack: string;
  lrcNudgeForward: string;
  lrcAlignCurrent: string;
  lrcReset: string;
  lrcCalibrationEmpty: string;
  fontScaleLabel: string;
  coverScaleLabel: string;
  bgDarknessLabel: string;
  bgBlurLabel: string;
  bgAnimateLabel: string;
  playPause: string;
  exportButton: string;
  exportStopButton: string;
  exportPreparingButton: string;
  exportMuxingButton: string;
  exportIdleHint: string;
  exportPreparingHint: string;
  exportPickTabHint: string;
  exportRecordingHint: string;
  exportMuxingHint: string;
  exportDoneHint: string;
  exportCancelledHint: string;
  exportEmptyCaptureHint: string;
  exportFallbackHint: string;
  exportRequiresAudio: string;
  exportRequiresOriginalAudio: string;
  exportUnsupported: string;
  exportEngineFailed: string;
  exportStartFailed: string;
  exportMuxFailed: string;
  workflowHint: string;
  coverAlt: string;
  defaultTitle: string;
  defaultArtist: string;
  untitledSong: string;
  unknownArtist: string;
  demoTitle: string;
  demoArtist: string;
}

export interface DOMElements {
  app: HTMLDivElement;
  audio: HTMLAudioElement;
  exportVideoBtn: HTMLButtonElement;
  exportStatus: HTMLDivElement;
  cover: HTMLImageElement;
  title: HTMLHeadingElement;
  artist: HTMLDivElement;
  lyricsViewport: HTMLDivElement;
  lyricsTrack: HTMLDivElement;
  currentTime: HTMLDivElement;
  duration: HTMLDivElement;
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
  shortcutsBadge: HTMLDivElement;
  panelTitle: HTMLDivElement;
  songTitleLabel: HTMLLabelElement;
  artistLabel: HTMLLabelElement;
  coverLabel: HTMLLabelElement;
  coverPickerLabel: HTMLLabelElement;
  audioLabel: HTMLLabelElement;
  audioPickerLabel: HTMLLabelElement;
  lrcLabel: HTMLLabelElement;
  lrcCalibrationLabel: HTMLLabelElement;
  lrcCalibrationHint: HTMLDivElement;
  lrcOffsetLabel: HTMLLabelElement;
  lrcOffsetInput: HTMLInputElement;
  lrcOffsetValue: HTMLDivElement;
  nudgeLrcBackBtn: HTMLButtonElement;
  nudgeLrcForwardBtn: HTMLButtonElement;
  alignCurrentLyricBtn: HTMLButtonElement;
  resetLrcCalibrationBtn: HTMLButtonElement;
  lrcCalibrationStatus: HTMLDivElement;
  fontScaleLabel: HTMLLabelElement;
  coverScaleLabel: HTMLLabelElement;
  bgDarknessInput: HTMLInputElement;
  bgDarknessLabel: HTMLLabelElement;
  bgBlurInput: HTMLInputElement;
  bgBlurLabel: HTMLLabelElement;
  bgAnimateInput: HTMLInputElement;
  bgAnimateLabel: HTMLSpanElement;
  workflowHint: HTMLDivElement;
}

export type ColorRGB = [number, number, number];

export interface DominantColorsResult {
  colors: ColorRGB[];
}
