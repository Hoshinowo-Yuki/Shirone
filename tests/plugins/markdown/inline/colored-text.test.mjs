import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("maps colour names and M3 roles to token classes", async () => {
	const html = await render(":red[a] :Grey[b] :primary[c]");

	assert.match(
		html,
		/<span class="m3-colored-text m3-colored-text--red">a<\/span>/,
	);
	assert.match(
		html,
		/<span class="m3-colored-text m3-colored-text--gray">b<\/span>/,
	);
	assert.match(
		html,
		/<span class="m3-colored-text m3-colored-text--primary">c<\/span>/,
	);
	assert.doesNotMatch(html, /style=/);
});

test("keeps inline formatting inside the label", async () => {
	const html = await render(":blue[**bold**]");

	assert.match(html, /m3-colored-text--blue"><strong>bold<\/strong><\/span>/);
});

test("renders 3- and 6-digit hex colours as inline styles", async () => {
	const html = await render(":hex-ff5733[a] :hex-F53[b]");

	assert.match(html, /<span class="m3-colored-text" style="color: #ff5733">a/);
	assert.match(html, /<span class="m3-colored-text" style="color: #f53">b/);
});

test("keeps malformed hex and labelless colours literal", async () => {
	const html = await render(
		":hex-ff573[five] :hex-zzz[bad] status:red and :red[] empty",
	);

	assert.match(
		html,
		/<p>:hex-ff573\[five\] :hex-zzz\[bad\] status:red and :red\[\] empty<\/p>/,
	);
});

test("drops author attributes", async () => {
	const html = await render(':blue[x]{style="color:red" onclick="a()"}');

	assert.match(html, /<span class="m3-colored-text m3-colored-text--blue">x/);
	assert.doesNotMatch(html, /onclick|color:red/);
});

test("records the colored-text syntax only for valid colours", async () => {
	const valid = await renderer.render(":red[a]");
	const invalid = await renderer.render(":hex-zzz[a] and status:red");

	assert.deepEqual(valid.metadata.frontmatter.markdownSyntaxes.syntaxes, [
		"colored-text",
	]);
	assert.deepEqual(invalid.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
});
