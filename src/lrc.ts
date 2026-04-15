import { Lrc } from "lrc-kit";

import type { LyricLine } from "./types";

export const parseLrc = (text: string): LyricLine[] => {
  const normalizedText = String(text || "").replaceAll("\r", "");

  if (!normalizedText.trim()) {
    return [];
  }

  for (const row of normalizedText.split("\n")) {
    const trimmed = row.trim();

    if (!trimmed) {
      continue;
    }

    if (!/^\[[a-z]+:/i.test(trimmed) && !/\[\d+\s*:\s*\d+(?:\s*[.:]\s*\d+)?\]/.test(trimmed)) {
      return [
        {
          time: Number.POSITIVE_INFINITY,
          text: "【LRC 格式异常：存在无时间标签的行，请补全后导入】",
          isError: true,
        },
      ];
    }
  }

  const parsed = Lrc.parse(normalizedText);
  const offsetSeconds = Number(parsed.info.offset || 0) / 1000;

  return parsed.lyrics
    .map<LyricLine>(({ timestamp, content }) => ({
      time: Math.max(0, timestamp + offsetSeconds),
      text: content || " ",
    }))
    .sort((left, right) => left.time - right.time);
};
