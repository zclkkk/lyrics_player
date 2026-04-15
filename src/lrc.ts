import { Lrc } from "lrc-kit";

import type { LyricLine } from "./types";

export const parseLrc = (text: string): LyricLine[] => {
  const { info, lyrics } = Lrc.parse(text);
  const offsetSeconds = Number(info.offset) / 1000 || 0;

  return lyrics
    .map<LyricLine>(({ timestamp, content }) => ({
      time: Math.max(0, timestamp + offsetSeconds),
      text: content || " ",
    }))
    .sort((left, right) => left.time - right.time);
};
