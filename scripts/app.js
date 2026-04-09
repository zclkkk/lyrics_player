(() => {
  const TEXT = {
    pageTitle: "YesPlayMusic 风格歌词录制页",
    panelButton: "面板",
    recordingMode: "录制模式",
    exitRecordingMode: "退出录制模式",
    shortcuts: "空格 播放 / 暂停 · R 录制模式 · H 隐藏面板",
    panelTitle: "录制控制台",
    loadDemo: "加载示例",
    resetView: "重置视图",
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
    playPause: "播放 / 暂停",
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

  const state = {
    title: TEXT.defaultTitle,
    artist: TEXT.defaultArtist,
    coverUrl: "",
    lyrics: [],
    currentIndex: 0,
    recordingMode: false,
    panelHidden: false,
    objectUrls: []
  };

  const $ = (id) => document.getElementById(id);

  const elements = {
    app: $("app"),
    audio: $("audio"),
    cover: $("cover"),
    title: $("title"),
    artist: $("artist"),
    lyricsTrack: $("lyricsTrack"),
    currentTime: $("currentTime"),
    duration: $("duration"),
    progress: $("progress"),
    panel: $("panel"),
    emptyState: $("emptyState"),
    titleInput: $("titleInput"),
    artistInput: $("artistInput"),
    lrcInput: $("lrcInput"),
    coverInput: $("coverInput"),
    audioInput: $("audioInput"),
    fontScaleInput: $("fontScaleInput"),
    coverScaleInput: $("coverScaleInput"),
    playBtn: $("playBtn"),
    recalcColorBtn: $("recalcColorBtn"),
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
    workflowHint: $("workflowHint"),
    sublinePrimary: $("sublinePrimary"),
    sublineSecondary: $("sublineSecondary"),
    emptyStateLine1: $("emptyStateLine1"),
    emptyStateLine2: $("emptyStateLine2")
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
    elements.playBtn.textContent = TEXT.playPause;
    elements.recalcColorBtn.textContent = TEXT.recalcColor;
    elements.workflowHint.textContent = TEXT.workflowHint;
    elements.cover.alt = TEXT.coverAlt;
    elements.sublinePrimary.textContent = TEXT.sublinePrimary;
    elements.sublineSecondary.textContent = TEXT.sublineSecondary;
    elements.emptyStateLine1.textContent = TEXT.emptyStateLine1;
    elements.emptyStateLine2.textContent = TEXT.emptyStateLine2;
  };

  const revokeObjectUrls = () => {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls = [];
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
    const rows = String(text || "").replace(/\r/g, "").split("\n");
    const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const lines = [];

    rows.forEach((row) => {
      const content = row.replace(timePattern, "").trim();
      let matched = false;

      for (const match of row.matchAll(timePattern)) {
        matched = true;
        const minutes = Number(match[1] || 0);
        const seconds = Number(match[2] || 0);
        const fractionText = match[3] || "0";
        const fraction = fractionText.length === 3 ? Number(fractionText) / 1000 : Number(fractionText) / 100;

        lines.push({
          time: minutes * 60 + seconds + fraction,
          text: content || " "
        });
      }

      if (!matched && row.trim()) {
        lines.push({ time: Number.POSITIVE_INFINITY, text: row.trim() });
      }
    });

    lines.sort((a, b) => a.time - b.time);
    return lines.length ? lines : [{ time: 0, text: TEXT.emptyLyrics }];
  };

  const updateEmptyState = () => {
    elements.emptyState.classList.toggle("show", !state.lyrics.length || !elements.audio.src);
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
    updateEmptyState();
  };

  const syncTextInputs = () => {
    elements.title.textContent = state.title;
    elements.artist.textContent = state.artist;
    elements.titleInput.value = state.title;
    elements.artistInput.value = state.artist;
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
    state.coverUrl = url;
    elements.cover.src = url;
    elements.app.style.setProperty("--bg-image", `url("${url.replace(/"/g, '\\"')}")`);
    recalcCoverColor();
  };

  const setAudio = (url) => {
    elements.audio.src = url;
    elements.audio.load();
    updateEmptyState();
  };

  const updateLyrics = (force = false) => {
    const lyricLines = Array.from(elements.lyricsTrack.children);

    if (!lyricLines.length) {
      return;
    }

    let activeIndex = 0;
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

    const activeLine = lyricLines[activeIndex];

    if (activeLine) {
      const targetOffset =
        elements.lyricsTrack.clientHeight / 2 - activeLine.offsetTop - activeLine.offsetHeight / 2;

      elements.app.style.setProperty("--lyrics-offset", `${targetOffset}px`);
    }
  };

  const updateProgress = () => {
    const currentTime = elements.audio.currentTime || 0;
    const duration = elements.audio.duration || 0;
    const progressPercent = duration > 0 ? `${(currentTime / duration) * 100}%` : "0%";

    elements.app.style.setProperty("--progress", progressPercent);
    elements.currentTime.textContent = formatTime(currentTime);
    elements.duration.textContent = formatTime(duration);
    updateLyrics();
  };

  const seekByClientX = (clientX) => {
    const rect = elements.progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

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
        <text x="90" y="930" fill="rgba(255,255,255,0.95)" font-size="108" font-family="Arial, sans-serif" font-weight="700">Cover Demo</text>
        <text x="96" y="1020" fill="rgba(255,255,255,0.72)" font-size="44" font-family="Arial, sans-serif">YesPlayMusic style lyrics page</text>
      </svg>
    `);

    setCover(`data:image/svg+xml;charset=utf-8,${svg}`);
    updateEmptyState();
  };

  const handleTitleInput = (event) => {
    state.title = event.target.value.trim() || TEXT.untitledSong;
    syncTextInputs();
  };

  const handleArtistInput = (event) => {
    state.artist = event.target.value.trim() || TEXT.unknownArtist;
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
    setAudio(objectUrl);
    updateEmptyState();
  };

  const handleFontScale = (event) => {
    const scale = Number(event.target.value) / 100;
    elements.lyricsTrack.style.fontSize = `${scale}em`;
  };

  const handleCoverScale = (event) => {
    document.documentElement.style.setProperty("--cover-size", `${Number(event.target.value)}vw`);
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

    elements.playBtn.addEventListener("click", togglePlayback);
    elements.recalcColorBtn.addEventListener("click", recalcCoverColor);
    elements.togglePanelBtn.addEventListener("click", () => setPanelHidden(!state.panelHidden));
    elements.toggleRecordingBtn.addEventListener("click", () => setRecordingMode(!state.recordingMode));
    elements.loadDemoBtn.addEventListener("click", loadDemo);
    elements.resetViewBtn.addEventListener("click", () => {
      elements.audio.currentTime = 0;
      updateProgress();
      updateLyrics(true);
    });

    elements.audio.addEventListener("timeupdate", updateProgress);
    elements.audio.addEventListener("loadedmetadata", updateProgress);
    elements.audio.addEventListener("ended", updateProgress);

    elements.progress.addEventListener("pointerdown", (event) => {
      seekByClientX(event.clientX);

      const onMove = (moveEvent) => seekByClientX(moveEvent.clientX);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    window.addEventListener("keydown", (event) => {
      if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        elements.playBtn.click();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        setRecordingMode(!state.recordingMode);
        return;
      }

      if (event.key.toLowerCase() === "h") {
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

    window.addEventListener("beforeunload", revokeObjectUrls);
  };

  const init = () => {
    applyStaticText();
    state.lyrics = parseLrc("");
    syncTextInputs();
    bindEvents();
    renderLyrics();
    loadDemo();
    updateProgress();
  };

  init();
})();
