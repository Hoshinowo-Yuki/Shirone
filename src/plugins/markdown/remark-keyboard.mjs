import { visit } from "unist-util-visit";

import { restoreDirectiveSource } from "./core/directive-source.mjs";

const KEYBOARD_NODE_TYPES = new Set(["textDirective", "leafDirective"]);

/**
 * Validates `:keyboard[Ctrl]`, `:keyboard{key="Ctrl"}`, and the standalone
 * `::keyboard` line form. Keeps only `key` and the `theme` flag, and leaves
 * directives with neither key nor label as the literal text the author wrote.
 */
export function remarkKeyboard() {
	return (tree, file) => {
		visit(tree, (node) => {
			if (!KEYBOARD_NODE_TYPES.has(node.type) || node.name !== "keyboard") {
				return;
			}

			const key =
				typeof node.attributes?.key === "string"
					? node.attributes.key.trim()
					: "";
			if (!key && !node.children?.length) {
				restoreDirectiveSource(node, file);
				return;
			}

			const hasTheme = Object.hasOwn(node.attributes ?? {}, "theme");
			node.attributes = {
				...(key ? { key } : {}),
				...(hasTheme ? { theme: "" } : {}),
			};
		});
	};
}
