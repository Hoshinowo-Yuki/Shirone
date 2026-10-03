import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders sup and sub directives as native elements", async () => {
	const html = await render("E = mc:sup[2] and H:sub[2]O");

	assert.match(html, /mc<sup>2<\/sup>/);
	assert.match(html, /H<sub>2<\/sub>O/);
});

test("keeps inline formatting inside directive labels", async () => {
	const html = await render(":sup[**bold**]");

	assert.match(html, /<sup><strong>bold<\/strong><\/sup>/);
});

test("drops author attributes from sup and sub directives", async () => {
	const html = await render(':sub[x]{onclick="alert(1)" class="y"}');

	assert.match(html, /<sub>x<\/sub>/);
	assert.doesNotMatch(html, /onclick|class="y"/);
});

test("keeps empty directives as literal text", async () => {
	const html = await render(":sup and :sub[] stay");

	assert.match(html, /<p>:sup and :sub\[\] stay<\/p>/);
	assert.doesNotMatch(html, /<su[bp]>/);
});

test("renders the caret shorthand as superscript", async () => {
	const html = await render("a^n^ + b^n^");

	assert.match(html, /<p>a<sup>n<\/sup> \+ b<sup>n<\/sup><\/p>/);
});

test("does not match the caret shorthand across whitespace", async () => {
	const html = await render("2^10 is big and 3^4 is small");

	assert.match(html, /<p>2\^10 is big and 3\^4 is small<\/p>/);
});

test("leaves code, math, escapes, and footnote-like markers literal", async () => {
	assert.match(await render("`a^b^c`"), /<code>a\^b\^c<\/code>/);
	assert.doesNotMatch(await render("$x^{2}$"), /<sup>/);
	assert.match(await render("\\^x^ stays"), /<p>\^x\^ stays<\/p>/);
	assert.match(await render("[^a]b^ text"), /<p>\[\^a\]b\^ text<\/p>/);
});

test("leaves GFM tilde strikethrough and URLs untouched", async () => {
	assert.match(await render("~one~"), /<del>one<\/del>/);
	assert.match(
		await render("see http://a.com/~user/~other"),
		/>http:\/\/a\.com\/~user\/~other<\/a>/,
	);
});

test("records the supersub syntax for both forms", async () => {
	for (const markdown of ["x^2^", "H:sub[2]O"]) {
		const { metadata } = await renderer.render(markdown);
		assert.deepEqual(metadata.frontmatter.markdownSyntaxes.syntaxes, [
			"supersub",
		]);
	}
});
