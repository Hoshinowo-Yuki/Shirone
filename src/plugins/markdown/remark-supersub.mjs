import { visit } from "unist-util-visit";

import {
	getNodeSource,
	restoreDirectiveSource,
} from "./core/directive-source.mjs";

const SUPERSUB_DIRECTIVES = new Set(["sup", "sub"]);
// No whitespace or brackets inside, so prose like `2^10 and 3^4` and
// unresolved footnote markers like `[^a]` stay literal.
const SUPERSCRIPT_SHORTHAND = /(?<!\[)\^([^\s^[\]]+)\^/g;

function createSupDirective(value) {
	return {
		type: "textDirective",
		name: "sup",
		attributes: {},
		children: [{ type: "text", value }],
	};
}

function splitSuperscriptShorthand(value) {
	const parts = [];
	let lastIndex = 0;
	for (const match of value.matchAll(SUPERSCRIPT_SHORTHAND)) {
		if (match.index > lastIndex) {
			parts.push({ type: "text", value: value.slice(lastIndex, match.index) });
		}
		parts.push(createSupDirective(match[1]));
		lastIndex = match.index + match[0].length;
	}
	if (parts.length === 0) return null;
	if (lastIndex < value.length) {
		parts.push({ type: "text", value: value.slice(lastIndex) });
	}
	return parts;
}

/**
 * Normalizes `:sup[...]` / `:sub[...]` and the `^text^` shorthand into
 * attribute-free text directives that parseDirectiveNode maps to <sup>/<sub>.
 * Runs after remarkDirective so code, math, and links are already separate
 * nodes. Subscript has no shorthand: GFM owns `~text~` as strikethrough.
 */
export function remarkSupersub() {
	return (tree, file) => {
		visit(tree, "textDirective", (node) => {
			if (!SUPERSUB_DIRECTIVES.has(node.name)) return;

			if (!node.children?.length) {
				restoreDirectiveSource(node, file);
				return;
			}

			// Author attributes would otherwise pass straight through to HTML.
			node.attributes = {};
		});

		visit(tree, "text", (node, index, parent) => {
			if (!parent || index === undefined || !node.value.includes("^")) return;

			// The parser drops backslashes, so an escaped caret is only visible
			// in the source; leave the whole text run literal in that case.
			if (getNodeSource(node, file)?.includes("\\^")) return;

			const parts = splitSuperscriptShorthand(node.value);
			if (!parts) return;

			parent.children.splice(index, 1, ...parts);
			return index + parts.length;
		});
	};
}
