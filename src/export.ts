import { TEXT } from './text';
import type { FFmpegWASM } from './types';
import { getFileExtension } from './utils';

const FFMPEG_CORE_BASE =
	'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
const EXPORT_RECORDING_MIME_TYPE = 'video/webm;codecs=vp9';
const EXPORT_START_TIMEOUT_MS = 1200;

declare global {
	interface Window {
		FFmpegWASM?: { FFmpeg: new () => FFmpegWASM };
	}
}

const getFfmpegClass = (): (new () => FFmpegWASM) | null =>
	window.FFmpegWASM?.FFmpeg ?? null;

const supportsInlineExport = (): boolean =>
	Boolean(navigator.mediaDevices?.getDisplayMedia) &&
	typeof MediaRecorder === 'function' &&
	typeof Promise.withResolvers === 'function' &&
	typeof AbortSignal.timeout === 'function' &&
	Boolean(MediaRecorder.isTypeSupported?.(EXPORT_RECORDING_MIME_TYPE)) &&
	Boolean(getFfmpegClass());

const createBlobUrlFromRemote = async (
	url: string,
	mimeType: string,
): Promise<string> => {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`FFMPEG_ASSET_FETCH_FAILED: ${response.status}`);
	}

	const buffer = await response.arrayBuffer();
	return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
};

export const revokeFfmpegAssetUrls = (urls: string[]): void => {
	urls.forEach((url) => URL.revokeObjectURL(url));
};

export const downloadBlob = (
	blob: Blob,
	filename: string,
	lastExportUrl: string | null,
): string | null => {
	const url = URL.createObjectURL(blob);

	if (lastExportUrl) {
		URL.revokeObjectURL(lastExportUrl);
	}

	const anchor = document.createElement('a');
	anchor.style.display = 'none';
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	setTimeout(() => anchor.remove(), 100);
	return url;
};

const cleanupFfmpegFiles = async (
	ffmpeg: FFmpegWASM,
	fileNames: string[],
): Promise<void> => {
	await Promise.all(
		fileNames.map(async (fileName) => {
			try {
				await ffmpeg.deleteFile(fileName);
			} catch {
				// ignore
			}
		}),
	);
};

export const muxRecordedVideo = async (
	ffmpeg: FFmpegWASM,
	recordedBlob: Blob,
	audioFile: File,
	audioLeadInMs: number,
): Promise<Blob> => {
	const jobId = Date.now();
	const audioExtension = getFileExtension(audioFile.name) || '.bin';
	const captureInputName = `capture-${jobId}.webm`;
	const audioInputName = `audio-${jobId}${audioExtension}`;
	const outputName = `export-${jobId}.mkv`;
	const audioOffsetSeconds = Math.max(0, audioLeadInMs) / 1000;
	const audioOffsetArgs =
		audioOffsetSeconds > 0.001
			? ['-itsoffset', audioOffsetSeconds.toFixed(3)]
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
		await cleanupFfmpegFiles(ffmpeg, [
			captureInputName,
			audioInputName,
			outputName,
		]);
	}
};

export const observeMediaRecorderStart = (
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

	const finalize = (callback: () => void): void => {
		if (settled) return;
		settled = true;
		ac.abort();
		callback();
	};

	const handleStart = (): void =>
		finalize(() => resolveStart(performance.now()));
	const handleError = (): void =>
		finalize(() => rejectStart(new Error('MEDIA_RECORDER_START_FAILED')));

	mediaRecorder.addEventListener('start', handleStart, { signal });
	mediaRecorder.addEventListener('error', handleError, { signal });
	fallbackSignal.addEventListener(
		'abort',
		() => {
			if (mediaRecorder.state === 'recording') {
				handleStart();
			}
		},
		{ once: true, signal },
	);

	signal.addEventListener('abort', () => {
		if (!settled) {
			settled = true;
			rejectStart(new Error('MEDIA_RECORDER_START_CANCELLED'));
		}
	});

	return { promise, ac };
};

export const observeAudioPlaybackStart = (
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

	const finalize = (callback: () => void): void => {
		if (settled) return;
		settled = true;
		ac.abort();
		callback();
	};

	const handleStart = (): void =>
		finalize(() => resolvePlayback(performance.now()));
	const handleError = (): void =>
		finalize(() =>
			rejectPlayback(
				audioElement.error || new Error('AUDIO_PLAYBACK_START_FAILED'),
			),
		);

	audioElement.addEventListener('playing', handleStart, { signal });
	audioElement.addEventListener('timeupdate', handleStart, { signal });
	audioElement.addEventListener('error', handleError, { signal });

	fallbackSignal.addEventListener(
		'abort',
		() => {
			if (!audioElement.paused) handleStart();
		},
		{ once: true, signal },
	);

	signal.addEventListener('abort', () => {
		if (!settled) {
			settled = true;
			rejectPlayback(new Error('AUDIO_PLAYBACK_START_CANCELLED'));
		}
	});

	return { promise, ac };
};

