// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://smarthomeguides.org",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr"],
    routing: "manual",
  },

  integrations: [mdx()],

  vite: {
    plugins: [tailwindcss()],
  },
});
