import { getCollection, type CollectionEntry } from "astro:content";
import { languages } from "@i18n/index";
import type { Locale } from "@i18n/index";
import fs from "node:fs";
import path from "node:path";

export type Category =
  | "fundamentals"
  | "intermediate"
  | "advanced"
  | "glossary";

export const categories: Category[] = [
  "fundamentals",
  "intermediate",
  "advanced",
  "glossary",
];

const localeKeys = Object.keys(languages);

// ---------------------------------------------------------------------------
// Entry ID parsing
// ---------------------------------------------------------------------------

interface ParsedEntryId {
  category: Category;
  guideSlug: string;
  chapterSlug: string | null;
  locale: Locale;
}

/**
 * Strip the locale suffix from the last segment of an entry ID.
 * e.g. `what-is-home-automationen` → `what-is-home-automation`
 */
function stripLocaleSuffix(segment: string): { name: string; locale: Locale } {
  const suffix = segment.slice(-2);
  if (localeKeys.includes(suffix)) {
    return { name: segment.slice(0, -2), locale: suffix as Locale };
  }
  return { name: segment, locale: "en" };
}

/**
 * Parse a content collection entry ID into its components.
 *
 * Single-page:  `fundamentals/what-is-home-automationen`
 *   → { category: "fundamentals", guideSlug: "what-is-home-automation", chapterSlug: null, locale: "en" }
 *
 * Multi-page:   `fundamentals/what-is-home-automation/01-introductionen`
 *   → { category: "fundamentals", guideSlug: "what-is-home-automation", chapterSlug: "01-introduction", locale: "en" }
 */
export function parseEntryId(entryId: string): ParsedEntryId {
  const parts = entryId.split("/");

  if (parts.length >= 3) {
    // Multi-page: category / guideSlug / chapterWithLocale
    const category = parts[0] as Category;
    const guideSlug = parts[1];
    const { name: chapterSlug, locale } = stripLocaleSuffix(parts[2]);
    return { category, guideSlug, chapterSlug, locale };
  }

  // Single-page: category / slugWithLocale
  const category = parts[0] as Category;
  const { name: guideSlug, locale } = stripLocaleSuffix(parts[1] ?? "");
  return { category, guideSlug, chapterSlug: null, locale };
}

// ---------------------------------------------------------------------------
// Basic accessors (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function getGuideLocale(entryId: string): Locale {
  return parseEntryId(entryId).locale;
}

export function getGuideCategory(entryId: string): Category {
  return parseEntryId(entryId).category;
}

/**
 * Returns the full URL slug for an entry.
 * Single-page:       `what-is-home-automation`
 * Multi-page chapter: `what-is-home-automation/introduction`
 * Guide index:        `what-is-home-automation` (index page maps to guide root)
 */
export function getGuideSlug(entryId: string): string {
  const { guideSlug, chapterSlug } = parseEntryId(entryId);
  if (!chapterSlug || chapterSlug === "index") return guideSlug;
  return `${guideSlug}/${chapterSlug}`;
}

/**
 * Returns just the guide folder name (ignoring chapter).
 * Always returns `what-is-home-automation` regardless of whether it's a chapter or single-page.
 */
export function getGuideParentSlug(entryId: string): string {
  return parseEntryId(entryId).guideSlug;
}

/**
 * Returns true if the entry represents a category-level index file
 * (e.g. `fundamentals/indexen`).
 */
export function isCategoryIndexEntry(entryId: string): boolean {
  const { guideSlug, chapterSlug } = parseEntryId(entryId);
  return chapterSlug === null && guideSlug === "index";
}

/**
 * Returns true if the entry represents a guide-level index file
 * (e.g. `fundamentals/what-is-home-automation/indexen`).
 * These render at the guide root URL but are not listed as chapters.
 */
export function isGuideIndexEntry(entryId: string): boolean {
  return parseEntryId(entryId).chapterSlug === "index";
}

/**
 * Returns true if the entry is any kind of index file (category or guide level).
 */
export function isIndexEntry(entryId: string): boolean {
  return isCategoryIndexEntry(entryId) || isGuideIndexEntry(entryId);
}

// ---------------------------------------------------------------------------
// Multi-page guide grouping
// ---------------------------------------------------------------------------

export interface GuideGroup {
  guideSlug: string;
  guideTitle: string;
  guideDescription?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  icon?: string;
  tags?: string[];
  order?: number;
  isMultiPage: boolean;
  entries: CollectionEntry<"docs">[]; // sorted chapters, or single entry
}

const CONTENT_DIR = path.resolve("src/content/docs");

interface GuideMeta {
  title: Record<string, string>;
  description?: Record<string, string>;
  category?: Category;
  difficulty?: "beginner" | "intermediate" | "advanced";
  order?: number;
  icon?: string;
  tags?: Record<string, string[]>;
}

