import { FFmpeg } from '@ffmpeg/ffmpeg';
import { getFileExtension } from './utils';

const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
const EXPORT_RECORDING_MIME_TYPE = 'video/webm;codecs=vp9';
const EXPORT_START_TIMEOUT_MS = 1200;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
let ffmpegAssetUrls: string[] = [];

const getFfmpegClass = (): typeof FFmpeg | null => {
  return FFmpeg;
};

export const supportsInlineExport = (): boolean => {
  return (
    Boolean(navigator.mediaDevices?.getDisplayMedia) &&
    typeof MediaRecorder === 'function' &&
    typeof Promise.withResolvers === 'function' &&
    typeof AbortSignal.timeout === 'function' &&
    Boolean(MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE)) &&
    Boolean(getFfmpegClass())
  );
};

const createBlobUrlFromRemote = async (url: string, mimeType: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FFMPEG_ASSET_FETCH_FAILED: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
};

export const revokeFfmpegAssetUrls = (): void => {
  ffmpegAssetUrls.forEach((url) => URL.revokeObjectURL(url));
  ffmpegAssetUrls = [];
};

export const ensureFfmpeg = async (
  onProgress?: (percent: number) => void
): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;

  if (!supportsInlineExport()) {
    throw new Error('EXPORT_UNSUPPORTED');
  }

  if (!ffmpegLoadPromise) {
    const FFmpegClass = getFfmpegClass()!;

    ffmpegLoadPromise = (async () => {
      try {
        const [coreURL, wasmURL] = await Promise.all([
          createBlobUrlFromRemote(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
          createBlobUrlFromRemote(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);

        ffmpegAssetUrls = [coreURL, wasmURL];

        const ffmpeg = new FFmpegClass();
        ffmpeg.on('progress', ({ progress }) => {
          if (onProgress) {
            const percent = Math.max(1, Math.min(99, Math.round((progress || 0) * 100)));
            onProgress(percent);
          }
        });

        await ffmpeg.load({ coreURL, wasmURL });

        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (error) {
        if (ffmpegInstance) {
          ffmpegInstance.terminate();
        }
        ffmpegInstance = null;
        revokeFfmpegAssetUrls();
        throw error;
      }
    })().finally(() => {
      ffmpegLoadPromise = null;
    });
  }

  return ffmpegLoadPromise;
};

export const terminateFfmpeg = (): void => {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  revokeFfmpegAssetUrls();
};

const cleanupFfmpegFiles = async (ffmpeg: FFmpeg, fileNames: string[]): Promise<void> => {
  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        await ffmpeg.deleteFile(fileName);
      } catch {
        // Ignore cleanup errors
      }
    })
  );
};

export const muxRecordedVideo = async (
  ffmpeg: FFmpeg,
  recordedBlob: Blob,
  audioFile: File,
  audioLeadInMs: number,
  jobId: number
): Promise<Blob> => {
  const audioExtension = getFileExtension(audioFile.name) || '.bin';
  const captureInputName = `capture-${jobId}.webm`;
  const audioInputName = `audio-${jobId}${audioExtension}`;
  const outputName = `export-${jobId}.mkv`;
  const audioOffsetSeconds = Math.max(0, audioLeadInMs) / 1000;
  const audioOffsetArgs =
    audioOffsetSeconds > 0.001 ? ['-itsoffset', audioOffsetSeconds.toFixed(3)] : [];

  try {
    await ffmpeg.writeFile(captureInputName, new Uint8Array(await recordedBlob.arrayBuffer()));
    await ffmpeg.writeFile(audioInputName, new Uint8Array(await audioFile.arrayBuffer()));
    await ffmpeg.exec([
      '-i',
      captureInputName,
      ...audioOffsetArgs,
      '-i',
      audioInputName,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-shortest',
      outputName,
    ]);

    const outputData = await ffmpeg.readFile(outputName);
    return new Blob([outputData as BlobPart], { type: 'video/x-matroska' });
  } finally {
    await cleanupFfmpegFiles(ffmpeg, [captureInputName, audioInputName, outputName]);
  }
};

interface MediaRecorderObserver {
  promise: Promise<number>;
  ac: AbortController;
}

export const observeMediaRecorderStart = (mediaRecorder: MediaRecorder): MediaRecorderObserver => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve: resolveStart, reject: rejectStart } = Promise.withResolvers<number>();
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
    finalize(() => rejectStart(new Error('MEDIA_RECORDER_START_FAILED')));

  mediaRecorder.addEventListener('start', handleStart, { signal });
  mediaRecorder.addEventListener('error', handleError, { signal });
  fallbackSignal.addEventListener(
    'abort',
    () => {
      if (mediaRecorder.state === 'recording') handleStart();
    },
    { once: true, signal }
  );

  signal.addEventListener('abort', () => {
    if (!settled) {
      settled = true;
      rejectStart(new Error('MEDIA_RECORDER_START_CANCELLED'));
    }
  });

  return { promise, ac };
};

interface AudioPlaybackObserver {
  promise: Promise<number>;
  ac: AbortController;
}

export const observeAudioPlaybackStart = (
  audioElement: HTMLAudioElement
): AudioPlaybackObserver => {
  const ac = new AbortController();
  const { signal } = ac;
  const { promise, resolve: resolvePlayback, reject: rejectPlayback } =
    Promise.withResolvers<number>();
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
    finalize(() => rejectPlayback(new Error('AUDIO_PLAYBACK_START_FAILED')));

  audioElement.addEventListener('playing', handleStart, { signal });
  audioElement.addEventListener('timeupdate', handleStart, { signal });
  audioElement.addEventListener('error', handleError, { signal });

  fallbackSignal.addEventListener(
    'abort',
    () => {
      if (!audioElement.paused) handleStart();
    },
    { once: true, signal }
  );

  signal.addEventListener('abort', () => {
    if (!settled) {
      settled = true;
      rejectPlayback(new Error('AUDIO_PLAYBACK_START_CANCELLED'));
    }
  });

  return { promise, ac };
};

export { EXPORT_RECORDING_MIME_TYPE, ffmpegInstance, ffmpegLoadPromise, ffmpegAssetUrls };
