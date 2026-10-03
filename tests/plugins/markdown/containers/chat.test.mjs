import assert from "node:assert/strict";
import { test } from "node:test";

import {
	ChatComponent,
	toDatetime,
} from "../../../../src/plugins/rehype-component-chat.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders messages as a not-prose transcript list", async () => {
	const html = await render(`:::chat
[Alice|10:00]
Hello

[Bob|10:01|right]
Hi
:::`);

	assert.match(html, /^<ol class="m3-chat not-prose">/);
	assert.match(
		html,
		/<li class="m3-chat__message m3-chat__message--start"><div class="m3-chat__meta"><span class="m3-chat__name">Alice<\/span><time class="m3-chat__time" datetime="10:00">10:00<\/time><\/div><div class="m3-chat__bubble"><p>Hello<\/p><\/div><\/li>/,
	);
	assert.match(
		html,
		/m3-chat__message--end"><div class="m3-chat__meta"><span class="m3-chat__name">Bob/,
	);
});

test("keeps inline and block Markdown inside messages", async () => {
	const html = await render(`:::chat
[Alice|10:00]
Hello **there**, *see* [the link](http://e.com) and \`code\`

> quoted

- item
:::`);

	assert.match(
		html,
		/<p>Hello <strong>there<\/strong>, <em>see<\/em> <a href="http:\/\/e\.com">the link<\/a> and <code>code<\/code><\/p>/,
	);
	assert.match(html, /<blockquote>\s*<p>quoted<\/p>\s*<\/blockquote>/);
	assert.match(html, /<ul>\s*<li>item<\/li>\s*<\/ul><\/div><\/li><\/ol>/);
});

test("accepts message text on the header line", async () => {
	const html = await render(":::chat\n[Alice|10:00] Same line\n:::");

	assert.match(html, /<div class="m3-chat__bubble"><p>Same line<\/p><\/div>/);
});

test("renders replies with an inline SVG icon", async () => {
	const html = await render(":::chat\n[Bob|10:01|right|Alice]\nHi\n:::");

	assert.match(
		html,
		/<p class="m3-chat__reply"><svg class="m3-chat__reply-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="[^"]+"><\/path><\/svg>@Alice<\/p><p>Hi<\/p>/,
	);
	assert.doesNotMatch(html, /iconify-icon/);
});

test("keeps content before the first header as a note", async () => {
	const html = await render(":::chat\nAlice joined\n\n[Alice|10:00]\nhi\n:::");

	assert.match(
		html,
		/<ol class="m3-chat not-prose"><li class="m3-chat__note"><p>Alice joined<\/p><\/li><li class="m3-chat__message/,
	);
});

test("falls back to the start side for empty or unknown positions", async () => {
	const html = await render(":::chat\n[A|1|middle]\nx\n\n[B|2||A]\ny\n:::");

	assert.equal(html.match(/m3-chat__message--start/g)?.length, 2);
	assert.match(html, /@A<\/p><p>y<\/p>/);
});

test("renders nothing for an empty chat and warns", async () => {
	const messages = [];
	const result = ChatComponent({}, [], {
		vfile: { message: (text) => messages.push(text) },
	});

	assert.equal(result, null);
	assert.deepEqual(messages, ["[chat] empty :::chat block was not rendered"]);
	assert.equal(await render(":::chat\n:::"), "");
});

test("warns about unknown positions and missing headers", () => {
	const messages = [];
	const context = { vfile: { message: (text) => messages.push(text) } };
	const paragraph = (value) => ({
		type: "element",
		tagName: "p",
		properties: {},
		children: [{ type: "text", value }],
	});

	ChatComponent({}, [paragraph("[A|1|middle] hi")], context);
	ChatComponent({}, [paragraph("just prose")], context);

	assert.deepEqual(messages, [
		'[chat] unknown position "middle", using "left"',
		"[chat] no [user|time] message headers found",
	]);
});

test("renders [[date]] paragraphs as dividers that end the message", async () => {
	const html = await render(`:::chat
[[2026-10-02]]

[Alice|23:58]
Still up?

[[Yesterday]]

after the divider
:::`);

	assert.match(
		html,
		/^<ol class="m3-chat not-prose"><li class="m3-chat__divider"><time class="m3-chat__divider-label" datetime="2026-10-02">2026-10-02<\/time><\/li>/,
	);
	assert.match(
		html,
		/<li class="m3-chat__divider"><span class="m3-chat__divider-label">Yesterday<\/span><\/li><li class="m3-chat__note"><p>after the divider<\/p><\/li><\/ol>$/,
	);
});

test("does not treat inline or formatted double brackets as dividers", async () => {
	const html = await render(
		":::chat\n[A|1]\nsee [[x]] here\n\n[[**bold**]]\n:::",
	);

	assert.doesNotMatch(html, /m3-chat__divider/);
	assert.match(html, /see \[\[x\]\] here/);
});

test("marks valid header times as machine-readable", async () => {
	const html = await render(`:::chat
[A|10:00]
a

[B|2026-10-03 00:02|right]
b

[C|just now]
c
:::`);

	assert.match(
		html,
		/<time class="m3-chat__time" datetime="10:00">10:00<\/time>/,
	);
	assert.match(
		html,
		/<time class="m3-chat__time" datetime="2026-10-03T00:02"><span class="m3-chat__date">2026-10-03<\/span> <span class="m3-chat__clock">00:02<\/span><\/time>/,
	);
	assert.match(html, /<span class="m3-chat__time">just now<\/span>/);
});

test("accepts only real dates and times as datetime values", () => {
	assert.equal(toDatetime("2026-10-03"), "2026-10-03");
	assert.equal(toDatetime("2026-10-03 10:01:30"), "2026-10-03T10:01:30");
	assert.equal(toDatetime("2026-10-03T10:01"), "2026-10-03T10:01");
	assert.equal(toDatetime("23:59"), "23:59");
	assert.equal(toDatetime("2026-02-30"), null);
	assert.equal(toDatetime("2026-13-01"), null);
	assert.equal(toDatetime("25:00"), null);
	assert.equal(toDatetime("2026-10-03 24:00"), null);
	assert.equal(toDatetime("Yesterday"), null);
});

test("renders ((text)) paragraphs as notes anywhere in the chat", async () => {
	const html = await render(`:::chat
((Alice joined the conversation))

[Alice|10:00]
hi

((**Bob** left the conversation))

[Alice|10:05]
bye
:::`);

	assert.match(
		html,
		/^<ol class="m3-chat not-prose"><li class="m3-chat__note"><p>Alice joined the conversation<\/p><\/li>/,
	);
	assert.match(
		html,
		/<p>hi<\/p><\/div><\/li><li class="m3-chat__note"><p><strong>Bob<\/strong> left the conversation<\/p><\/li><li class="m3-chat__message/,
	);
});

test("keeps inline, empty, or unclosed parentheses inside the message", async () => {
	const html = await render(
		":::chat\n[A|1]\nhi (( not a note )) inline\n\n(())\n\n((x\n:::",
	);

	assert.doesNotMatch(html, /m3-chat__note/);
	assert.match(
		html,
		/<p>hi \(\( not a note \)\) inline<\/p><p>\(\(\)\)<\/p><p>\(\(x<\/p>/,
	);
});

test("records the chat syntax only for non-empty blocks", async () => {
	const chat = await renderer.render(":::chat\n[A|1]\nhi\n:::");
	const empty = await renderer.render(":::chat\n:::");

	assert.deepEqual(chat.metadata.frontmatter.markdownSyntaxes.syntaxes, [
		"chat",
	]);
	assert.deepEqual(empty.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
});
