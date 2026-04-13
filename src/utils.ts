export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
) => {
  let timer = 0;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
};

export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

export const formatSignedMilliseconds = (milliseconds: number) => {
  const rounded = Math.round(milliseconds);
  return `${rounded > 0 ? "+" : ""}${rounded} ms`;
};

export const formatLrcTimestamp = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return "--:--.--";
  }
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const remainingMilliseconds = totalMilliseconds % 60000;
  const wholeSeconds = Math.floor(remainingMilliseconds / 1000);
  const centiseconds = Math.floor((remainingMilliseconds % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
};

export const getLyricPreview = (text: string) => {
  const trimmed = String(text || "").trim() || "（空行）";
  return trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed;
};

export const getFileExtension = (filename: string) => {
  const matched = /\.([a-z0-9]+)$/i.exec(String(filename || ""));
  return matched ? `.${matched[1].toLowerCase()}` : "";
};
