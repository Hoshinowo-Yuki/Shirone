import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders inline keys from the key attribute or the label", async () => {
	const html = await render(
		'Press :keyboard{key="Ctrl"} + :keyboard[**Shift**]',
	);

	assert.match(html, /<kbd class="m3-kbd">Ctrl<\/kbd>/);
	assert.match(html, /<kbd class="m3-kbd"><strong>Shift<\/strong><\/kbd>/);
	assert.doesNotMatch(html, /style=/);
});

test("uses a class for the theme flag", async () => {
	const html = await render(':keyboard{key="C" theme}');

	assert.match(html, /<kbd class="m3-kbd m3-kbd--primary">C<\/kbd>/);
});

test("renders the standalone leaf form", async () => {
	const html = await render('::keyboard{key="Enter"}');

	assert.match(html, /<kbd class="m3-kbd">Enter<\/kbd>/);
});

test("keeps keyboard directives without key or label literal", async () => {
	assert.match(await render(":keyboard alone"), /<p>:keyboard alone<\/p>/);
	assert.match(await render("::keyboard"), /::keyboard/);
	assert.doesNotMatch(await render("::keyboard"), /<kbd/);
});

test("drops attributes other than key and theme", async () => {
	const html = await render(':keyboard{key="A" onclick="x()" class="evil"}');

	assert.match(html, /<kbd class="m3-kbd">A<\/kbd>/);
	assert.doesNotMatch(html, /onclick|evil/);
});

test("records the keyboard syntax only for valid keys", async () => {
	const valid = await renderer.render(':keyboard{key="A"}');
	const invalid = await renderer.render(":keyboard alone");

	assert.deepEqual(valid.metadata.frontmatter.markdownSyntaxes.syntaxes, [
		"keyboard",
	]);
	assert.deepEqual(invalid.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
});
