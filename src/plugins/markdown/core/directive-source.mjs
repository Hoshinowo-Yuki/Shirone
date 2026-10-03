/** Returns the exact author source covered by a node, or null without positions. */
export function getNodeSource(node, file) {
	const source = typeof file?.value === "string" ? file.value : undefined;
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (source === undefined || start === undefined || end === undefined) {
		return null;
	}
	return source.slice(start, end);
}

/** Turns a rejected directive back into the literal text the author wrote. */
export function restoreDirectiveSource(node, file) {
	const prefix = node.type === "leafDirective" ? "::" : ":";
	const value = getNodeSource(node, file) ?? `${prefix}${node.name}`;

	node.type = "text";
	node.value = value;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}
