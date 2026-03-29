import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import sharp from "sharp";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const CONTENT_DIR = join(ROOT, "src/content/docs");
const OUTPUT_DIR = join(ROOT, "public/og");
const ASSETS_DIR = join(ROOT, "scripts/assets");

// Import site name parts from shared consts
import { SITE_NAME_MAIN, SITE_NAME_BADGE } from "../src/lib/consts.js";

const WIDTH = 1200;
const HEIGHT = 630;

const interBold = readFileSync(join(ASSETS_DIR, "Inter-Bold.ttf"));
const interRegular = readFileSync(join(ASSETS_DIR, "Inter-Regular.ttf"));

const houseIconSvg = readFileSync(
  join(ASSETS_DIR, "emoji_u1f3e0.svg"),
  "utf-8",
);
const houseIconDataUri = `data:image/svg+xml,${encodeURIComponent(houseIconSvg)}`;

const satoriOptions = {
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    {
      name: "Inter",
      data: interRegular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: interBold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ],
};

interface GuideMeta {
  title: Record<string, string>;
  description?: Record<string, string>;
  category?: string;
  difficulty?: string;
  tags?: Record<string, string[]>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Read locales from astro.config.mjs i18n config
import astroConfig from "../astro.config.mjs";
const LOCALES: string[] = (astroConfig.i18n?.locales as string[]) ?? ["en"];

// Load translations from existing i18n JSON files
interface I18nData {
  categories?: Record<string, { title?: string }>;
  guide?: { difficulty?: Record<string, string> };
}

function loadI18n(locale: string): I18nData {
  const filePath = join(ROOT, "src/i18n", `${locale}.json`);
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

const i18nByLocale: Record<string, I18nData> = {};
for (const locale of LOCALES) {
  i18nByLocale[locale] = loadI18n(locale);
}

function getCategoryLabel(locale: string, category: string): string {
  return (
    i18nByLocale[locale]?.categories?.[category]?.title ?? capitalize(category)
  );
}

function getDifficultyLabel(locale: string, difficulty: string): string {
  return (
    i18nByLocale[locale]?.guide?.difficulty?.[difficulty] ??
    capitalize(difficulty)
  );
}

function guideTemplate(
  meta: GuideMeta,
  locale: string,
): ReturnType<typeof html> {
  const title =
    meta.title[locale] ??
    meta.title.en ??
    Object.values(meta.title)[0] ??
    "Untitled";
  const description = meta.description?.[locale] ?? meta.description?.en ?? "";
  const category = meta.category ? getCategoryLabel(locale, meta.category) : "";
  const difficulty = meta.difficulty
    ? getDifficultyLabel(locale, meta.difficulty)
    : "";
  const tags = meta.tags?.[locale] ?? meta.tags?.en ?? [];
  const fontSize = title.length > 40 ? 48 : 56;

  const categoryBadge = category
    ? `<span style="background: rgba(255,255,255,0.2); color: white; font-size: 20px; font-weight: 700; padding: 6px 16px; border-radius: 8px;">${category}</span>`
    : "";
  const difficultyBadge = difficulty
    ? `<span style="background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); font-size: 20px; font-weight: 400; padding: 6px 16px; border-radius: 8px;">${difficulty}</span>`
    : "";
  const tagsPills = tags
    .map(
      (tag) =>
        `<span style="background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 14px; padding: 4px 10px; border-radius: 6px;">${tag}</span>`,
    )
    .join("");

  return html(
    `<div style="display: flex; flex-direction: column; justify-content: space-between; width: 100%; height: 100%; background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%); padding: 60px;">
      <div style="display: flex; gap: 12px;">
        ${categoryBadge}
        ${difficultyBadge}
      </div>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <h1 style="color: white; font-size: ${fontSize}px; font-weight: 700; line-height: 1.2; margin: 0; max-width: 900px;">
          ${title}
        </h1>
        ${description ? `<p style="color: rgba(255,255,255,0.7); font-size: 20px; font-weight: 400; line-height: 1.5; margin: 0; max-width: 900px;">${description}</p>` : ""}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; background: rgba(255,255,255,0.2); border-radius: 14px;"><img src="${houseIconDataUri}" style="width: 32px; height: 32px;" /></div>
          <span style="color: rgba(255,255,255,0.9); font-size: 32px; font-weight: 700;">${SITE_NAME_MAIN}</span>
          <span style="background: rgba(255,255,255,0.9); color: #4f46e5; font-size: 16px; font-weight: 700; padding: 4px 12px; border-radius: 6px;">${SITE_NAME_BADGE}</span>
        </div>
        ${tagsPills ? `<div style="display: flex; gap: 8px;">${tagsPills}</div>` : ""}
      </div>
    </div>`,
  );
}

function defaultTemplate(): ReturnType<typeof html> {
  return html`
    <div
      style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%); padding: 60px; gap: 24px;"
    >
      <div
        style="display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 40px; color: white;"
      >
        <img src="${houseIconDataUri}" style="width: 44px; height: 44px;" />
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <h1 style="color: white; font-size: 64px; font-weight: 700; margin: 0;">
          ${SITE_NAME_MAIN}
        </h1>
        <span
          style="background: rgba(255,255,255,0.8); color: #4f46e5; font-size: 28px; font-weight: 700; padding: 6px 20px; border-radius: 10px;"
        >
          ${SITE_NAME_BADGE}
        </span>
      </div>
      <p
        style="color: rgba(255,255,255,0.8); font-size: 28px; font-weight: 400; margin: 0; text-align: center;"
      >
        ${SITE_NAME_MAIN} ${SITE_NAME_BADGE} for everyone
      </p>
    </div>
  `;
}

async function renderToFile(
  markup: ReturnType<typeof html>,
  outputPath: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(markup as any, satoriOptions);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outputPath, png);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Find all _meta.json files recursively
  const metaFiles: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === "_meta.json") {
        metaFiles.push(full);
      }
    }
  }
  walk(CONTENT_DIR);

  let generated = 0;
  let skipped = 0;

  // Generate per-guide images for each locale
  for (const metaPath of metaFiles) {
    const meta: GuideMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
    const guideSlug = basename(dirname(metaPath));
    const category = meta.category ?? "uncategorized";

    for (const locale of LOCALES) {
      const localeDir = join(OUTPUT_DIR, locale);
      mkdirSync(localeDir, { recursive: true });
      const filename = `${category}-${guideSlug}.png`;
      const outputPath = join(localeDir, filename);
      const displayPath = `${locale}/${filename}`;

      if (existsSync(outputPath)) {
        console.log(`  skip: ${displayPath} (already exists)`);
        skipped++;
        continue;
      }

      console.log(`  generate: ${displayPath}`);
      await renderToFile(guideTemplate(meta, locale), outputPath);
      generated++;
    }
  }

  // Generate default OG image
  const defaultPath = join(OUTPUT_DIR, "og-default.png");
  if (existsSync(defaultPath)) {
    console.log(`  skip: og-default.png (already exists)`);
    skipped++;
  } else {
    console.log(`  generate: og-default.png`);
    await renderToFile(defaultTemplate(), defaultPath);
    generated++;
  }

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Error generating OG images:", err);
  process.exit(1);
});
