import { h } from "hastscript";

import { getColoredTextStyle } from "./markdown/core/colored-text.mjs";

/** Renders normalised colour directives with theme tokens; hex stays inline. */
export function ColoredTextComponent(properties, children) {
	const content = Array.isArray(children) ? children : [];
	const style = getColoredTextStyle(properties?.color);

	if (style?.name) {
		return h(
			"span",
			{ class: `m3-colored-text m3-colored-text--${style.name}` },
			content,
		);
	}
	if (style?.hex) {
		return h(
			"span",
			{ class: "m3-colored-text", style: `color: ${style.hex}` },
			content,
		);
	}
	return h("span", {}, content);
}
