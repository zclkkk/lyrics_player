import type { LyricLine } from './types';

export const parseLrc = (text: string): LyricLine[] => {
	const normalizedText = String(text || '').replace(/\r/g, '');

	if (!normalizedText.trim()) {
		return [];
	}

	const rows = normalizedText.split('\n');
	const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
	const lines: LyricLine[] = [];

	for (const row of rows) {
		const content = row.replace(timePattern, '').trim();
		let matched = false;

		for (const match of row.matchAll(timePattern)) {
			matched = true;
			const minutes = Number(match[1] || '0');
			const seconds = Number(match[2] || '0');
			const fractionText = match[3] || '0';
			const fraction = Number(fractionText.padEnd(3, '0')) / 1000;

			lines.push({
				time: minutes * 60 + seconds + fraction,
				text: content || ' ',
			});
		}

		if (!matched && row.trim()) {
			const trimmed = row.trim();
			if (!/^\[[a-z]+:/i.test(trimmed)) {
				return [
					{
						time: Number.POSITIVE_INFINITY,
						text: '【LRC 格式异常：存在无时间标签的行，请补全后导入】',
						isError: true,
					},
				];
			}
			lines.push({ time: Number.POSITIVE_INFINITY, text: trimmed });
		}
	}

	lines.sort((a, b) => a.time - b.time);
	return lines;
};
