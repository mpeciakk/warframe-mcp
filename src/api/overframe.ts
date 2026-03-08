import { TTLCache, TTL } from "../utils/cache.js";
import type {
  OverframeBuildSummary,
  OverframeBuildPageProps,
} from "../types/index.js";

const BASE_URL = "https://overframe.gg";
const cache = new TTLCache<unknown>();

// Cache build pages for 6 hours (builds rarely change)
const TTL_BUILDS = 6 * 60 * 60_000;

/** Categories supported by Overframe build lists */
export type OverframeCategory =
  | "warframes"
  | "primary-weapons"
  | "secondary-weapons"
  | "melee-weapons"
  | "archwing"
  | "sentinels";

/**
 * Fetch raw HTML from Overframe with a timeout.
 * Overframe public pages are allowed by robots.txt (only /api/ is disallowed).
 */
async function fetchHTML(path: string, timeout = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "WarframeMCP/1.0 (build-lookup)",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract __NEXT_DATA__ JSON from an Overframe HTML page.
 */
function extractNextData(html: string): Record<string, unknown> | null {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end === -1) return null;
  try {
    return JSON.parse(html.substring(jsonStart, end));
  } catch {
    return null;
  }
}

/**
 * Parse build summaries from an Overframe build list HTML page.
 * Extracts data from BuildSummaryFull links.
 */
function parseBuildListHTML(html: string): OverframeBuildSummary[] {
  const builds: OverframeBuildSummary[] = [];
  // Match build summary links: /build/{id}/{item-slug}/{title-slug}/
  const linkRegex =
    /href="\/build\/(\d+)\/([^/]+)\/([^/]+)\/"[^>]*class="BuildSummaryFull_build[^"]*"/g;
  const seen = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const id = parseInt(match[1], 10);
    if (seen.has(id)) continue;
    seen.add(id);

    // Extract title from the h3 after this link
    const afterLink = html.substring(match.index, match.index + 2000);

    const titleMatch = afterLink.match(
      /BuildSummaryFull_title[^"]*"[^>]*>([^<]+)</
    );
    const authorMatch = afterLink.match(
      /BuildSummaryFull_blue[^"]*"[^>]*>[^<]+<\/span>[^]*?BuildSummaryFull_blue[^"]*"[^>]*>([^<]+)</
    );
    const votesMatch = afterLink.match(
      /BuildSummaryFull_buildVotes[^]*?<dd>(\d+)<\/dd>/
    );
    const formaMatch = afterLink.match(/(\d+)<!-- --> Forma/);
    const itemNameMatch = afterLink.match(
      /BuildSummaryFull_blue[^"]*"[^>]*>([^<]+)<\/span>[^]*?guide by/
    );

    builds.push({
      id,
      created: "",
      updated: "",
      score: votesMatch ? parseInt(votesMatch[1], 10) : 0,
      url: `/build/${id}/${match[2]}/${match[3]}/`,
      author: {
        id: 0,
        username: authorMatch ? authorMatch[1] : "unknown",
        url: "",
        is_staff: false,
      },
      formas: formaMatch ? parseInt(formaMatch[1], 10) : 0,
      item_data: {
        id: 0,
        locTag: "",
        texture_new: "",
      },
      title: titleMatch ? titleMatch[1] : match[3].replace(/-/g, " "),
    });
  }

  return builds;
}

/**
 * Get the item slug from a build URL.
 * E.g. /build/374539/revenant-prime/some-title/ -> "revenant-prime"
 */
function getItemSlugFromUrl(url: string): string {
  const parts = url.split("/").filter(Boolean);
  // Format: build / {id} / {item-slug} / {title-slug}
  return parts.length >= 3 ? parts[2] : "";
}

/**
 * Normalize a search query to a slug-like format for matching.
 * "Saryn Prime" -> "saryn-prime"
 */
function normalizeToSlug(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch top builds for a category, optionally filtered by item name.
 * Returns build summaries sorted by votes (highest first).
 */
export async function getTopBuilds(
  category: OverframeCategory,
  itemName?: string,
  limit = 5
): Promise<OverframeBuildSummary[]> {
  const cacheKey = `overframe:list:${category}`;
  let builds = cache.get(cacheKey) as OverframeBuildSummary[] | undefined;

  if (!builds) {
    const html = await fetchHTML(`/builds/${category}/`);
    builds = parseBuildListHTML(html);
    // Sort by votes descending
    builds.sort((a, b) => b.score - a.score);
    cache.set(cacheKey, builds, TTL_BUILDS);
  }

  if (itemName) {
    const slug = normalizeToSlug(itemName);
    builds = builds.filter((b) => {
      const itemSlug = getItemSlugFromUrl(b.url);
      return itemSlug.includes(slug) || slug.includes(itemSlug);
    });
  }

  return builds.slice(0, limit);
}

/**
 * Fetch full build details from a specific build page.
 * Returns the parsed __NEXT_DATA__ pageProps.
 */
export async function getBuildDetail(
  buildId: number
): Promise<OverframeBuildPageProps | null> {
  const cacheKey = `overframe:build:${buildId}`;
  const cached = cache.get(cacheKey) as OverframeBuildPageProps | undefined;
  if (cached) return cached;

  const html = await fetchHTML(`/build/${buildId}/`);
  const nextData = extractNextData(html);
  if (!nextData) return null;

  const props = nextData as {
    props?: { pageProps?: OverframeBuildPageProps };
  };
  const pageProps = props?.props?.pageProps;
  if (!pageProps?.data) return null;

  cache.set(cacheKey, pageProps, TTL_BUILDS);
  return pageProps;
}

/**
 * Determine the best Overframe category for a given item type.
 */
export function inferCategory(
  itemType: string
): OverframeCategory | null {
  const t = itemType.toLowerCase();
  if (
    t.includes("warframe") ||
    t.includes("frame") ||
    t === "suit" ||
    t === "suits"
  )
    return "warframes";
  if (t.includes("primary")) return "primary-weapons";
  if (t.includes("secondary") || t.includes("pistol")) return "secondary-weapons";
  if (t.includes("melee") || t.includes("sword") || t.includes("dagger"))
    return "melee-weapons";
  if (t.includes("archwing") || t.includes("archgun") || t.includes("archmelee"))
    return "archwing";
  if (t.includes("sentinel") || t.includes("companion"))
    return "sentinels";
  return null;
}
