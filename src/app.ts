import { applyAccent, getDominantColors } from './color';
import {
	EXPORT_RECORDING_MIME_TYPE,
	downloadBlob,
	ensureFfmpeg,
	finalizeRecordedVideo,
	getSafeExportBaseName,
	observeAudioPlaybackStart,
	observeMediaRecorderStart,
	releaseDisplayStream,
	supportsInlineExport,
} from './export';
import { parseLrc } from './lrc';
import { TEXT, demo } from './text';
import type { AppState, Elements, FFmpegWASM, LyricLine } from './types';
import {
	debounce,
	formatLrcTimestamp,
	formatSignedMilliseconds,
	formatTime,
	getLyricPreview,
} from './utils';

const $ = <T extends HTMLElement>(id: string): T | null =>
	document.getElementById(id) as T | null;

const createElements = (): Elements => ({
	app: $('app')!,
	audio: $('audio')!,
	exportVideoBtn: $('exportVideoBtn')!,
	exportStatus: $('exportStatus')!,
	cover: $('cover')!,
	title: $('title')!,
	artist: $('artist')!,
	lyricsViewport: $('lyricsViewport')!,
	lyricsTrack: $('lyricsTrack')!,
	currentTime: $('currentTime')!,
	duration: $('duration')!,
	progress: $('progress')!,
	panel: $('panel')!,
	titleInput: $('titleInput')!,
	artistInput: $('artistInput')!,
	lrcInput: $('lrcInput')!,
	coverInput: $('coverInput')!,
	audioInput: $('audioInput')!,
	fontScaleInput: $('fontScaleInput')!,
	coverScaleInput: $('coverScaleInput')!,
	playBtn: $('playBtn')!,
	togglePanelBtn: $('togglePanelBtn')!,
	toggleRecordingBtn: $('toggleRecordingBtn')!,
	loadDemoBtn: $('loadDemoBtn')!,
	resetViewBtn: $('resetViewBtn')!,
	shortcutsBadge: $('shortcutsBadge')!,
	panelTitle: $('panelTitle')!,
	songTitleLabel: $('songTitleLabel')!,
	artistLabel: $('artistLabel')!,
	coverLabel: $('coverLabel')!,
	coverPickerLabel: $('coverPickerLabel')!,
	audioLabel: $('audioLabel')!,
	audioPickerLabel: $('audioPickerLabel')!,
	lrcLabel: $('lrcLabel')!,
	lrcCalibrationLabel: $('lrcCalibrationLabel')!,
	lrcCalibrationHint: $('lrcCalibrationHint')!,
	lrcOffsetLabel: $('lrcOffsetLabel')!,
	lrcOffsetInput: $('lrcOffsetInput')!,
	lrcOffsetValue: $('lrcOffsetValue')!,
	nudgeLrcBackBtn: $('nudgeLrcBackBtn')!,
	nudgeLrcForwardBtn: $('nudgeLrcForwardBtn')!,
	alignCurrentLyricBtn: $('alignCurrentLyricBtn')!,
	resetLrcCalibrationBtn: $('resetLrcCalibrationBtn')!,
	lrcCalibrationStatus: $('lrcCalibrationStatus')!,
	fontScaleLabel: $('fontScaleLabel')!,
	coverScaleLabel: $('coverScaleLabel')!,
	bgDarknessInput: $('bgDarknessInput')!,
	bgDarknessLabel: $('bgDarknessLabel')!,
	bgBlurInput: $('bgBlurInput')!,
	bgBlurLabel: $('bgBlurLabel')!,
	bgAnimateInput: $('bgAnimateInput')!,
	bgAnimateLabel: $('bgAnimateLabel')!,
	workflowHint: $('workflowHint')!,
});

const createInitialState = (): AppState => ({
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
});

export class LyricsApp {
	private state: AppState;
	private elements: Elements;
	private ffmpegRef: { current: FFmpegWASM | null } = { current: null };
	private ffmpegLoadPromiseRef: { current: Promise<FFmpegWASM> | null } = {
		current: null,
	};
	private ffmpegAssetUrlsRef: { current: string[] } = { current: [] };

	constructor() {
		this.state = createInitialState();
		this.elements = createElements();
	}

