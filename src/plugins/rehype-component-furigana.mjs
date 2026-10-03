import { h } from "hastscript";

import { parseFurigana } from "./markdown/core/furigana.mjs";

function createRuby(base, reading) {
	return h("ruby", [...base, h("rp", "【"), h("rt", reading), h("rp", "】")]);
}

/**
 * Renders `m3-ruby` directives. Runs after rehypeSlug, so heading IDs come
 * from the base text alone. Plain-text bases are split per kanji run; bases
 * with inline Markdown get the whole reading over the whole label.
 */
export function FuriganaComponent(properties, children) {
	const content = Array.isArray(children) ? children : [];
	const reading =
		typeof properties?.reading === "string" ? properties.reading : "";
	if (!reading) return h("span", content);

	const isPlainText = content.every((child) => child.type === "text");
	const segments = isPlainText
		? parseFurigana(content.map((child) => child.value).join(""), reading).map(
				(part) =>
					part.reading
						? createRuby([{ type: "text", value: part.text }], part.reading)
						: { type: "text", value: part.text },
			)
		: [createRuby(content, reading)];

	return h("span", { class: "m3-furigana" }, segments);
}
