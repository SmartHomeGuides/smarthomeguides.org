// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import rehypeGlossary from "./src/plugins/rehype-glossary.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://smarthomeguides.org",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr"],
    routing: "manual",
  },

  markdown: {
    rehypePlugins: [rehypeGlossary],
  },

  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});
