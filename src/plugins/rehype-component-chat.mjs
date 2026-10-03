import { h, s } from "hastscript";

// [user|time], [user|time|right], [user|time|left|replyTo], [user|time||replyTo]
const HEADER =
	/^\[([^|\]\n]+)\|([^|\]\n]+)(?:\|([^|\]\n]*))?(?:\|([^\]\n]+))?\]/;
const POSITIONS = new Map([
	["", "start"],
	["left", "start"],
	["right", "end"],
]);
// [[2026-10-03]] or [[Yesterday]] alone in a paragraph: a date divider.
const DIVIDER = /^\[\[([^[\]\n]+)\]\]$/;
const DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
// Material Design "reply" icon (Apache-2.0), inlined so it renders without hydration.
const REPLY_ICON_PATH =
	"M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z";

function isBlank(node) {
	return node.type === "text" && !node.value.trim();
}

function warn(context, message) {
	context?.vfile?.message?.(`[chat] ${message}`);
}

function isValidTime(hours, minutes, seconds = "00") {
	return Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60;
}

/**
 * Returns an HTML datetime value for `YYYY-MM-DD`, `YYYY-MM-DD HH:mm[:ss]`,
 * or `HH:mm[:ss]`, or null for free text and impossible dates (2026-02-30).
 */
export function toDatetime(text) {
	const time = text.match(TIME);
	if (time) return isValidTime(time[1], time[2], time[3]) ? text : null;

	const match = text.match(DATE_TIME);
	if (!match) return null;
	const [, year, month, day, hours, minutes, seconds] = match;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== Number(day)
	) {
		return null;
	}
	if (hours === undefined) return `${year}-${month}-${day}`;
	if (!isValidTime(hours, minutes, seconds)) return null;
	return `${year}-${month}-${day}T${hours}:${minutes}${seconds ? `:${seconds}` : ""}`;
}

function renderTimeText(className, text) {
	const datetime = toDatetime(text);
	if (!datetime) return h("span", { class: className }, text);

	// Date and time of day get separate spans so CSS can space them apart;
	// the plain space between them keeps copied text readable.
	const [date, time] = text.split(/[ T]/);
	const content = time
		? [
				h("span", { class: "m3-chat__date" }, date),
				" ",
				h("span", { class: "m3-chat__clock" }, time),
			]
		: text;
	return h("time", { class: className, datetime }, content);
}

function readDivider(node) {
	if (node.type !== "element" || node.tagName !== "p") return null;
	if (node.children.length !== 1 || node.children[0].type !== "text") {
		return null;
	}
	const label = node.children[0].value.trim().match(DIVIDER)?.[1].trim();
	return label || null;
}

/**
 * Reads a `((Bob left the conversation))` paragraph and returns its inner
 * nodes with the parentheses removed, keeping inline Markdown.
 */
function readNote(node) {
	if (node.type !== "element" || node.tagName !== "p") return null;
	const first = node.children[0];
	const last = node.children.at(-1);
	if (first?.type !== "text" || last?.type !== "text") return null;
	if (!first.value.trimStart().startsWith("((")) return null;
	if (!last.value.trimEnd().endsWith("))")) return null;

	const inner = node.children.map((child) => ({ ...child }));
	inner[0].value = inner[0].value.trimStart().slice(2);
	const end = inner.at(-1);
	end.value = end.value.trimEnd().slice(0, -2);

	return inner.some((child) => !isBlank(child)) ? inner : null;
}

/** Splits a header off the start of a paragraph, keeping the rest of its nodes. */
function readHeader(paragraph, context) {
	if (paragraph.type !== "element" || paragraph.tagName !== "p") return null;
	const [first, ...rest] = paragraph.children;
	if (first?.type !== "text") return null;

	const match = first.value.match(HEADER);
	if (!match) return null;

	const [, username, timestamp, rawPosition = "", replyTo] = match;
	const positionKey = rawPosition.trim().toLowerCase();
	if (!POSITIONS.has(positionKey)) {
		warn(context, `unknown position "${rawPosition}", using "left"`);
	}

	const remainder = first.value.slice(match[0].length).replace(/^\s+/, "");
	const inline = remainder
		? [{ type: "text", value: remainder }, ...rest]
		: rest;

	return {
		username: username.trim(),
		timestamp: timestamp.trim(),
		side: POSITIONS.get(positionKey) ?? "start",
		replyTo: replyTo?.trim() || null,
		content: inline.some((node) => !isBlank(node)) ? [h("p", inline)] : [],
	};
}

function renderReply(replyTo) {
	return h("p", { class: "m3-chat__reply" }, [
		s(
			"svg",
			{
				class: "m3-chat__reply-icon",
				viewBox: "0 0 24 24",
				"aria-hidden": "true",
				focusable: "false",
			},
			[s("path", { d: REPLY_ICON_PATH })],
		),
		`@${replyTo}`,
	]);
}

function renderMessage(message) {
	return h(
		"li",
		{ class: `m3-chat__message m3-chat__message--${message.side}` },
		[
			h("div", { class: "m3-chat__meta" }, [
				h("span", { class: "m3-chat__name" }, message.username),
				renderTimeText("m3-chat__time", message.timestamp),
			]),
			h("div", { class: "m3-chat__bubble" }, [
				...(message.replyTo ? [renderReply(message.replyTo)] : []),
				...message.content,
			]),
		],
	);
}

/**
 * Renders `:::chat` as a transcript list. Paragraphs starting with a
 * `[user|time…]` header open a message; everything up to the next header
 * belongs to it with its Markdown intact. A `[[date]]` paragraph adds a date
 * divider and a `((text))` paragraph adds a centred note, such as someone
 * joining or leaving; both end the current message. Unmarked content before
 * the first header or right after a divider or note is also kept as a note
 * rather than dropped.
 */
export function ChatComponent(_properties, children, context) {
	const items = [];
	let message = null;
	let notes = [];

	const flushNotes = () => {
		if (notes.length) {
			items.push(h("li", { class: "m3-chat__note" }, notes));
			notes = [];
		}
	};

	for (const child of Array.isArray(children) ? children : []) {
		if (isBlank(child)) continue;

		const divider = readDivider(child);
		if (divider) {
			flushNotes();
			message = null;
			items.push(
				h("li", { class: "m3-chat__divider" }, [
					renderTimeText("m3-chat__divider-label", divider),
				]),
			);
			continue;
		}

		const note = readNote(child);
		if (note) {
			flushNotes();
			message = null;
			items.push(h("li", { class: "m3-chat__note" }, [h("p", note)]));
			continue;
		}

		const header = readHeader(child, context);
		if (header) {
			flushNotes();
			message = header;
			items.push(message);
		} else if (message) {
			message.content.push(child);
		} else {
			notes.push(child);
		}
	}
	flushNotes();

	if (items.length === 0) {
		warn(context, "empty :::chat block was not rendered");
		return null;
	}
	if (!items.some((item) => item.username)) {
		warn(context, "no [user|time] message headers found");
	}

	return h(
		"ol",
		{ class: "m3-chat not-prose" },
		items.map((item) => (item.username ? renderMessage(item) : item)),
	);
}
