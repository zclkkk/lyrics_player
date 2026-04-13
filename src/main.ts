import {
  alignLyricsFromCurrentLine,
  applyStaticText,
  cleanup,
  elements,
  handleArtistInput,
  handleAudioUpload,
  handleBgAnimate,
  handleBgBlur,
  handleBgDarkness,
  handleCoverScale,
  handleCoverUpload,
  handleDrop,
  handleFontScale,
  handleLyricsInput,
  handleLyricsNudge,
  handleLyricsOffsetInput,
  handleTitleInput,
  loadDemo,
  resetLyricsCalibration,
  seekByProgressValue,
  setPanelHidden,
  setRecordingMode,
  startPlaybackSyncLoop,
  state,
  stopPlaybackSyncLoop,
  syncLyricsUi,
  syncTextInputs,
  togglePlayback,
  updateLyricCalibrationUi,
  updateProgress,
} from "./app";
import {
  handleExportButtonClick,
  revokeFfmpegAssets,
  stopExporting,
  updateExportUi,
} from "./export";

const bindEvents = (): void => {
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
  elements.nudgeLrcBackBtn.addEventListener("click", () =>
    handleLyricsNudge(-100),
  );
  elements.nudgeLrcForwardBtn.addEventListener("click", () =>
    handleLyricsNudge(100),
  );
  elements.alignCurrentLyricBtn.addEventListener(
    "click",
    alignLyricsFromCurrentLine,
  );
  elements.resetLrcCalibrationBtn.addEventListener(
    "click",
    resetLyricsCalibration,
  );

  elements.playBtn.addEventListener("click", togglePlayback);
  elements.exportVideoBtn.addEventListener("click", handleExportButtonClick);
  elements.togglePanelBtn.addEventListener("click", () =>
    setPanelHidden(!state.panelHidden),
  );
  elements.toggleRecordingBtn.addEventListener("click", () =>
    setRecordingMode(!state.recordingMode),
  );
  elements.loadDemoBtn.addEventListener("click", loadDemo);
  elements.resetViewBtn.addEventListener("click", () => {
    elements.audio.currentTime = 0;
    updateProgress();
    updateLyricCalibrationUi();
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

  elements.progress.addEventListener("input", (event) => {
    seekByProgressValue((event.target as HTMLInputElement).value);
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.target &&
      ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)
    )
      return;

    if (event.code === "Space") {
      if (
        event.target &&
        ["BUTTON", "SELECT"].includes((event.target as HTMLElement).tagName)
      )
        return;
      if (state.isExporting) return;
      event.preventDefault();
      elements.playBtn.click();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      if (state.isExporting) {
        stopExporting();
        return;
      }
      if (state.isMuxing || state.ffmpegLoadPromise) return;
      setRecordingMode(!state.recordingMode);
      return;
    }

    if (event.key === "Escape") {
      if (state.isExporting) {
        stopExporting();
        return;
      }
      if (state.isMuxing || state.ffmpegLoadPromise) return;
      if (state.recordingMode) {
        setRecordingMode(false);
        return;
      }
      if (document.activeElement)
        (document.activeElement as HTMLElement).blur();
      return;
    }

    if (event.key.toLowerCase() === "h") {
      if (state.isExporting || state.isMuxing || state.ffmpegLoadPromise)
        return;
      setPanelHidden(!state.panelHidden);
      return;
    }

    if (event.key === "ArrowRight") {
      if (state.isExporting) return;
      elements.audio.currentTime = Math.min(
        elements.audio.duration || 0,
        (elements.audio.currentTime || 0) + 5,
      );
      updateProgress();
      return;
    }

    if (event.key === "ArrowLeft") {
      if (state.isExporting) return;
      elements.audio.currentTime = Math.max(
        0,
        (elements.audio.currentTime || 0) - 5,
      );
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
    cleanup();
    revokeFfmpegAssets();
  });
};

const init = (): void => {
  applyStaticText();
  syncLyricsUi();
  syncTextInputs();
  bindEvents();
  handleFontScale({ target: elements.fontScaleInput } as unknown as Event);
  handleCoverScale({ target: elements.coverScaleInput } as unknown as Event);
  handleBgDarkness({ target: elements.bgDarknessInput } as unknown as Event);
  handleBgBlur({ target: elements.bgBlurInput } as unknown as Event);
  loadDemo();
  updateExportUi();
};

init();
