/**
 * Rehype plugin that automatically highlights glossary terms in guide content.
 *
 * For each MDX page (excluding glossary pages themselves), it finds the first
 * occurrence of every glossary term and wraps it in a <span class="glossary-hint">
 * with a data-glossary-description attribute for CSS tooltips.
 */
import fs from "node:fs";
import path from "node:path";

// ── HAST types (inline to avoid external dependency) ────────────────────────

interface HastText {
  type: "text";
  value: string;
}

interface HastElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: HastNode[];
}

type HastNode =
  | HastText
  | HastElement
  | { type: string; children?: HastNode[] };

// ── Glossary data ───────────────────────────────────────────────────────────

interface GlossaryTerm {
  title: string;
  description: string;
  slug: string;
}

const SKIP_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "code",
  "pre",
  "a",
  "script",
  "style",
]);

const termsCache = new Map<string, GlossaryTerm[]>();

function loadTerms(locale: string): GlossaryTerm[] {
  const cached = termsCache.get(locale);
  if (cached) return cached;

  const dir = path.resolve("src/content/docs/glossary");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(`.${locale}.mdx`));
  } catch {
    termsCache.set(locale, []);
    return [];
  }

  const terms: GlossaryTerm[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const title = fm.match(/^title:\s*"(.+)"/m)?.[1];
    const desc = fm.match(/^description:\s*"(.+)"/m)?.[1];
    if (!title || !desc) continue;

    terms.push({
      title,
      description: desc,
      slug: file.replace(`.${locale}.mdx`, ""),
    });
  }

  // Sort longest title first so multi-word terms match before single words
  terms.sort((a, b) => b.title.length - a.title.length);
  termsCache.set(locale, terms);
  return terms;
}

function getLocaleFromPath(filePath: string): string {
  const match = filePath.match(/\.([a-z]{2})\.mdx$/);
  return match?.[1] ?? "en";
}

function isGlossaryFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/glossary/");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Text processing ─────────────────────────────────────────────────────────

function processText(
  text: string,
  terms: GlossaryTerm[],
  matched: Set<string>,
  locale: string,
): HastNode[] | null {
  // Try each term (longest first) against this text
  for (const term of terms) {
    const key = term.title.toLowerCase();
    if (matched.has(key)) continue;

    const regex = new RegExp(`\\b(${escapeRegExp(term.title)})\\b`, "i");
    const m = text.match(regex);
    if (!m || m.index === undefined) continue;

    matched.add(key);

    const idx = m.index;
    const before = text.slice(0, idx);
    const after = text.slice(idx + m[1].length);

    const nodes: HastNode[] = [];
    if (before) {
      const beforeNodes = processText(before, terms, matched, locale);
      if (beforeNodes) {
        nodes.push(...beforeNodes);
      } else {
        nodes.push({ type: "text", value: before } as HastText);
      }
    }

    nodes.push({
      type: "element",
      tagName: "span",
      properties: {
        className: ["glossary-hint"],
        "data-glossary-description": term.description,
        "data-glossary-href": `/${locale}/guides/glossary/${term.slug}`,
      },
      children: [{ type: "text", value: m[1] } as HastText],
    } as HastElement);

    if (after) {
      // Recursively process remaining text for other terms
      const rest = processText(after, terms, matched, locale);
      if (rest) {
        nodes.push(...rest);
      } else {
        nodes.push({ type: "text", value: after } as HastText);
      }
    }

    return nodes;
  }

  return null;
}

// ── Tree walker ─────────────────────────────────────────────────────────────

function walk(
  node: HastNode,
  terms: GlossaryTerm[],
  matched: Set<string>,
  locale: string,
): void {
  if (!("children" in node) || !Array.isArray(node.children)) return;

  const el = node as HastElement;
  if (el.type === "element" && SKIP_TAGS.has(el.tagName)) return;

  let i = 0;
  while (i < el.children.length) {
    const child = el.children[i];

    if (child.type === "text") {
      const result = processText(
        (child as HastText).value,
        terms,
        matched,
        locale,
      );
      if (result) {
        el.children.splice(i, 1, ...result);
        i += result.length;
        continue;
      }
    } else {
      walk(child, terms, matched, locale);
    }

    i++;
  }
}

// ── Plugin export ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function rehypeGlossary(): (tree: any, vfile: any) => void {
  return (tree, vfile) => {
    const filePath: string = vfile.path ?? vfile.history?.[0] ?? "";
    if (!filePath || isGlossaryFile(filePath)) return;

    const locale = getLocaleFromPath(filePath);
    const terms = loadTerms(locale);
    if (terms.length === 0) return;

    const matched = new Set<string>();
    walk(tree, terms, matched, locale);
  };
}