/**
 * Load `_meta.json` from a guide folder.
 */
function loadGuideMeta(
  category: Category,
  guideSlug: string,
): GuideMeta | undefined {
  const metaPath = path.join(CONTENT_DIR, category, guideSlug, "_meta.json");
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as GuideMeta;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a localized string from a `Record<string, string>`, falling back to English.
 */
function resolveLocalized(
  field: Record<string, string> | undefined,
  locale: Locale,
): string | undefined {
  if (!field) return undefined;
  return field[locale] ?? field.en;
}

function resolveLocalizedArray(
  field: Record<string, string[]> | undefined,
  locale: Locale,
): string[] | undefined {
  if (!field) return undefined;
  return field[locale] ?? field.en;
}

/**
 * Group entries for a category/locale into GuideGroups.
 * Multi-page guides have their chapters sorted by the frontmatter `order` field.
 */
export async function getGroupedGuides(
  locale: Locale,
  category: Category,
): Promise<GuideGroup[]> {
  const entries = await getGuidesByCategory(locale, category);
  const groupMap = new Map<string, CollectionEntry<"docs">[]>();

  for (const entry of entries) {
    const parentSlug = getGuideParentSlug(entry.id);
    const group = groupMap.get(parentSlug);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(parentSlug, [entry]);
    }
  }

  const groups: GuideGroup[] = [];
  for (const [guideSlug, groupEntries] of groupMap) {
    // Filter out guide-level index entries - they're landing pages, not chapters
    const chapters = groupEntries.filter((e) => !isGuideIndexEntry(e.id));
    const isMultiPage =
      chapters.length > 0 &&
      chapters.some((e) => parseEntryId(e.id).chapterSlug !== null);

    // Sort chapters by frontmatter order field
    if (isMultiPage) {
      chapters.sort(
        (a, b) => (a.data.order ?? Infinity) - (b.data.order ?? Infinity),
      );
    }

    const firstEntry = chapters[0] ?? groupEntries[0];

    if (isMultiPage) {
      const meta = loadGuideMeta(category, guideSlug);
      groups.push({
        guideSlug,
        guideTitle:
          resolveLocalized(meta?.title, locale) ?? firstEntry.data.title,
        guideDescription:
          resolveLocalized(meta?.description, locale) ??
          firstEntry.data.description,
        difficulty: meta?.difficulty ?? firstEntry.data.difficulty,
        icon: meta?.icon,
        tags: resolveLocalizedArray(meta?.tags, locale),
        order: meta?.order,
        isMultiPage,
        entries: chapters,
      });
    } else {
      groups.push({
        guideSlug,
        guideTitle: firstEntry.data.title,
        guideDescription: firstEntry.data.description,
        difficulty: firstEntry.data.difficulty,
        order: firstEntry.data.order,
        isMultiPage,
        entries: chapters,
      });
    }
  }

  // Sort groups by order
  groups.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  return groups;
}

/**
 * Flatten guide groups into a single ordered list for prev/next navigation.
 */
export function buildLinearOrder(
  groups: GuideGroup[],
): CollectionEntry<"docs">[] {
  return groups.flatMap((g) => g.entries);
}

/**
 * Map a difficulty level to its DaisyUI badge class.
 */
export function getDifficultyBadgeClass(difficulty?: string): string {
  switch (difficulty) {
    case "beginner":
      return "badge-success";
    case "intermediate":
      return "badge-warning";
    case "advanced":
      return "badge-error";
    default:
      return "";
  }
}

/**
 * Build the URL for any guide entry.
 */
export function getGuideEntryUrl(
  base: string,
  locale: Locale,
  category: Category,
  entry: CollectionEntry<"docs">,
): string {
  return `${base}${locale}/guides/${category}/${getGuideSlug(entry.id)}`;
}

// ---------------------------------------------------------------------------
// Collection queries
// ---------------------------------------------------------------------------

export async function getIndexEntry(locale: Locale, category: Category) {
  const all = await getCollection("docs", (entry) => {
    return (
      !entry.data.draft &&
      getGuideLocale(entry.id) === locale &&
      getGuideCategory(entry.id) === category &&
      isCategoryIndexEntry(entry.id)
    );
  });
  return all[0];
}

export async function getGuidesByCategory(locale: Locale, category: Category) {
  return getCollection("docs", (entry) => {
    return (
      !entry.data.draft &&
      getGuideLocale(entry.id) === locale &&
      getGuideCategory(entry.id) === category &&
      !isIndexEntry(entry.id)
    );
  });
}

export async function getAllGuidesForLocale(locale: Locale) {
  return getCollection("docs", (entry) => {
    return !entry.data.draft && getGuideLocale(entry.id) === locale;
  });
}

/**
 * Returns BASE_URL with a guaranteed trailing slash.
 */
export function getBase(): string {
  const raw = import.meta.env.BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}