	private applyStaticText(): void {
		document.title = TEXT.pageTitle;
		this.elements.togglePanelBtn.textContent = TEXT.panelButton;
		this.elements.toggleRecordingBtn.textContent = TEXT.recordingMode;
		this.elements.shortcutsBadge.textContent = TEXT.shortcuts;
		this.elements.panelTitle.textContent = TEXT.panelTitle;
		this.elements.loadDemoBtn.textContent = TEXT.loadDemo;
		this.elements.resetViewBtn.textContent = TEXT.resetView;
		this.elements.songTitleLabel.textContent = TEXT.songTitleLabel;
		this.elements.artistLabel.textContent = TEXT.artistLabel;
		this.elements.coverLabel.textContent = TEXT.coverLabel;
		this.elements.coverPickerLabel.textContent = TEXT.coverPicker;
		this.elements.audioLabel.textContent = TEXT.audioLabel;
		this.elements.audioPickerLabel.textContent = TEXT.audioPicker;
		this.elements.lrcLabel.textContent = TEXT.lrcLabel;
		this.elements.lrcInput.placeholder = TEXT.lrcPlaceholder;
		this.elements.lrcCalibrationLabel.textContent = TEXT.lrcCalibrationLabel;
		this.elements.lrcCalibrationHint.textContent = TEXT.lrcCalibrationHint;
		this.elements.lrcOffsetLabel.textContent = TEXT.lrcOffsetLabel;
		this.elements.nudgeLrcBackBtn.textContent = TEXT.lrcNudgeBack;
		this.elements.nudgeLrcForwardBtn.textContent = TEXT.lrcNudgeForward;
		this.elements.alignCurrentLyricBtn.textContent = TEXT.lrcAlignCurrent;
		this.elements.resetLrcCalibrationBtn.textContent = TEXT.lrcReset;
		this.elements.fontScaleLabel.textContent = TEXT.fontScaleLabel;
		this.elements.coverScaleLabel.textContent = TEXT.coverScaleLabel;
		this.elements.bgDarknessLabel.textContent = TEXT.bgDarknessLabel;
		this.elements.bgBlurLabel.textContent = TEXT.bgBlurLabel;
		this.elements.bgAnimateLabel.textContent = TEXT.bgAnimateLabel;
		this.elements.playBtn.textContent = TEXT.playPause;
		this.elements.exportVideoBtn.textContent = TEXT.exportButton;
		this.elements.exportStatus.textContent = TEXT.exportIdleHint;
		this.elements.workflowHint.textContent = TEXT.workflowHint;
		this.elements.cover.alt = TEXT.coverAlt;
	}

	private revokeObjectUrls(): void {
		this.state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.state.objectUrls = [];
	}

	private revokeTrackedObjectUrl(url: string): void {
		if (!url?.startsWith('blob:')) return;
		URL.revokeObjectURL(url);
		this.state.objectUrls = this.state.objectUrls.filter(
			(trackedUrl) => trackedUrl !== url,
		);
	}

	private applyLyricsData(lyrics: LyricLine[]): void {
		this.state.originalLyrics = structuredClone(lyrics);
		this.state.lyrics = structuredClone(lyrics);
		this.state.lyricsGlobalOffsetMs = 0;
		this.state.currentIndex = -1;
	}

	private syncLyricsUi({ rerender = false } = {}): void {
		if (rerender) {
			this.elements.lyricsTrack.replaceChildren();
			this.state.lyrics.forEach((line, index) => {
				const lineElement = document.createElement('div');
				const hasText = Boolean((line.text || '').trim());
				const lineClassNames = ['lyric-line'];
				if (!hasText) lineClassNames.push('empty');
				if (line.isError) lineClassNames.push('error');
				lineElement.className = lineClassNames.join(' ');
				lineElement.textContent = line.text || ' ';
				lineElement.dataset.index = String(index);
				this.elements.lyricsTrack.appendChild(lineElement);
			});
			this.state.lyricLineElements = Array.from(
				this.elements.lyricsTrack.children,
			) as HTMLElement[];
		}
		this.updateProgress();
	}

	private applyLyricsText(text: string): void {
		this.applyLyricsData(parseLrc(text));
		this.syncLyricsUi({ rerender: true });
	}

	private getLyricsOffsetSeconds(): number {
		return this.state.lyricsGlobalOffsetMs / 1000;
	}

	private getEffectiveLyricTime(time: number): number {
		return Number.isFinite(time) ? time + this.getLyricsOffsetSeconds() : time;
	}

	private getLyricsValidationMessage(): string {
		return this.state.lyrics.find((line) => line?.isError)?.text || '';
	}

	private hasCalibratableLyrics(): boolean {
		return this.state.lyrics.some((line) => Number.isFinite(line.time));
	}

	private getCalibrationAnchorIndex(): number {
		if (!this.hasCalibratableLyrics()) return -1;

		if (this.state.currentIndex >= 0) {
			const currentLine = this.state.lyrics[this.state.currentIndex];
			if (currentLine && Number.isFinite(currentLine.time)) {
				return this.state.currentIndex;
			}
		}

		const currentTime = this.elements.audio.currentTime || 0;

		for (let index = 0; index < this.state.lyrics.length; index++) {
			const line = this.state.lyrics[index];
			if (!line || !Number.isFinite(line.time)) continue;
			if (this.getEffectiveLyricTime(line.time) >= currentTime) return index;
		}

		for (let index = this.state.lyrics.length - 1; index >= 0; index--) {
			if (Number.isFinite(this.state.lyrics[index]?.time)) return index;
		}

		return -1;
	}

	private isLyricCalibrationLocked(): boolean {
		return (
			this.state.isExporting ||
			this.state.isMuxing ||
			Boolean(this.state.ffmpegLoadPromise)
		);
	}

