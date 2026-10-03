// Iteration marks, 〆, 〇 and the counter ヶ/ヵ behave like kanji in readings
// (人々, 一ヶ月), so they are grouped with the Han ranges.
const KANJI_LIKE = new Set([0x3005, 0x3006, 0x3007, 0x30f5, 0x30f6]);
const SEPARATORS = /[.．。・|｜/／]/;

export function isKanji(char) {
	const code = char.codePointAt(0);
	return (
		KANJI_LIKE.has(code) ||
		(code >= 0x4e00 && code <= 0x9fff) ||
		(code >= 0x3400 && code <= 0x4dbf) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0x20000 && code <= 0x323af)
	);
}

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits text into alternating kanji and non-kanji runs, by code point. */
function splitKanjiRuns(text) {
	const runs = [];
	for (const char of text) {
		const kanji = isKanji(char);
		const last = runs.at(-1);
		if (last && last.kanji === kanji) {
			last.text += char;
		} else {
			runs.push({ text: char, kanji });
		}
	}
	return runs;
}

/**
 * Aligns a reading to mixed kanji/kana text by treating every kana run as a
 * fixed anchor, e.g. 聞き手 + ききて → 聞(き) き 手(て). Returns null when the
 * reading cannot be aligned.
 */
function alignMixed(runs, reading) {
	const pattern = runs
		.map((run) => (run.kanji ? "(.+?)" : escapeRegExp(run.text)))
		.join("");
	const match = reading.match(new RegExp(`^${pattern}$`, "u"));
	if (!match) return null;

	let group = 1;
	return runs.map((run) =>
		run.kanji
			? { text: run.text, reading: match[group++] }
			: { text: run.text, reading: null },
	);
}

/** Assigns separated reading parts to kanji characters one by one. */
function alignSeparated(text, parts) {
	const chars = [...text];
	const kanjiCount = chars.filter(isKanji).length;
	if (parts.length !== kanjiCount) return null;

	let index = 0;
	return chars.map((char) =>
		isKanji(char)
			? { text: char, reading: parts[index++] }
			: { text: char, reading: null },
	);
}

/**
 * Turns base text plus an author reading into ruby segments.
 * - `{*}` / `{*❤}` put an emphasis mark over every character.
 * - `{=…}` puts the literal reading over the whole base.
 * - `{a+b}` joins the parts and puts them over the whole base.
 * - `{に.ほん.ご}` assigns one part per kanji.
 * - Otherwise kana in the base anchors the reading to the kanji runs.
 * Anything that cannot be aligned falls back to the whole reading over the
 * whole base instead of dropping or misplacing characters.
 */
export function parseFurigana(text, reading) {
	const whole = [{ text, reading }];

	if (/^[*＊]/.test(reading)) {
		const mark = reading.slice(1) || "・";
		return [...text].map((char) => ({ text: char, reading: mark }));
	}
	if (/^[=＝]/.test(reading)) {
		return [{ text, reading: reading.slice(1) }];
	}
	if (/[+＋]/.test(reading)) {
		return [{ text, reading: reading.replace(/[+＋]/g, "") }];
	}
	if (SEPARATORS.test(reading)) {
		const parts = reading.split(SEPARATORS).filter(Boolean);
		return alignSeparated(text, parts) ?? [{ text, reading: parts.join("") }];
	}

	const runs = splitKanjiRuns(text);
	if (runs.length <= 1) return whole;
	return alignMixed(runs, reading) ?? whole;
}
