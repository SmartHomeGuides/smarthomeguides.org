import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    category: z
      .enum(["fundamentals", "intermediate", "advanced", "glossary"])
      .optional(),
    readingTime: z.number().optional(),
    draft: z.boolean().default(false),
    order: z.number().optional(),
  }),
});

export const collections = { docs };
