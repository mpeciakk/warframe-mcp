import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COLOR_PALETTES } from "../data/color-palettes.js";

// ─── Color math (sRGB → CIELAB) ─────────────────────────────────────────────

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

/** Parse 6-char hex (no #) to RGB 0-255 */
function hexToRgb(hex: string): RGB {
  const n = parseInt(hex, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

/** sRGB → linear RGB (inverse companding) */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Linear RGB → CIE XYZ (D65 illuminant) */
function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
    z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
  };
}

// D65 reference white
const REF_X = 0.95047;
const REF_Y = 1.0;
const REF_Z = 1.08883;

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta * delta * delta
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

/** CIE XYZ → CIELAB */
function xyzToLab(xyz: { x: number; y: number; z: number }): Lab {
  const fx = labF(xyz.x / REF_X);
  const fy = labF(xyz.y / REF_Y);
  const fz = labF(xyz.z / REF_Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Convert hex string to CIELAB */
function hexToLab(hex: string): Lab {
  return xyzToLab(rgbToXyz(hexToRgb(hex)));
}

/** Euclidean distance in CIELAB space (ΔE*ab) — perceptually uniform */
function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
  );
}

/** Describe approximate color name from hue/saturation/lightness */
function describeColor(rgb: RGB): string {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (l < 0.08) return "black";
  if (l > 0.95 && s < 0.1) return "white";
  if (s < 0.1) return l > 0.6 ? "light gray" : l > 0.3 ? "gray" : "dark gray";

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  const lightPrefix = l > 0.7 ? "light " : l < 0.3 ? "dark " : "";
  if (h < 15 || h >= 345) return `${lightPrefix}red`;
  if (h < 45) return `${lightPrefix}orange`;
  if (h < 70) return `${lightPrefix}yellow`;
  if (h < 160) return `${lightPrefix}green`;
  if (h < 195) return `${lightPrefix}cyan`;
  if (h < 265) return `${lightPrefix}blue`;
  if (h < 290) return `${lightPrefix}purple`;
  if (h < 345) return `${lightPrefix}pink`;
  return `${lightPrefix}red`;
}

// ─── Precomputed palette index ───────────────────────────────────────────────

interface PaletteColor {
  paletteName: string;
  paletteKey: string;
  hex: string;
  lab: Lab;
  row: number;   // 0-indexed (0–17)
  col: number;   // 0-indexed (0–4)
}

let colorIndex: PaletteColor[] | null = null;

function getColorIndex(): PaletteColor[] {
  if (colorIndex) return colorIndex;

  colorIndex = [];
  for (const [key, palette] of COLOR_PALETTES) {
    for (let i = 0; i < palette.colors.length; i++) {
      const hex = palette.colors[i];
      colorIndex.push({
        paletteName: palette.displayName,
        paletteKey: key,
        hex,
        lab: hexToLab(hex),
        row: Math.floor(i / 5),
        col: i % 5,
      });
    }
  }

  return colorIndex;
}

// ─── Find closest matches ────────────────────────────────────────────────────

interface ColorMatch {
  palette: string;
  hex: string;
  row: number;
  col: number;
  distance: number;
  exact: boolean;
}

