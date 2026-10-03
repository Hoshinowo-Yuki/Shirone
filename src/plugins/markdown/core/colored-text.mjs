/** Fixed-hue content colours (--content-color-*) and M3 role colours. */
export const COLORED_TEXT_NAMES = new Set([
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"purple",
	"pink",
	"gray",
	"primary",
	"secondary",
	"tertiary",
	"error",
]);

const COLOR_ALIASES = new Map([["grey", "gray"]]);
const HEX_DIRECTIVE = /^hex-([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_VALUE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Maps a directive name such as `red` or `hex-ff5733` to a colour value. */
export function resolveColoredTextName(name) {
	if (typeof name !== "string") return null;
	const lower = name.toLowerCase();
	const canonical = COLOR_ALIASES.get(lower) ?? lower;
	if (COLORED_TEXT_NAMES.has(canonical)) return canonical;
	const hex = lower.match(HEX_DIRECTIVE);
	return hex ? `#${hex[1]}` : null;
}

/** Validates a normalised colour value from the directive attributes. */
export function getColoredTextStyle(color) {
	if (COLORED_TEXT_NAMES.has(color)) return { name: color };
	if (typeof color === "string" && HEX_VALUE.test(color)) return { hex: color };
	return null;
}
