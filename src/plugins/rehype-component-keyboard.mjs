import { h } from "hastscript";

/** Renders a key cap; `theme` switches it to the primary colour. */
export function KeyboardComponent(properties, children) {
	const key = typeof properties?.key === "string" ? properties.key : "";
	const content = key ? [key] : Array.isArray(children) ? children : [];
	const isThemed = properties != null && "theme" in properties;

	return h(
		"kbd",
		{ class: isThemed ? "m3-kbd m3-kbd--primary" : "m3-kbd" },
		content,
	);
}