function findClosestColors(
  targetHex: string,
  limit: number,
  paletteName?: string
): ColorMatch[] {
  const targetLab = hexToLab(targetHex);
  const index = getColorIndex();

  let candidates = index;
  if (paletteName) {
    const lower = paletteName.toLowerCase();
    candidates = index.filter(
      (c) =>
        c.paletteKey.includes(lower) ||
        c.paletteName.toLowerCase().includes(lower)
    );
  }

  const scored = candidates.map((c) => ({
    palette: c.paletteName,
    hex: c.hex,
    row: c.row,
    col: c.col,
    distance: deltaE(targetLab, c.lab),
    exact: c.hex.toLowerCase() === targetHex.toLowerCase(),
  }));

  scored.sort((a, b) => a.distance - b.distance);

  // Deduplicate (same hex in different palettes are separate results — that's fine)
  return scored.slice(0, limit);
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerColorTools(server: McpServer): void {
  server.tool(
    "color_palette_finder",
    "Find the closest matching color in Warframe's color palettes. Input a hex color code and get the exact palette, row, and column of the best match. Fashion Frame endgame tool.",
    {
      hex_color: z
        .string()
        .describe(
          'Hex color code to match (e.g. "#FFD700", "FFD700", "00FFFF")'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .optional()
        .describe("Number of closest matches to return (default 5, max 20)"),
      palette: z
        .string()
        .optional()
        .describe(
          'Filter to a specific palette (e.g. "Classic", "Smoke", "Twilight")'
        ),
    },
    async (args) => {
      try {
        // Normalize hex input
        let hex = args.hex_color.trim().replace(/^#/, "");

        // Handle 3-char shorthand (e.g. "F00" → "FF0000")
        if (/^[0-9a-fA-F]{3}$/.test(hex)) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid hex color: "${args.hex_color}". Expected format: #FFD700, FFD700, or F00`,
              },
            ],
            isError: true,
          };
        }

        hex = hex.toLowerCase();
        const limit = args.limit ?? 5;
        const rgb = hexToRgb(hex);
        const colorName = describeColor(rgb);

        const matches = findClosestColors(hex, limit, args.palette);

        const lines: string[] = [];
        lines.push(`## Color Palette Finder`);
        lines.push(
          `**Input:** #${hex.toUpperCase()} (${colorName}) — RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`
        );

        if (args.palette) {
          lines.push(`**Filtering to palette:** ${args.palette}`);
        }

        lines.push(
          `\n**${COLOR_PALETTES.size} palettes searched** (${COLOR_PALETTES.size * 90} colors total)\n`
        );

        if (matches.length === 0) {
          lines.push("No matches found.");
          if (args.palette) {
            lines.push(
              `Palette "${args.palette}" not found. Available palettes: ${[...COLOR_PALETTES.values()].map((p) => p.displayName).join(", ")}`
            );
          }
        } else {
          lines.push(`| Rank | Palette | Position | Hex | ΔE (distance) | Match |`);
          lines.push(`|------|---------|----------|-----|---------------|-------|`);

          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const pos = `Row ${m.row + 1}, Col ${m.col + 1}`;
            const de = m.distance.toFixed(1);
            let matchQuality: string;
            if (m.exact) matchQuality = "EXACT";
            else if (m.distance < 3) matchQuality = "Excellent";
            else if (m.distance < 6) matchQuality = "Very Good";
            else if (m.distance < 12) matchQuality = "Good";
            else if (m.distance < 25) matchQuality = "Fair";
            else matchQuality = "Approximate";

            lines.push(
              `| ${i + 1} | ${m.palette} | ${pos} | #${m.hex.toUpperCase()} | ${de} | ${matchQuality} |`
            );
          }

          // Best match summary
          const best = matches[0];
          lines.push(`\n### Best Match`);
          if (best.exact) {
            lines.push(
              `**Exact match!** Found #${hex.toUpperCase()} in the **${best.palette}** palette at **Row ${best.row + 1}, Column ${best.col + 1}**.`
            );
          } else {
            lines.push(
              `The closest color is **#${best.hex.toUpperCase()}** in the **${best.palette}** palette at **Row ${best.row + 1}, Column ${best.col + 1}** (ΔE = ${best.distance.toFixed(1)}).`
            );
          }

          // ΔE interpretation
          lines.push(`\n> **ΔE Guide:** <1 = imperceptible, 1-3 = barely noticeable, 3-6 = noticeable at a glance, 6-12 = clearly different, >12 = very different`);

          // Note about palette acquisition
          lines.push(
            `\n> Most color palettes are available from the in-game Market for platinum, or as seasonal/event rewards. The **Smoke** palette is popular for free-to-play players as it includes pure black and white.`
          );
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error in color_palette_finder: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
