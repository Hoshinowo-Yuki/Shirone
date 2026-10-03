const FENCE_OPENER = /^[\t ]{0,3}(`{3,}|~{3,})/;
const MATH_FENCE = /^[\t ]{0,3}\$\$/;
const SINGLE_LINE_MATH = /^[\t ]{0,3}\$\$.*\S.*\$\$[\t ]*$/;
const RUBY_CANDIDATE = /^\[([^[\]\n]+)\]\{([^{}\n]+)\}/;
// Code-like neighbours (arr[0]{...}, f(x)[i]{...}, :name[label]{attrs},
// ![alt]{...}) belong to other syntaxes or are not prose.
const BLOCKED_PREFIX = /[A-Za-z0-9_\])!:\\]/;

function isEscaped(source, index) {
	let backslashCount = 0;
	for (
		let cursor = index - 1;
		cursor >= 0 && source[cursor] === "\\";
		cursor -= 1
	) {
		backslashCount += 1;
	}
	return backslashCount % 2 === 1;
}

/** Rejects attribute blocks ({.class}, {#id}, {key=value}) and code-like text. */
function isReading(reading) {
	return (
		reading.trim() === reading &&
		!/^[.#]/.test(reading) &&
		!/["':;]/.test(reading) &&
		!reading.slice(1).includes("=")
	);
}

function toDirective(base, reading) {
	const value = reading.replaceAll("&", "&amp;");
	return `:m3-ruby[${base}]{reading="${value}"}`;
}

function rewriteLine(line) {
	let output = "";
	let cursor = 0;
	let codeDelimiter = "";
	let inMath = false;

	while (cursor < line.length) {
		const char = line[cursor];

		if (char === "`" && !inMath) {
			const delimiter = line.slice(cursor).match(/^`+/)?.[0] ?? "`";
			if (!codeDelimiter) {
				codeDelimiter = delimiter;
			} else if (delimiter.length === codeDelimiter.length) {
				codeDelimiter = "";
			}
			output += delimiter;
			cursor += delimiter.length;
			continue;
		}

		if (char === "$" && !codeDelimiter && !isEscaped(line, cursor)) {
			inMath = !inMath;
		}

		const candidate =
			char === "[" &&
			!codeDelimiter &&
			!inMath &&
			!isEscaped(line, cursor) &&
			!BLOCKED_PREFIX.test(line[cursor - 1] ?? "")
				? line.slice(cursor).match(RUBY_CANDIDATE)
				: null;

		if (candidate && isReading(candidate[2])) {
			output += toDirective(candidate[1], candidate[2]);
			cursor += candidate[0].length;
			continue;
		}

		output += char;
		cursor += 1;
	}

	return output;
}

/**
 * Rewrites `[base]{reading}` into an `m3-ruby` text directive before
 * remark-directive parses it, so the reading is an attribute (no emphasis
 * parsing of `*`) and the base may hold inline Markdown. Code fences, code
 * spans, math, and escaped brackets stay literal.
 */
export function rewriteFuriganaSyntax(source) {
	if (typeof source !== "string" || !source.includes("]{")) return source;

	let fence = null;
	let mathFence = false;
	return source
		.split(/(\r?\n)/)
		.map((part) => {
			if (part === "\n" || part === "\r\n") return part;

			const fenceMatch = part.match(FENCE_OPENER);
			if (fenceMatch && !mathFence) {
				const marker = fenceMatch[1];
				if (!fence) {
					fence = { character: marker[0], length: marker.length };
				} else if (
					marker[0] === fence.character &&
					marker.length >= fence.length &&
					new RegExp(
						`^[\\t ]{0,3}${fence.character}{${fence.length},}[\\t ]*$`,
					).test(part)
				) {
					fence = null;
				}
				return part;
			}
			if (!fence && MATH_FENCE.test(part)) {
				if (mathFence || !SINGLE_LINE_MATH.test(part)) mathFence = !mathFence;
				return part;
			}

			return fence || mathFence ? part : rewriteLine(part);
		})
		.join("");
}

export function remarkFurigana() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkFurigana requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseFurigana(source) {
		return parser(rewriteFuriganaSyntax(source));
	};
}