export interface ExportCallbacks {
	setExportStatus: (text: string) => void;
	onRecordingStart?: () => void;
	onRecordingEnd?: (shouldSave: boolean) => void;
	onFfmpegReady?: (ffmpeg: FFmpegWASM) => void;
	onFfmpegLoadStart?: () => void;
	onFfmpegLoadEnd?: () => void;
}

export const ensureFfmpeg = async (
	ffmpegRef: { current: FFmpegWASM | null },
	ffmpegLoadPromiseRef: { current: Promise<FFmpegWASM> | null },
	ffmpegAssetUrlsRef: { current: string[] },
	callbacks: ExportCallbacks,
): Promise<FFmpegWASM> => {
	if (ffmpegRef.current) {
		return ffmpegRef.current;
	}

	if (!supportsInlineExport()) {
		throw new Error('EXPORT_UNSUPPORTED');
	}

	if (!ffmpegLoadPromiseRef.current) {
		const FFmpeg = getFfmpegClass()!;
		callbacks.onFfmpegLoadStart?.();

		ffmpegLoadPromiseRef.current = (async () => {
			let ffmpeg: FFmpegWASM | null = null;

			try {
				const [coreURL, wasmURL] = await Promise.all([
					createBlobUrlFromRemote(
						`${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
						'text/javascript',
					),
					createBlobUrlFromRemote(
						`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
						'application/wasm',
					),
				]);

				ffmpegAssetUrlsRef.current = [coreURL, wasmURL];

				ffmpeg = new FFmpeg();
				ffmpeg.on('progress', ({ progress }) => {
					const percent = Math.max(
						1,
						Math.min(99, Math.round((progress || 0) * 100)),
					);
					callbacks.setExportStatus(
						`正在把录制画面与原始音频封装到 MKV… ${percent}%`,
					);
				});

				await ffmpeg.load({ coreURL, wasmURL });

				ffmpegRef.current = ffmpeg;
				callbacks.onFfmpegReady?.(ffmpeg);
				return ffmpeg;
			} catch (error) {
				if (ffmpeg) {
					ffmpeg.terminate();
				}
				ffmpegRef.current = null;
				revokeFfmpegAssetUrls(ffmpegAssetUrlsRef.current);
				throw error;
			}
		})().finally(() => {
			ffmpegLoadPromiseRef.current = null;
			callbacks.onFfmpegLoadEnd?.();
		});
	}

	return ffmpegLoadPromiseRef.current;
};

export const releaseDisplayStream = (stream: MediaStream | null): void => {
	if (stream) {
		stream.getTracks().forEach((track) => track.stop());
	}
};

export const getSafeExportBaseName = (title: string): string => {
	const rawName = title || TEXT.defaultTitle || 'lyrics-export';
	const safeName = rawName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
	return safeName || 'lyrics-export';
};

export const finalizeRecordedVideo = async (
	recordedBlob: Blob,
	audioFile: File | null,
	audioLeadInMs: number,
	exportBaseName: string,
	ffmpeg: FFmpegWASM | null,
	callbacks: ExportCallbacks,
): Promise<void> => {
	const shouldSave = Boolean(audioFile) && Boolean(ffmpeg);
	const recordingMimeType = EXPORT_RECORDING_MIME_TYPE;

	if (!shouldSave) {
		callbacks.setExportStatus(
			audioFile ? TEXT.exportFallbackHint : TEXT.exportCancelledHint,
		);
		if (recordedBlob) {
			downloadBlob(recordedBlob, `${exportBaseName}-capture.webm`, null);
		}
		return;
	}

	try {
		const muxedBlob = await muxRecordedVideo(
			ffmpeg!,
			recordedBlob,
			audioFile!,
			audioLeadInMs,
		);
		downloadBlob(muxedBlob, `${exportBaseName}.mkv`, null);
		callbacks.setExportStatus(TEXT.exportDoneHint);
	} catch (error) {
		console.error('Muxing failed, falling back to raw capture:', error);
		downloadBlob(recordedBlob, `${exportBaseName}-capture.webm`, null);
		callbacks.setExportStatus(TEXT.exportFallbackHint);
	}
};

export {
	supportsInlineExport,
	EXPORT_RECORDING_MIME_TYPE,
	EXPORT_START_TIMEOUT_MS,
};
