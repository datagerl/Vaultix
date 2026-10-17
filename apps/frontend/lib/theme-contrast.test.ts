/**
 * Verifies WCAG 2.1 AA contrast for the semantic colour tokens defined in
 * app/globals.css, in both the light (:root) and dark (.dark) themes.
 * Reads the real stylesheet so a token change that breaks contrast fails CI.
 */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function parseTokens(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  if (!block) throw new Error(`No ${selector} block found in globals.css`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Converts an opaque `oklch(L C H)` value to relative luminance (WCAG). */
function oklchLuminance(value: string): number {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`Unsupported or translucent colour: ${value}`);
  const [L, C, H] = m.slice(1).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);

  // OKLab -> linear sRGB (Björn Ottosson's reference matrices)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const r = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);

  // Relative luminance is defined on linear-light channels.
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [oklchLuminance(fg), oklchLuminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;

/** [foreground token, background token] pairs that render body-size text. */
const TEXT_PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['brand', 'background'],
  ['brand', 'card'],
  ['brand-foreground', 'brand'],
];

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('%s theme tokens', (_name, selector) => {
  // Dark overrides inherit anything they don't redefine from :root.
  const tokens = { ...parseTokens(':root'), ...parseTokens(selector) };

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(tokens[fg]).toBeDefined();
    expect(tokens[bg]).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('contrast helper', () => {
  it('matches known reference values', () => {
    expect(contrast('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 0);
    expect(contrast('oklch(1 0 0)', 'oklch(1 0 0)')).toBeCloseTo(1, 5);
  });
});
