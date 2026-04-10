(() => {
  const TEXT = {
    pageTitle: "YesPlayMusic 风格歌词录制页",
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
    exportIdleHint: "首次导出会联网加载 FFmpeg 内核（约 31 MB）；如果你是直接双击打开 index.html，请改用任意本地 HTTP 服务打开后再导出。",
    exportPreparingHint: "正在联网加载 FFmpeg 内核，首次可能需要几十秒，请稍候。",
    exportRecordingHint: "正在录制画面；录制结束后会自动把你导入的原始音频封装进 MKV。",
    exportMuxingHint: "正在把录制画面与原始音频封装到同一个 MKV 文件中。",
    exportDoneHint: "导出完成，已下载包含原始音频的 MKV 文件。",
    exportCancelledHint: "已取消导出。",
    exportEmptyCaptureHint: "录制结束过快，未捕获到任何画面，请重试。",
    exportFallbackHint: "原音频封装失败，已回退下载纯画面录制文件。",
    exportRequiresAudio: "请先导入音频文件！",
    exportRequiresOriginalAudio: "请通过文件选择或拖拽导入原始音频后再导出，这样才能保留原音频。",
    exportUnsupported: "当前浏览器不支持网页录屏导出，请改用新版 Chrome / Edge 或 OBS。",
    exportRequiresLocalServer: "当前页面是通过 file:// 直接打开的。导出功能请改用任意本地 HTTP 服务打开项目目录后再使用。",
    exportEngineFailed: "导出内核加载失败。请检查网络；若你是直接打开 index.html，请改用任意本地 HTTP 服务打开。",
    exportStartFailed: "一键导出启动失败，请重试，或改用 OBS / 系统录屏。",
    exportMuxFailed: "原音频封装失败，已回退为纯画面录制文件。",
    recalcColor: "重新取色",
    workflowHint:
      "建议工作流：导入封面、音频、LRC，点播放后切到录制模式，再用 OBS 或系统录屏采集这个页面。拖动底部进度条可以定位到任意时间。",
    coverAlt: "歌曲封面",
    defaultTitle: "你的翻唱作品",
    defaultArtist: "你的名字 / 原唱信息",
    sublinePrimary: "翻唱投稿可视化页面",
    sublineSecondary: "模糊背景 · 自动取色 · 歌词同步",
    emptyStateLine1: "导入音频与 LRC 后开始播放。",
    emptyStateLine2: "如果只想做静态镜头，也可以只导入封面和歌词。",
    untitledSong: "未命名作品",
    unknownArtist: "未知歌手",
    emptyLyrics: "请导入或粘贴 LRC 歌词",
    demoTitle: "夜空中最亮的星（翻唱）",
    demoArtist: "你的名字 · Cover"
  };

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
  };

  const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

  const state = {
    title: TEXT.defaultTitle,
    artist: TEXT.defaultArtist,
    coverUrl: "",
    audioUrl: "",
    audioFile: null,
    lyrics: [],
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
    recordingMimeType: "",
    exportAudioLeadInMs: 0,
    pendingPlaybackStartCancel: null,
    playbackSyncFrame: 0,
    ffmpeg: null,
    ffmpegLoadPromise: null,
    ffmpegAssetUrls: [],
    exportJobCount: 0
  };

  const $ = (id) => document.getElementById(id);

  const elements = {
    app: $("app"),
    audio: $("audio"),
    exportVideoBtn: $("exportVideoBtn"),
    exportStatus: $("exportStatus"),
    cover: $("cover"),
    title: $("title"),
    artist: $("artist"),
    lyricsTrack: $("lyricsTrack"),
    currentTime: $("currentTime"),
    duration: $("duration"),
    progress: $("progress"),
    panel: $("panel"),
    titleInput: $("titleInput"),
    artistInput: $("artistInput"),
    lrcInput: $("lrcInput"),
    coverInput: $("coverInput"),
    audioInput: $("audioInput"),
    fontScaleInput: $("fontScaleInput"),
    coverScaleInput: $("coverScaleInput"),
    playBtn: $("playBtn"),
    togglePanelBtn: $("togglePanelBtn"),
    toggleRecordingBtn: $("toggleRecordingBtn"),
    loadDemoBtn: $("loadDemoBtn"),
    resetViewBtn: $("resetViewBtn"),
    shortcutsBadge: $("shortcutsBadge"),
    panelTitle: $("panelTitle"),
    songTitleLabel: $("songTitleLabel"),
    artistLabel: $("artistLabel"),
    coverLabel: $("coverLabel"),
    coverPickerLabel: $("coverPickerLabel"),
    audioLabel: $("audioLabel"),
    audioPickerLabel: $("audioPickerLabel"),
    lrcLabel: $("lrcLabel"),
    fontScaleLabel: $("fontScaleLabel"),
    coverScaleLabel: $("coverScaleLabel"),
    bgDarknessInput: $("bgDarknessInput"),
    bgDarknessLabel: $("bgDarknessLabel"),
    bgBlurInput: $("bgBlurInput"),
    bgBlurLabel: $("bgBlurLabel"),
    bgAnimateInput: $("bgAnimateInput"),
    bgAnimateLabel: $("bgAnimateLabel"),
    workflowHint: $("workflowHint"),
    sublinePrimary: $("sublinePrimary"),
    sublineSecondary: $("sublineSecondary")
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
    elements.sublinePrimary.textContent = TEXT.sublinePrimary;
    elements.sublineSecondary.textContent = TEXT.sublineSecondary;

  };

  const revokeObjectUrls = () => {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls = [];
  };

  const revokeTrackedObjectUrl = (url) => {
    if (!url || !url.startsWith("blob:")) {
      return;
    }

    URL.revokeObjectURL(url);
    state.objectUrls = state.objectUrls.filter((trackedUrl) => trackedUrl !== url);
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return "00:00";
    }

    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const parseLrc = (text) => {
    const normalizedText = String(text || "").replace(/\r/g, "");

    if (!normalizedText.trim()) {
      return [];
    }

    const rows = normalizedText.split("\n");
    const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const lines = [];

    for (const row of rows) {
      const content = row.replace(timePattern, "").trim();
      let matched = false;

      for (const match of row.matchAll(timePattern)) {
        matched = true;
        const minutes = Number(match[1] || 0);
        const seconds = Number(match[2] || 0);
        const fractionText = match[3] || "0";
        const fraction = Number(fractionText.padEnd(3, '0')) / 1000;

        lines.push({
          time: minutes * 60 + seconds + fraction,
          text: content || " "
        });
      }

      if (!matched && row.trim()) {
        const trimmed = row.trim();
        if (!/^\[[a-z]+:/i.test(trimmed)) {
          return [{ time: 0, text: "【LRC 格式异常：存在无时间标签的行，请补全后导入】" }];
        }
        lines.push({ time: Number.POSITIVE_INFINITY, text: trimmed });
      }
    }

    lines.sort((a, b) => a.time - b.time);
    return lines;
  };

  const renderLyrics = () => {
    elements.lyricsTrack.innerHTML = "";

    state.lyrics.forEach((line, index) => {
      const lineElement = document.createElement("div");
      const hasText = Boolean((line.text || "").trim());

      lineElement.className = `lyric-line${hasText ? "" : " empty"}`;
      lineElement.textContent = line.text || " ";
      lineElement.dataset.index = String(index);

      elements.lyricsTrack.appendChild(lineElement);
    });

    updateLyrics(true);

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

  const getDominantColors = (image) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const sampleSize = 60;

    canvas.width = sampleSize;
    canvas.height = sampleSize;
    context.drawImage(image, 0, 0, sampleSize, sampleSize);

    const pixelData = context.getImageData(0, 0, sampleSize, sampleSize).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    let brightR = 0;
    let brightG = 0;
    let brightB = 0;
    let brightCount = 0;

    for (let index = 0; index < pixelData.length; index += 16) {
      const alpha = pixelData[index + 3] / 255;

      if (alpha < 0.5) {
        continue;
      }

      const red = pixelData[index];
      const green = pixelData[index + 1];
      const blue = pixelData[index + 2];
      const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;

      r += red;
      g += green;
      b += blue;
      count += 1;

      if (brightness > 110) {
        brightR += red;
        brightG += green;
        brightB += blue;
        brightCount += 1;
      }
    }

    const base = count
      ? [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
      : [255, 116, 116];

    const bright = brightCount
      ? [Math.round(brightR / brightCount), Math.round(brightG / brightCount), Math.round(brightB / brightCount)]
      : base.map((value) => Math.min(255, Math.round(value * 1.18 + 10)));

    return { base, bright };
  };

  const applyAccent = (base, bright) => {
    document.documentElement.style.setProperty("--accent-rgb", base.join(", "));
    document.documentElement.style.setProperty("--accent-2-rgb", bright.join(", "));
  };

  const recalcCoverColor = () => {
    if (!state.coverUrl) {
      return;
    }

    const probeImage = new Image();
    probeImage.crossOrigin = "anonymous";

    probeImage.onload = () => {
      try {
        const { base, bright } = getDominantColors(probeImage);
        applyAccent(base, bright);
      } catch (error) {
        console.warn("取色失败，已保留当前配色。", error);
      }
    };

    probeImage.src = state.coverUrl;
  };

  const setCover = (url) => {
    if (state.coverUrl && state.coverUrl !== url) {
      revokeTrackedObjectUrl(state.coverUrl);
    }

    state.coverUrl = url;
    elements.cover.src = url;
    elements.app.style.setProperty("--bg-image", `url("${url.replace(/"/g, '\\"')}")`);
    recalcCoverColor();
  };

  const setAudio = (url, file = null) => {
    if (state.audioUrl && state.audioUrl !== url) {
      revokeTrackedObjectUrl(state.audioUrl);
    }

    state.audioUrl = url;
    state.audioFile = file;
    elements.audio.src = url;
    elements.audio.load();

  };

  const updateLyrics = (force = false) => {
    const lyricLines = Array.from(elements.lyricsTrack.children);

    if (!lyricLines.length) {
      return;
    }

    let activeIndex = -1;
    const currentTime = elements.audio.currentTime || 0;

    for (let index = 0; index < state.lyrics.length; index += 1) {
      if (state.lyrics[index].time <= currentTime) {
        activeIndex = index;
      } else {
        break;
      }
    }

    if (!force && activeIndex === state.currentIndex) {
      return;
    }

    state.currentIndex = activeIndex;

    lyricLines.forEach((lineElement, index) => {
      lineElement.classList.toggle("active", index === activeIndex);
      lineElement.classList.toggle("near", Math.abs(index - activeIndex) <= 1 && index !== activeIndex);
    });

    const activeLine = activeIndex >= 0 ? lyricLines[activeIndex] : lyricLines[0];

    if (activeLine) {
      const targetOffset =
        elements.lyricsTrack.clientHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;

      elements.app.style.setProperty("--lyrics-offset", `${targetOffset}px`);
    }
  };

  const updateProgress = () => {
    const currentTime = elements.audio.currentTime || 0;
    const duration = elements.audio.duration || 0;
    const progressRatio = duration > 0 ? currentTime / duration : 0;
    const progressPercent = `${progressRatio * 100}%`;

    elements.app.style.setProperty("--progress", progressPercent);
    elements.progress.value = String(Math.round(progressRatio * Number(elements.progress.max)));
    elements.currentTime.textContent = formatTime(currentTime);
    elements.duration.textContent = formatTime(duration);
    updateLyrics();
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

  const clearPendingPlaybackStart = () => {
    if (typeof state.pendingPlaybackStartCancel === "function") {
      state.pendingPlaybackStartCancel();
      state.pendingPlaybackStartCancel = null;
    }
  };

  const observeAudioPlaybackStart = (audioElement) => {
    let finished = false;
    let fallbackTimer = 0;

    const cleanup = () => {
      audioElement.removeEventListener("playing", handleStart);
      audioElement.removeEventListener("timeupdate", handleStart);
      audioElement.removeEventListener("error", handleError);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
    };

    const finalize = (callback) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      callback();
    };

    const handleStart = () => {
      finalize(() => resolvePlayback(performance.now()));
    };

    const handleError = () => {
      finalize(() => rejectPlayback(audioElement.error || new Error("AUDIO_PLAYBACK_START_FAILED")));
    };

    let resolvePlayback;
    let rejectPlayback;

    const promise = new Promise((resolve, reject) => {
      resolvePlayback = resolve;
      rejectPlayback = reject;
    });

    audioElement.addEventListener("playing", handleStart);
    audioElement.addEventListener("timeupdate", handleStart);
    audioElement.addEventListener("error", handleError);

    fallbackTimer = window.setTimeout(() => {
      if (!audioElement.paused) {
        handleStart();
      }
    }, 1200);

    return {
      promise,
      cancel: () => {
        finalize(() => rejectPlayback(new Error("AUDIO_PLAYBACK_START_CANCELLED")));
      }
    };
  };

  const seekByProgressValue = (rawValue) => {
    const max = Number(elements.progress.max) || 1000;
    const ratio = Math.min(1, Math.max(0, Number(rawValue) / max));

    if (Number.isFinite(elements.audio.duration) && elements.audio.duration > 0) {
      elements.audio.currentTime = ratio * elements.audio.duration;
      updateProgress();
    }
  };

  const setRecordingMode = (enabled) => {
    state.recordingMode = enabled;
    document.body.classList.toggle("recording-mode", enabled);
    elements.toggleRecordingBtn.textContent = enabled ? TEXT.exitRecordingMode : TEXT.recordingMode;
  };

  const setPanelHidden = (hidden) => {
    state.panelHidden = hidden;
    elements.panel.classList.toggle("hidden", hidden);
  };

  const getFfmpegClass = () => window.FFmpegWASM?.FFmpeg || null;

  const supportsInlineExport = () =>
    Boolean(navigator.mediaDevices?.getDisplayMedia) &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(getFfmpegClass());

  const isDirectFileMode = () => window.location.protocol === "file:";

  const createBlobUrlFromRemote = async (url, mimeType) => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FFMPEG_ASSET_FETCH_FAILED: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  };

  const revokeFfmpegAssetUrls = () => {
    state.ffmpegAssetUrls.forEach((url) => URL.revokeObjectURL(url));
    state.ffmpegAssetUrls = [];
  };

  const setExportStatus = (text) => {
    elements.exportStatus.textContent = text;
  };

  const updateExportUi = () => {
    if (state.isExporting) {
      elements.exportVideoBtn.disabled = false;
      elements.exportVideoBtn.textContent = TEXT.exportStopButton;
      return;
    }

    if (state.ffmpegLoadPromise) {
      elements.exportVideoBtn.disabled = true;
      elements.exportVideoBtn.textContent = TEXT.exportPreparingButton;
      return;
    }

    if (state.isMuxing) {
      elements.exportVideoBtn.disabled = true;
      elements.exportVideoBtn.textContent = TEXT.exportMuxingButton;
      return;
    }

    elements.exportVideoBtn.disabled = false;
    elements.exportVideoBtn.textContent = TEXT.exportButton;
  };

  const getSupportedRecordingMimeType = () => {
    if (typeof MediaRecorder.isTypeSupported !== "function") {
      return "";
    }

    const preferredMimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];

    return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
  };

  const ensureFfmpeg = async () => {
    if (state.ffmpeg) {
      return state.ffmpeg;
    }

    if (isDirectFileMode()) {
      throw new Error("EXPORT_LOCAL_SERVER_REQUIRED");
    }

    if (!supportsInlineExport()) {
      throw new Error("EXPORT_UNSUPPORTED");
    }

    if (!state.ffmpegLoadPromise) {
      const FFmpeg = getFfmpegClass();
      updateExportUi();
      setExportStatus(TEXT.exportPreparingHint);

      state.ffmpegLoadPromise = (async () => {
        let ffmpeg = null;

        try {
          const [coreURL, wasmURL] = await Promise.all([
            createBlobUrlFromRemote(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
            createBlobUrlFromRemote(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm")
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

          await ffmpeg.load({
            coreURL,
            wasmURL
          });

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
      })()
        .finally(() => {
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
    clearPendingPlaybackStart();
    state.mediaRecorder = null;
    state.recordedChunks = [];
    state.shouldSaveExport = false;
    state.recordingMimeType = "";
    state.exportAudioLeadInMs = 0;
  };

  const teardownExportUi = () => {
    state.isExporting = false;
    document.body.classList.remove("is-exporting");
    setRecordingMode(false);
    clearPendingPlaybackStart();
    elements.audio.pause();
    elements.audio.removeEventListener("ended", stopExporting);
    updateExportUi();
  };

  const getFileExtension = (filename) => {
    const matched = /\.([a-z0-9]+)$/i.exec(String(filename || ""));
    return matched ? `.${matched[1].toLowerCase()}` : "";
  };

  const getSafeExportBaseName = () => {
    const rawName = state.title || TEXT.defaultTitle || "lyrics-export";
    const safeName = rawName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
    return safeName || "lyrics-export";
  };

  const downloadBlob = (blob, filename) => {
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
    setTimeout(() => {
      document.body.removeChild(anchor);
    }, 100);
  };

  const cleanupFfmpegFiles = async (ffmpeg, fileNames) => {
    await Promise.all(fileNames.map(async (fileName) => {
      try {
        await ffmpeg.deleteFile(fileName);
      } catch (error) {
        console.warn("清理 ffmpeg 临时文件失败：", fileName, error);
      }
    }));
  };

  const muxRecordedVideo = async (recordedBlob, audioFile, audioLeadInMs = 0) => {
    if (!state.ffmpeg) {
      throw new Error("EXPORT_ENGINE_NOT_READY");
    }

    if (!audioFile) {
      throw new Error("EXPORT_AUDIO_FILE_MISSING");
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
      return new Blob([outputData], { type: "video/x-matroska" });
    } finally {
      await cleanupFfmpegFiles(ffmpeg, [captureInputName, audioInputName, outputName]);
    }
  };

  const loadDemo = () => {
    state.title = demo.title;
    state.artist = demo.artist;
    state.lyrics = parseLrc(demo.lrc);

    elements.lrcInput.value = demo.lrc;
    syncTextInputs();
    renderLyrics();

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
        <text x="90" y="930" fill="rgba(255,255,255,0.95)" font-size="108" font-family="Arial, sans-serif" font-weight="700">翻唱 Demo</text>
        <text x="96" y="1020" fill="rgba(255,255,255,0.72)" font-size="44" font-family="Arial, sans-serif">YesPlayMusic 风格歌词页</text>
      </svg>
    `);

    setCover(`data:image/svg+xml;charset=utf-8,${svg}`);

  };

  const handleDrop = (event) => {
    event.preventDefault();
    document.body.classList.remove("drag-over");
    if (state.isExporting) return;

    const files = Array.from(event.dataTransfer?.files || []);

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        state.objectUrls.push(objectUrl);
        setCover(objectUrl);
      } else if (file.type.startsWith("audio/")) {
        const objectUrl = URL.createObjectURL(file);
        state.objectUrls.push(objectUrl);
        setAudio(objectUrl, file);
        setExportStatus(TEXT.exportIdleHint);
      } else if (file.name.endsWith(".lrc") || file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          elements.lrcInput.value = text;
          state.lyrics = parseLrc(text);
          renderLyrics();
        };
        reader.readAsText(file);
      }
    }

    if (!files.length) {
      const text = event.dataTransfer?.getData("text/plain");
      if (text) {
        elements.lrcInput.value = text;
        state.lyrics = parseLrc(text);
        renderLyrics();
      }
    }
  };

  const handleTitleInput = (event) => {
    state.title = event.target.value;
    syncTextInputs();
  };

  const handleArtistInput = (event) => {
    state.artist = event.target.value;
    syncTextInputs();
  };

  const handleLyricsInput = (event) => {
    state.lyrics = parseLrc(event.target.value);
    renderLyrics();
  };

  const handleCoverUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    state.objectUrls.push(objectUrl);
    setCover(objectUrl);
  };

  const handleAudioUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    state.objectUrls.push(objectUrl);
    setAudio(objectUrl, file);
    setExportStatus(TEXT.exportIdleHint);

  };

  const handleFontScale = (event) => {
    const scale = Number(event.target.value) / 100;
    document.documentElement.style.setProperty("--lyrics-scale", String(scale));
    updateLyrics(true);
  };

  const handleCoverScale = (event) => {
    const minSlider = 26;
    const maxSlider = 42;
    const minCoverSize = 280;
    const maxCoverSize = 440;
    const sliderValue = Number(event.target.value);
    const ratio = (sliderValue - minSlider) / (maxSlider - minSlider);
    const coverSize = Math.round(minCoverSize + (maxCoverSize - minCoverSize) * ratio);

    document.documentElement.style.setProperty("--cover-size", `${coverSize}px`);
  };

  const handleBgDarkness = (event) => {
    const value = Number(event.target.value) / 100;
    document.documentElement.style.setProperty("--bg-darkness", String(value));
  };

  const handleBgBlur = (event) => {
    const value = Number(event.target.value);
    document.documentElement.style.setProperty("--bg-blur", `${value}px`);
  };

  const handleBgAnimate = (event) => {
    const bgElement = document.querySelector(".bg");
    if (bgElement) {
      bgElement.classList.toggle("animate", event.target.checked);
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

  const finalizeRecordedVideo = async () => {
    const requestedSave = state.shouldSaveExport;
    const hasRecordedChunks = state.recordedChunks.length > 0;
    const shouldSave = requestedSave && hasRecordedChunks;
    const recordingMimeType = state.recordingMimeType || state.recordedChunks[0]?.type || "video/webm";

    if (!shouldSave) {
      state.isMuxing = false;
      setExportStatus(requestedSave ? TEXT.exportEmptyCaptureHint : TEXT.exportCancelledHint);
      updateExportUi();
      resetExportSession();
      return;
    }

    const recordedBlob = new Blob(state.recordedChunks, {
      type: recordingMimeType
    });
    const audioFile = state.audioFile;
    const audioLeadInMs = state.exportAudioLeadInMs;
    resetExportSession();
    setExportStatus(TEXT.exportMuxingHint);

    try {
      const muxedBlob = await muxRecordedVideo(recordedBlob, audioFile, audioLeadInMs);
      downloadBlob(muxedBlob, `${getSafeExportBaseName()}.mkv`);
      setExportStatus(TEXT.exportDoneHint);
    } catch (error) {
      console.error("Muxing failed, falling back to raw capture:", error);
      downloadBlob(recordedBlob, `${getSafeExportBaseName()}-capture.webm`);
      alert(error?.message === "EXPORT_AUDIO_FILE_MISSING" ? TEXT.exportRequiresOriginalAudio : TEXT.exportMuxFailed);
      setExportStatus(TEXT.exportFallbackHint);
    } finally {
      state.isMuxing = false;
      updateExportUi();
    }
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
      setExportStatus(TEXT.exportPreparingHint);

      const videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include"
      });
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
      state.recordingMimeType = getSupportedRecordingMimeType();
      state.exportAudioLeadInMs = 0;

      const recorderOptions = state.recordingMimeType
        ? { mimeType: state.recordingMimeType }
        : undefined;

      state.mediaRecorder = new MediaRecorder(videoStream, recorderOptions);

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
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
      updateExportUi();
      setExportStatus(TEXT.exportRecordingHint);

      const playbackStartObserver = observeAudioPlaybackStart(elements.audio);
      state.pendingPlaybackStartCancel = playbackStartObserver.cancel;
      const recordingStartedAt = performance.now();
      state.mediaRecorder.start(1000);

      try {
        await elements.audio.play();
        const playbackStartedAt = await playbackStartObserver.promise;
        state.pendingPlaybackStartCancel = null;
        state.exportAudioLeadInMs = Math.max(0, playbackStartedAt - recordingStartedAt);
      } catch (error) {
        clearPendingPlaybackStart();
        if (error?.message === "AUDIO_PLAYBACK_START_CANCELLED" && !state.isExporting) {
          return;
        }
        console.error("Audio playback failed during export:", error);
        stopExporting(false);
        return;
      }

      if (!state.isExporting) {
        return;
      }

      elements.audio.addEventListener("ended", stopExporting, { once: true });

    } catch (err) {
      console.error("Recording failed or rejected:", err);
      if (state.isExporting || state.mediaRecorder || state.displayStream) {
        stopExporting(false);
      } else {
        updateExportUi();
      }
      if (err?.message === "EXPORT_UNSUPPORTED") {
        alert(TEXT.exportUnsupported);
        setExportStatus(TEXT.exportUnsupported);
        return;
      }
      if (err?.message === "EXPORT_LOCAL_SERVER_REQUIRED") {
        alert(TEXT.exportRequiresLocalServer);
        setExportStatus(TEXT.exportRequiresLocalServer);
        return;
      }
      if (String(err?.message || "").startsWith("FFMPEG_ASSET_FETCH_FAILED")) {
        alert(TEXT.exportEngineFailed);
        setExportStatus(TEXT.exportEngineFailed);
        return;
      }
      if (["AbortError", "NotAllowedError"].includes(err?.name)) {
        setExportStatus(TEXT.exportCancelledHint);
        return;
      }
      if (!state.ffmpeg) {
        alert(TEXT.exportEngineFailed);
        setExportStatus(TEXT.exportEngineFailed);
        return;
      }
      if (!["AbortError", "NotAllowedError"].includes(err?.name)) {
        alert(TEXT.exportStartFailed);
        setExportStatus(TEXT.exportStartFailed);
      }
    }
  };

  const togglePlayback = async () => {
    if (!elements.audio.src) {
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

    elements.playBtn.addEventListener("click", togglePlayback);
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
    elements.audio.addEventListener("timeupdate", updateProgress);
    elements.audio.addEventListener("loadedmetadata", updateProgress);
    elements.audio.addEventListener("ended", () => {
      stopPlaybackSyncLoop();
      updateProgress();
    });

    elements.progress.addEventListener("input", (event) => {
      seekByProgressValue(event.target.value);
    });

    window.addEventListener("keydown", (event) => {
      if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        return;
      }

      if (event.code === "Space") {
        if (event.target && ["BUTTON", "SELECT"].includes(event.target.tagName)) {
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
        if (document.activeElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (event.key.toLowerCase() === "h") {
        if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise) return;
        setPanelHidden(!state.panelHidden);
        return;
      }

      if (event.key === "ArrowRight") {
        elements.audio.currentTime = Math.min(
          elements.audio.duration || 0,
          (elements.audio.currentTime || 0) + 5
        );
        updateProgress();
        return;
      }

      if (event.key === "ArrowLeft") {
        elements.audio.currentTime = Math.max(0, (elements.audio.currentTime || 0) - 5);
        updateProgress();
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      document.body.classList.add("drag-over");
    });
    window.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (!e.relatedTarget || (e.clientX === 0 && e.clientY === 0)) {
        document.body.classList.remove("drag-over");
      }
    });
    window.addEventListener("drop", handleDrop);

    window.addEventListener("beforeunload", () => {
      stopPlaybackSyncLoop();
      clearPendingPlaybackStart();
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

  const init = () => {
    applyStaticText();
    state.lyrics = parseLrc("");
    syncTextInputs();
    bindEvents();
    handleFontScale({ target: elements.fontScaleInput });
    handleCoverScale({ target: elements.coverScaleInput });
    handleBgDarkness({ target: elements.bgDarknessInput });
    handleBgBlur({ target: elements.bgBlurInput });
    renderLyrics();
    loadDemo();
    updateExportUi();
    updateProgress();
  };

  init();
})();
