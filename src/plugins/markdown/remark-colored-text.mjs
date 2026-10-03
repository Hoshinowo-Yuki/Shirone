import { visit } from "unist-util-visit";

import { resolveColoredTextName } from "./core/colored-text.mjs";
import { restoreDirectiveSource } from "./core/directive-source.mjs";

/**
 * Normalizes `:red[...]`, `:primary[...]`, and `:hex-ff5733[...]` into a
 * single `colored-text` directive for ColoredTextComponent. Labelless forms
 * such as `status:red` stay literal instead of becoming empty elements.
 */
export function remarkColoredText() {
	return (tree, file) => {
		visit(tree, "textDirective", (node) => {
			const color = resolveColoredTextName(node.name);
			// `hex-` is owned by this syntax, so a malformed value stays literal
			// instead of becoming an unknown <hex-…> element.
			const isMalformedHex = !color && /^hex-/i.test(node.name);
			if (!color && !isMalformedHex) return;

			if (isMalformedHex || !node.children?.length) {
				restoreDirectiveSource(node, file);
				return;
			}

			node.name = "colored-text";
			node.attributes = { color };
		});
	};
}
