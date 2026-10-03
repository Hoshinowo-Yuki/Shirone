import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFurigana } from "../../../../src/plugins/markdown/core/furigana.mjs";
import { rewriteFuriganaSyntax } from "../../../../src/plugins/markdown/remark-furigana.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

const readings = (text, reading) =>
	parseFurigana(text, reading).map((part) =>
		part.reading ? `${part.text}(${part.reading})` : part.text,
	);

test("renders native ruby with fallback parentheses", async () => {
	const html = await render("今日は[漢字]{かんじ}です");

	assert.match(
		html,
		/今日は<span class="m3-furigana"><ruby>漢字<rp>【<\/rp><rt>かんじ<\/rt><rp>】<\/rp><\/ruby><\/span>です/,
	);
});

test("anchors readings on okurigana, including kana repeated in the reading", () => {
	assert.deepEqual(readings("食べる", "たべる"), ["食(た)", "べる"]);
	assert.deepEqual(readings("聞き手", "ききて"), ["聞(き)", "き", "手(て)"]);
	assert.deepEqual(readings("行き来", "いきき"), ["行(い)", "き", "来(き)"]);
	assert.deepEqual(readings("書き換え", "かきかえ"), [
		"書(か)",
		"き",
		"換(か)",
		"え",
	]);
});

test("treats iteration marks and supplementary kanji as kanji", () => {
	assert.deepEqual(readings("人々", "ひとびと"), ["人々(ひとびと)"]);
	assert.deepEqual(readings("時々雨", "ときどきあめ"), [
		"時々雨(ときどきあめ)",
	]);
	assert.deepEqual(readings("一ヶ月", "いっかげつ"), ["一ヶ月(いっかげつ)"]);
	assert.deepEqual(readings("𠮟る", "しかる"), ["𠮟(しか)", "る"]);
});

test("assigns separated parts per kanji and falls back on a count mismatch", () => {
	assert.deepEqual(readings("日本語", "に.ほん.ご"), [
		"日(に)",
		"本(ほん)",
		"語(ご)",
	]);
	assert.deepEqual(readings("東京", "とう.きょう.と"), ["東京(とうきょうと)"]);
});

test("supports literal, combined, and emphasis-mark readings", () => {
	assert.deepEqual(readings("今日", "=きょう"), ["今日(きょう)"]);
	assert.deepEqual(readings("可愛い", "か+わいい"), ["可愛い(かわいい)"]);
	assert.deepEqual(readings("すごい", "*"), ["す(・)", "ご(・)", "い(・)"]);
	assert.deepEqual(readings("あい", "*❤"), ["あ(❤)", "い(❤)"]);
});

test("falls back to the whole reading when okurigana cannot be aligned", () => {
	assert.deepEqual(readings("食べる", "くう"), ["食べる(くう)"]);
});

test("keeps several emphasis-mark readings on one line", async () => {
	const html = await render("[すごい]{*} and [ほんとう]{*}");

	assert.equal(html.match(/<rt>・<\/rt>/g)?.length, 7);
	assert.doesNotMatch(html, /<em>/);
});

test("keeps inline Markdown in the base", async () => {
	const html = await render("[漢*字*]{かんじ}");

	assert.match(html, /<ruby>漢<em>字<\/em><rp>【<\/rp><rt>かんじ<\/rt>/);
});

test("wins over a link reference with the same label", async () => {
	const html = await render("[漢字]{かんじ}\n\n[漢字]: http://x.com");

	assert.match(html, /<ruby>漢字<rp>/);
	assert.doesNotMatch(html, /<a /);
});

test("builds heading IDs from the base text only", async () => {
	const html = await render("## [漢字]{かんじ}の話");

	assert.match(html, /<h2 id="漢字の話">/);
});

test("leaves code, math, escapes, attributes, and code-like text literal", () => {
	for (const source of [
		"`[漢字]{かんじ}`",
		"$\\sqrt[3]{x}$",
		"\\[漢字]{かんじ}",
		"arr[0]{x: 1}",
		"f(x)[i]{y}",
		":red[text]{.cls}",
		"![alt]{x}",
		"[text]{.cls}",
		"[text]{#id}",
		"[text]{key=value}",
		'[text]{a"b}',
		"```\n[漢字]{かんじ}\n```",
		"$$\n\\sqrt[3]{x}\n$$",
	]) {
		assert.equal(rewriteFuriganaSyntax(source), source, source);
	}
});

test("resumes after a single-line display math block", () => {
	assert.equal(
		rewriteFuriganaSyntax("$$\\sqrt[3]{y}$$\n\n[後]{あと}"),
		'$$\\sqrt[3]{y}$$\n\n:m3-ruby[後]{reading="あと"}',
	);
});

test("records the furigana syntax only when ruby is rendered", async () => {
	const ruby = await renderer.render("[漢字]{かんじ}");
	const plain = await renderer.render("arr[0]{x: 1}");

	assert.deepEqual(ruby.metadata.frontmatter.markdownSyntaxes.syntaxes, [
		"furigana",
	]);
	assert.deepEqual(plain.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
});