	private updateLyricCalibrationUi(): void {
		const lyricsValidationMessage = this.getLyricsValidationMessage();
		const hasTimedLyrics = this.hasCalibratableLyrics();
		const anchorIndex = this.getCalibrationAnchorIndex();
		const anchorLine = anchorIndex >= 0 ? this.state.lyrics[anchorIndex] : null;
		const calibrationLocked = this.isLyricCalibrationLocked();

		this.elements.lrcOffsetInput.disabled =
			!hasTimedLyrics || calibrationLocked;
		this.elements.nudgeLrcBackBtn.disabled =
			!hasTimedLyrics || calibrationLocked;
		this.elements.nudgeLrcForwardBtn.disabled =
			!hasTimedLyrics || calibrationLocked;
		this.elements.alignCurrentLyricBtn.disabled =
			!anchorLine || calibrationLocked;
		this.elements.resetLrcCalibrationBtn.disabled =
			!hasTimedLyrics || calibrationLocked;

		this.elements.lrcOffsetInput.value = String(
			this.state.lyricsGlobalOffsetMs,
		);
		this.elements.lrcOffsetValue.textContent = formatSignedMilliseconds(
			this.state.lyricsGlobalOffsetMs,
		);

		if (lyricsValidationMessage) {
			this.elements.lrcCalibrationStatus.textContent = lyricsValidationMessage;
			return;
		}

		if (!hasTimedLyrics) {
			this.elements.lrcCalibrationStatus.textContent = TEXT.lrcCalibrationEmpty;
			return;
		}

		if (!anchorLine) {
			this.elements.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(this.state.lyricsGlobalOffsetMs)} · 先播放到要校准的那一句。`;
			return;
		}

		this.elements.lrcCalibrationStatus.textContent = `整体偏移 ${formatSignedMilliseconds(this.state.lyricsGlobalOffsetMs)} · 对齐句：${getLyricPreview(anchorLine.text)} · 时间 ${formatLrcTimestamp(this.getEffectiveLyricTime(anchorLine.time))}`;
	}

	private setLyricsGlobalOffset(nextOffsetMs: number): void {
		const clamped = Math.max(
			-5000,
			Math.min(5000, Math.round(Number(nextOffsetMs) || 0)),
		);
		this.state.lyricsGlobalOffsetMs = clamped;
		this.updateProgress();
	}

	private shiftLyricsFromIndex(startIndex: number, deltaSeconds: number): void {
		const anchorLine = this.state.lyrics[startIndex];
		if (
			!anchorLine ||
			!Number.isFinite(anchorLine.time) ||
			!Number.isFinite(deltaSeconds)
		)
			return;

		let appliedDelta = deltaSeconds;
		let minimumDelta = -anchorLine.time;

		for (let index = startIndex - 1; index >= 0; index--) {
			const previousLine = this.state.lyrics[index];
			if (!previousLine || !Number.isFinite(previousLine.time)) continue;
			minimumDelta = Math.max(
				minimumDelta,
				previousLine.time - anchorLine.time + 0.01,
			);
			break;
		}

		appliedDelta = Math.max(appliedDelta, minimumDelta);
		if (Math.abs(appliedDelta) < 0.0005) return;

		this.state.lyrics = this.state.lyrics.map((line, index) => {
			if (index < startIndex || !line || !Number.isFinite(line.time))
				return line;
			return { ...line, time: Math.max(0, line.time + appliedDelta) };
		});

		this.updateProgress();
	}

	private alignLyricsFromCurrentLine(): void {
		const anchorIndex = this.getCalibrationAnchorIndex();
		if (anchorIndex < 0) return;
		const anchorLine = this.state.lyrics[anchorIndex];
		if (!anchorLine) return;
		const currentTime = this.elements.audio.currentTime || 0;
		const displayedTime = this.getEffectiveLyricTime(anchorLine.time);
		this.shiftLyricsFromIndex(anchorIndex, currentTime - displayedTime);
	}

	private resetLyricsCalibration(): void {
		this.state.lyrics = structuredClone(this.state.originalLyrics);
		this.state.lyricsGlobalOffsetMs = 0;
		this.state.currentIndex = -1;
		this.syncLyricsUi({ rerender: true });
	}

	private syncTextInputs(): void {
		this.elements.title.textContent = this.state.title || TEXT.untitledSong;
		this.elements.artist.textContent = this.state.artist || TEXT.unknownArtist;
		if (this.elements.titleInput.value !== this.state.title) {
			this.elements.titleInput.value = this.state.title;
		}
		if (this.elements.artistInput.value !== this.state.artist) {
			this.elements.artistInput.value = this.state.artist;
		}
	}

	private recalcCoverColor(): void {
		if (!this.state.coverUrl) return;
		const probeImage = new Image();
		probeImage.crossOrigin = 'anonymous';
		probeImage.onload = () => {
			try {
				const { colors } = getDominantColors(probeImage);
				applyAccent(colors);
			} catch {
				// ignore
			}
		};
		probeImage.src = this.state.coverUrl;
	}

	private setCover(url: string): void {
		if (this.state.coverUrl && this.state.coverUrl !== url) {
			this.revokeTrackedObjectUrl(this.state.coverUrl);
		}
		this.state.coverUrl = url;
		this.elements.cover.src = url;
		const cssUrl = url.replace(/[\\"'()]/g, (ch) => `\\${ch}`);
		this.elements.app.style.setProperty('--bg-image', `url("${cssUrl}")`);
		this.recalcCoverColor();
	}

	private setAudio(url: string, file: File | null = null): void {
		if (this.state.audioUrl && this.state.audioUrl !== url) {
			this.revokeTrackedObjectUrl(this.state.audioUrl);
		}
		this.state.audioUrl = url;
		this.state.audioFile = file;
		this.elements.audio.src = url;
		this.elements.audio.load();
	}

	private createTrackedObjectUrl(file: File): string {
		const objectUrl = URL.createObjectURL(file);
		this.state.objectUrls.push(objectUrl);
		return objectUrl;
	}

	private importLyricsText(text: string): void {
		this.elements.lrcInput.value = text;
		this.applyLyricsText(text);
	}

	private isLrcFile(file: File): boolean {
		const fileName = String(file?.name || '');
		return (
			fileName.toLowerCase().endsWith('.lrc') || file?.type === 'text/plain'
		);
	}

	private importCoverFile(file: File): boolean {
		if (!file || !file.type.startsWith('image/')) return false;
		this.setCover(this.createTrackedObjectUrl(file));
		return true;
	}

	private importAudioFile(file: File): boolean {
		if (!file || !file.type.startsWith('audio/')) return false;
		this.setAudio(this.createTrackedObjectUrl(file), file);
		this.setExportStatus(TEXT.exportIdleHint);
		return true;
	}

	private importLrcFile(file: File): Promise<boolean> {
		if (!file || !this.isLrcFile(file)) return Promise.resolve(false);
		return file.text().then((text) => {
			this.importLyricsText(text);
			return true;
		});
	}

	private importDroppedFile(file: File): Promise<boolean> {
		if (this.importCoverFile(file) || this.importAudioFile(file))
			return Promise.resolve(true);
		return this.importLrcFile(file);
	}

	private updateLyrics(force = false): void {
		const lyricLines = this.state.lyricLineElements;
		if (!lyricLines.length) {
			this.updateLyricCalibrationUi();
			return;
		}

		let activeIndex = -1;
		const currentTime = this.elements.audio.currentTime || 0;

		for (let index = 0; index < this.state.lyrics.length; index++) {
			const lyric = this.state.lyrics[index];
			const lyricTime = lyric?.time;
			if (
				lyricTime !== undefined &&
				this.getEffectiveLyricTime(lyricTime) <= currentTime
			) {
				activeIndex = index;
			} else {
				break;
			}
		}

		if (!force && activeIndex === this.state.currentIndex) return;

		this.state.currentIndex = activeIndex;

		lyricLines.forEach((lineElement, index) => {
			lineElement.classList.toggle('active', index === activeIndex);
			lineElement.classList.toggle(
				'near',
				Math.abs(index - activeIndex) <= 1 && index !== activeIndex,
			);
		});

		const activeLine =
			activeIndex >= 0 ? lyricLines[activeIndex] : lyricLines[0];
		if (activeLine) {
			const viewportHeight =
				this.elements.lyricsViewport?.clientHeight ||
				this.elements.lyricsTrack.clientHeight;
			const targetOffset =
				viewportHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;
			this.elements.app.style.setProperty(
				'--lyrics-offset',
				`${targetOffset}px`,
			);
		}

		this.updateLyricCalibrationUi();
	}

	private updateProgress(): void {
		const currentTime = this.elements.audio.currentTime || 0;
		const duration = this.elements.audio.duration || 0;
		const progressRatio = duration > 0 ? currentTime / duration : 0;
		const progressPercent = `${progressRatio * 100}%`;

		if (this.state.lastProgressPercent !== progressPercent) {
			this.state.lastProgressPercent = progressPercent;
			this.elements.app.style.setProperty('--progress', progressPercent);
		}

		const progressValue = String(
			Math.round(progressRatio * Number(this.elements.progress.max)),
		);
		if (this.state.lastProgressValue !== progressValue) {
			this.state.lastProgressValue = progressValue;
			this.elements.progress.value = progressValue;
		}

		const timeText = formatTime(currentTime);
		if (this.state.lastTimeText !== timeText) {
			this.state.lastTimeText = timeText;
			this.elements.currentTime.textContent = timeText;
		}

		const durationText = formatTime(duration);
		if (this.state.lastDurationText !== durationText) {
			this.state.lastDurationText = durationText;
			this.elements.duration.textContent = durationText;
		}

		this.updateLyrics();
	}

	private stopPlaybackSyncLoop(): void {
		if (this.state.playbackSyncFrame) {
			cancelAnimationFrame(this.state.playbackSyncFrame);
			this.state.playbackSyncFrame = 0;
		}
	}

	private startPlaybackSyncLoop(): void {
		if (this.state.playbackSyncFrame) return;

		const tick = (): void => {
			this.updateProgress();
			if (this.elements.audio.paused || this.elements.audio.ended) {
				this.state.playbackSyncFrame = 0;
				return;
			}
			this.state.playbackSyncFrame = requestAnimationFrame(tick);
		};

		this.state.playbackSyncFrame = requestAnimationFrame(tick);
	}

	private clearPendingExportStartObservers(): void {
		if (this.state.pendingRecordingStartAc) {
			this.state.pendingRecordingStartAc.abort();
			this.state.pendingRecordingStartAc = null;
		}
		if (this.state.pendingPlaybackStartAc) {
			this.state.pendingPlaybackStartAc.abort();
			this.state.pendingPlaybackStartAc = null;
		}
	}

	private seekByProgressValue(rawValue: number): void {
		if (this.isPlaybackInteractionLocked()) return;
		const max = Number(this.elements.progress.max) || 1000;
		const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));
		if (
			Number.isFinite(this.elements.audio.duration) &&
			this.elements.audio.duration > 0
		) {
			this.elements.audio.currentTime = ratio * this.elements.audio.duration;
			this.updateProgress();
		}
	}

	private setRecordingMode(enabled: boolean): void {
		this.state.recordingMode = enabled;
		document.body.classList.toggle('recording-mode', enabled);
		this.elements.toggleRecordingBtn.textContent = enabled
			? TEXT.exitRecordingMode
			: TEXT.recordingMode;
	}

	private setPanelHidden(hidden: boolean): void {
		this.state.panelHidden = hidden;
		if (hidden) {
			this.elements.panel.close();
		} else {
			this.elements.panel.show();
		}
	}

	private isPlaybackInteractionLocked(): boolean {
		return this.state.isExporting;
	}

	private updateExportUi(): void {
		const playbackInteractionLocked = this.isPlaybackInteractionLocked();
		this.elements.playBtn.disabled = playbackInteractionLocked;
		this.elements.progress.disabled = playbackInteractionLocked;

		if (this.state.isExporting) {
			this.elements.exportVideoBtn.disabled = false;
			this.elements.exportVideoBtn.textContent = TEXT.exportStopButton;
			this.updateLyricCalibrationUi();
			return;
		}

		if (this.state.ffmpegLoadPromise) {
			this.elements.exportVideoBtn.disabled = true;
			this.elements.exportVideoBtn.textContent = TEXT.exportPreparingButton;
			this.updateLyricCalibrationUi();
			return;
		}

		if (this.state.isMuxing) {
			this.elements.exportVideoBtn.disabled = true;
			this.elements.exportVideoBtn.textContent = TEXT.exportMuxingButton;
			this.updateLyricCalibrationUi();
			return;
		}

		this.elements.exportVideoBtn.disabled = false;
		this.elements.exportVideoBtn.textContent = TEXT.exportButton;
		this.updateLyricCalibrationUi();
	}

	private setExportStatus(text: string): void {
		this.elements.exportStatus.textContent = text;
	}

	private resetExportSession(): void {
		this.clearPendingExportStartObservers();
		this.state.mediaRecorder = null;
		this.state.recordedChunks = [];
		this.state.shouldSaveExport = false;
		this.state.exportBaseName = '';
		this.state.exportAudioLeadInMs = 0;
	}

	private teardownExportUi(): void {
		this.state.isExporting = false;
		document.body.classList.remove('is-exporting');
		this.setRecordingMode(false);
		this.clearPendingExportStartObservers();
		this.elements.audio.pause();
		if (this.state.exportEndedAc) {
			this.state.exportEndedAc.abort();
			this.state.exportEndedAc = null;
		}
		this.updateExportUi();
	}

	private stopExporting(shouldSave = true): void {
		if (
			!this.state.isExporting &&
			!this.state.mediaRecorder &&
			!this.state.displayStream
		)
			return;

		const saveExport = shouldSave !== false;
		this.teardownExportUi();
		this.state.shouldSaveExport = saveExport;
		this.state.isMuxing = saveExport;
		this.updateExportUi();
		this.setExportStatus(
			saveExport ? TEXT.exportMuxingHint : TEXT.exportCancelledHint,
		);

		if (
			this.state.mediaRecorder &&
			this.state.mediaRecorder.state !== 'inactive'
		) {
			this.state.mediaRecorder.stop();
		} else {
			releaseDisplayStream(this.state.displayStream);
			void this.finalizeRecordedVideo();
			return;
		}

		releaseDisplayStream(this.state.displayStream);
	}

	private async finalizeRecordedVideo(): Promise<void> {
		const requestedSave = this.state.shouldSaveExport;
		const hasRecordedChunks = this.state.recordedChunks.length > 0;
		const shouldSave = requestedSave && hasRecordedChunks;
		const recordingMimeType =
			this.state.recordedChunks[0]?.type || EXPORT_RECORDING_MIME_TYPE;

		if (!shouldSave) {
			this.state.isMuxing = false;
			this.setExportStatus(
				requestedSave ? TEXT.exportEmptyCaptureHint : TEXT.exportCancelledHint,
			);
			this.updateExportUi();
			this.resetExportSession();
			return;
		}

		const recordedBlob = new Blob(this.state.recordedChunks, {
			type: recordingMimeType,
		});
		const exportBaseName =
			this.state.exportBaseName || getSafeExportBaseName(this.state.title);
		const audioFile = this.state.audioFile;
		const audioLeadInMs = this.state.exportAudioLeadInMs;
		this.resetExportSession();
		this.setExportStatus(TEXT.exportMuxingHint);

		try {
			if (this.ffmpegRef.current && audioFile) {
				const { muxRecordedVideo } = await import('./export');
				const muxedBlob = await muxRecordedVideo(
					this.ffmpegRef.current,
					recordedBlob,
					audioFile,
					audioLeadInMs,
				);
				this.state.lastExportUrl = downloadBlob(
					muxedBlob,
					`${exportBaseName}.mkv`,
					this.state.lastExportUrl,
				);
				this.setExportStatus(TEXT.exportDoneHint);
			} else {
				throw new Error('EXPORT_ENGINE_NOT_READY');
			}
		} catch (error: unknown) {
			console.error('Muxing failed, falling back to raw capture:', error);
			this.state.lastExportUrl = downloadBlob(
				recordedBlob,
				`${exportBaseName}-capture.webm`,
				this.state.lastExportUrl,
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			alert(
				errorMessage === 'EXPORT_AUDIO_FILE_MISSING'
					? TEXT.exportRequiresOriginalAudio
					: TEXT.exportMuxFailed,
			);
			this.setExportStatus(TEXT.exportFallbackHint);
		} finally {
			this.state.isMuxing = false;
			this.updateExportUi();
		}
	}

	private handleExportButtonClick(): void {
		if (this.state.isExporting) {
			this.stopExporting();
			return;
		}
		if (this.state.isMuxing || this.state.ffmpegLoadPromise) return;
		void this.startExporting();
	}

	private async startExporting(): Promise<void> {
		if (
			this.state.isExporting ||
			this.state.isMuxing ||
			this.state.ffmpegLoadPromise
		)
			return;

		if (!this.elements.audio.src) {
			alert(TEXT.exportRequiresAudio);
			this.setExportStatus(TEXT.exportRequiresAudio);
			return;
		}

		if (!this.state.audioFile) {
			alert(TEXT.exportRequiresOriginalAudio);
			this.setExportStatus(TEXT.exportRequiresOriginalAudio);
			return;
		}

		if (!supportsInlineExport()) {
			alert(TEXT.exportUnsupported);
			this.setExportStatus(TEXT.exportUnsupported);
			return;
		}

		try {
			await ensureFfmpeg(
				this.ffmpegRef,
				this.ffmpegLoadPromiseRef,
				this.ffmpegAssetUrlsRef,
				{
					setExportStatus: (text) => this.setExportStatus(text),
					onFfmpegLoadStart: () => this.updateExportUi(),
					onFfmpegLoadEnd: () => this.updateExportUi(),
				},
			);

			this.setExportStatus(TEXT.exportPickTabHint);

			const videoStream = await navigator.mediaDevices.getDisplayMedia({
				video: { displaySurface: 'browser' },
				audio: false,
			});
			const videoTrack = videoStream.getVideoTracks()[0];

			if (!videoTrack) {
				videoStream.getTracks().forEach((track) => track.stop());
				throw new Error('EXPORT_VIDEO_TRACK_MISSING');
			}

			this.elements.audio.pause();
			this.elements.audio.currentTime = 0;

			this.state.displayStream = videoStream;
			this.state.recordedChunks = [];
			this.state.shouldSaveExport = true;
			this.state.exportAudioLeadInMs = 0;
			this.state.mediaRecorder = new MediaRecorder(videoStream, {
				mimeType: EXPORT_RECORDING_MIME_TYPE,
			});

			this.state.mediaRecorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					this.state.recordedChunks.push(event.data);
				}
			};

			this.state.mediaRecorder.onstop = () => {
				void this.finalizeRecordedVideo();
			};

			videoTrack.onended = () => {
				if (this.state.isExporting) this.stopExporting();
			};

			this.state.isExporting = true;
			document.body.classList.add('is-exporting');
			this.setRecordingMode(true);
			this.state.exportBaseName = getSafeExportBaseName(this.state.title);
			this.updateExportUi();
			this.setExportStatus(TEXT.exportRecordingHint);

			const recordingStartObserver = observeMediaRecorderStart(
				this.state.mediaRecorder,
			);
			this.state.pendingRecordingStartAc = recordingStartObserver.ac;
			this.state.mediaRecorder.start(1000);

			try {
				const recordingStartedAt = await recordingStartObserver.promise;
				this.state.pendingRecordingStartAc = null;

				const playbackStartObserver = observeAudioPlaybackStart(
					this.elements.audio,
				);
				this.state.pendingPlaybackStartAc = playbackStartObserver.ac;
				await this.elements.audio.play();
				const playbackStartedAt = await playbackStartObserver.promise;
				this.state.pendingPlaybackStartAc = null;
				this.state.exportAudioLeadInMs = Math.max(
					0,
					playbackStartedAt - recordingStartedAt,
				);
			} catch (error: unknown) {
				this.clearPendingExportStartObservers();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				if (
					[
						'MEDIA_RECORDER_START_CANCELLED',
						'AUDIO_PLAYBACK_START_CANCELLED',
					].includes(errorMessage) &&
					!this.state.isExporting
				) {
					return;
				}
				console.error(
					errorMessage === 'MEDIA_RECORDER_START_FAILED'
						? 'Recorder failed to start during export:'
						: 'Audio playback failed during export:',
					error,
				);
				this.stopExporting(false);
				return;
			}

			if (!this.state.isExporting) return;

			this.state.exportEndedAc = new AbortController();
			this.elements.audio.addEventListener(
				'ended',
				() => this.stopExporting(),
				{ once: true, signal: this.state.exportEndedAc.signal },
			);
		} catch (err) {
			console.error('Recording failed or rejected:', err);
			if (
				this.state.isExporting ||
				this.state.mediaRecorder ||
				this.state.displayStream
			) {
				this.stopExporting(false);
			} else {
				this.updateExportUi();
			}
			if (err instanceof Error) {
				if (err.message === 'EXPORT_UNSUPPORTED') {
					alert(TEXT.exportUnsupported);
					this.setExportStatus(TEXT.exportUnsupported);
					return;
				}
				if (err.message.startsWith('FFMPEG_ASSET_FETCH_FAILED')) {
					alert(TEXT.exportEngineFailed);
					this.setExportStatus(TEXT.exportEngineFailed);
					return;
				}
				if (['AbortError', 'NotAllowedError'].includes(err.name)) {
					this.setExportStatus(TEXT.exportCancelledHint);
					return;
				}
				if (!this.ffmpegRef.current) {
					alert(TEXT.exportEngineFailed);
					this.setExportStatus(TEXT.exportEngineFailed);
					return;
				}
				alert(TEXT.exportStartFailed);
				this.setExportStatus(TEXT.exportStartFailed);
			}
		}
	}

	private togglePlayback = async (): Promise<void> => {
		if (!this.elements.audio.src || this.isPlaybackInteractionLocked()) return;

		if (this.elements.audio.paused) {
			try {
				await this.elements.audio.play();
			} catch {
				// ignore
			}
			return;
		}

		this.elements.audio.pause();
	};

	private loadDemo = (): void => {
		this.state.title = demo.title;
		this.state.artist = demo.artist;
		this.elements.lrcInput.value = demo.lrc;
		this.syncTextInputs();
		this.applyLyricsText(demo.lrc);

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

		this.setCover(`data:image/svg+xml;charset=utf-8,${svg}`);
	};

	private handleDrop = async (event: DragEvent): Promise<void> => {
		event.preventDefault();
		document.body.classList.remove('drag-over');
		if (this.state.isExporting) return;

		const files = Array.from(event.dataTransfer?.files || []);
		await Promise.allSettled(files.map((file) => this.importDroppedFile(file)));

		if (!files.length) {
			const text = event.dataTransfer?.getData('text/plain');
			if (text) this.importLyricsText(text);
		}
	};

	private bindEvents(): void {
		this.elements.titleInput.addEventListener('input', (e) => {
			this.state.title = (e.target as HTMLInputElement).value;
			this.syncTextInputs();
		});
		this.elements.artistInput.addEventListener('input', (e) => {
			this.state.artist = (e.target as HTMLInputElement).value;
			this.syncTextInputs();
		});
		this.elements.lrcInput.addEventListener(
			'input',
			debounce(
				(e: unknown) =>
					this.applyLyricsText(
						((e as Event).target as HTMLTextAreaElement).value,
					),
				300,
			),
		);
		this.elements.coverInput.addEventListener('change', (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) this.importCoverFile(file);
		});
		this.elements.audioInput.addEventListener('change', (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) this.importAudioFile(file);
		});
		this.elements.fontScaleInput.addEventListener('input', (e) => {
			const scale = Number((e.target as HTMLInputElement).value) / 100;
			document.documentElement.style.setProperty(
				'--lyrics-scale',
				String(scale),
			);
			this.updateLyrics(true);
		});
		this.elements.coverScaleInput.addEventListener('input', (e) => {
			const minSlider = 26;
			const maxSlider = 42;
			const minCoverSize = 280;
			const maxCoverSize = 440;
			const sliderValue = Number((e.target as HTMLInputElement).value);
			const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
			const coverSize = Math.round(
				minCoverSize + (maxCoverSize - minCoverSize) * ratio,
			);
			document.documentElement.style.setProperty(
				'--cover-size',
				`${coverSize}px`,
			);
		});
		this.elements.bgDarknessInput.addEventListener('input', (e) => {
			const value = Number((e.target as HTMLInputElement).value) / 100;
			document.documentElement.style.setProperty(
				'--bg-darkness',
				String(value),
			);
		});
		this.elements.bgBlurInput.addEventListener('input', (e) => {
			const value = Number((e.target as HTMLInputElement).value);
			document.documentElement.style.setProperty('--bg-blur', `${value}px`);
		});
		this.elements.bgAnimateInput.addEventListener('change', (e) => {
			const bgElement = document.querySelector('.bg');
			if (bgElement)
				bgElement.classList.toggle(
					'animate',
					(e.target as HTMLInputElement).checked,
				);
		});
		this.elements.lrcOffsetInput.addEventListener('input', (e) =>
			this.setLyricsGlobalOffset((e.target as HTMLInputElement).valueAsNumber),
		);
		this.elements.nudgeLrcBackBtn.addEventListener('click', () =>
			this.setLyricsGlobalOffset(this.state.lyricsGlobalOffsetMs - 100),
		);
		this.elements.nudgeLrcForwardBtn.addEventListener('click', () =>
			this.setLyricsGlobalOffset(this.state.lyricsGlobalOffsetMs + 100),
		);
		this.elements.alignCurrentLyricBtn.addEventListener('click', () =>
			this.alignLyricsFromCurrentLine(),
		);
		this.elements.resetLrcCalibrationBtn.addEventListener('click', () =>
			this.resetLyricsCalibration(),
		);

		this.elements.playBtn.addEventListener('click', this.togglePlayback);
		this.elements.exportVideoBtn.addEventListener('click', () =>
			this.handleExportButtonClick(),
		);
		this.elements.togglePanelBtn.addEventListener('click', () =>
			this.setPanelHidden(!this.state.panelHidden),
		);
		this.elements.toggleRecordingBtn.addEventListener('click', () =>
			this.setRecordingMode(!this.state.recordingMode),
		);
		this.elements.loadDemoBtn.addEventListener('click', this.loadDemo);
		this.elements.resetViewBtn.addEventListener('click', () => {
			this.elements.audio.currentTime = 0;
			this.updateProgress();
			this.updateLyrics(true);
		});

		this.elements.audio.addEventListener('play', () =>
			this.startPlaybackSyncLoop(),
		);
		this.elements.audio.addEventListener('pause', () => {
			this.stopPlaybackSyncLoop();
			this.updateProgress();
		});
		this.elements.audio.addEventListener('loadedmetadata', () =>
			this.updateProgress(),
		);
		this.elements.audio.addEventListener('ended', () => {
			this.stopPlaybackSyncLoop();
			this.updateProgress();
		});

		this.elements.progress.addEventListener('input', (e) =>
			this.seekByProgressValue(Number((e.target as HTMLInputElement).value)),
		);

		window.addEventListener('keydown', (event) => {
			if (
				event.target &&
				['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
			)
				return;

			if (event.code === 'Space') {
				if (
					event.target &&
					['BUTTON', 'SELECT'].includes((event.target as HTMLElement).tagName)
				)
					return;
				if (this.isPlaybackInteractionLocked()) return;
				event.preventDefault();
				this.elements.playBtn.click();
				return;
			}

			if (event.key.toLowerCase() === 'r') {
				if (this.state.isExporting) {
					this.stopExporting();
					return;
				}
				if (this.state.isMuxing || this.state.ffmpegLoadPromise) return;
				this.setRecordingMode(!this.state.recordingMode);
				return;
			}

			if (event.key === 'Escape') {
				if (this.state.isExporting) {
					this.stopExporting();
					return;
				}
				if (this.state.isMuxing || this.state.ffmpegLoadPromise) return;
				if (this.state.recordingMode) {
					this.setRecordingMode(false);
					return;
				}
				if (document.activeElement)
					(document.activeElement as HTMLElement).blur();
				return;
			}

			if (event.key.toLowerCase() === 'h') {
				if (
					this.state.isExporting ||
					this.state.isMuxing ||
					this.state.ffmpegLoadPromise
				)
					return;
				this.setPanelHidden(!this.state.panelHidden);
				return;
			}

			if (event.key === 'ArrowRight') {
				if (this.isPlaybackInteractionLocked()) return;
				this.elements.audio.currentTime = Math.min(
					this.elements.audio.duration || 0,
					(this.elements.audio.currentTime || 0) + 5,
				);
				this.updateProgress();
				return;
			}

			if (event.key === 'ArrowLeft') {
				if (this.isPlaybackInteractionLocked()) return;
				this.elements.audio.currentTime = Math.max(
					0,
					(this.elements.audio.currentTime || 0) - 5,
				);
				this.updateProgress();
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
		window.addEventListener('drop', this.handleDrop);

		window.addEventListener('beforeunload', () => {
			this.stopPlaybackSyncLoop();
			this.clearPendingExportStartObservers();
			this.revokeObjectUrls();
			this.ffmpegAssetUrlsRef.current.forEach((url) =>
				URL.revokeObjectURL(url),
			);
			if (this.ffmpegRef.current) this.ffmpegRef.current.terminate();
			if (this.state.lastExportUrl)
				URL.revokeObjectURL(this.state.lastExportUrl);
		});
	}

	public init(): void {
		this.applyStaticText();
		this.applyLyricsData([]);
		this.syncTextInputs();
		this.bindEvents();
		this.handleFontScale({ target: this.elements.fontScaleInput });
		this.handleCoverScale({ target: this.elements.coverScaleInput });
		this.handleBgDarkness({ target: this.elements.bgDarknessInput });
		this.handleBgBlur({ target: this.elements.bgBlurInput });
		this.loadDemo();
		this.updateExportUi();
	}

	private handleFontScale(event: { target: HTMLInputElement }): void {
		const scale = Number(event.target.value) / 100;
		document.documentElement.style.setProperty('--lyrics-scale', String(scale));
		this.updateLyrics(true);
	}

	private handleCoverScale(event: { target: HTMLInputElement }): void {
		const minSlider = 26;
		const maxSlider = 42;
		const minCoverSize = 280;
		const maxCoverSize = 440;
		const sliderValue = Number(event.target.value);
		const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
		const coverSize = Math.round(
			minCoverSize + (maxCoverSize - minCoverSize) * ratio,
		);
		document.documentElement.style.setProperty(
			'--cover-size',
			`${coverSize}px`,
		);
	}

	private handleBgDarkness(event: { target: HTMLInputElement }): void {
		const value = Number(event.target.value) / 100;
		document.documentElement.style.setProperty('--bg-darkness', String(value));
	}

	private handleBgBlur(event: { target: HTMLInputElement }): void {
		const value = Number(event.target.value);
		document.documentElement.style.setProperty('--bg-blur', `${value}px`);
	}
}
