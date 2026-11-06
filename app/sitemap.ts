import type { MetadataRoute } from "next";

const BASE = "https://curriculum.yongjin.info";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/help", "/privacy", "/terms"].map((p) => ({ url: BASE + p, changeFrequency: "monthly", priority: p ? 0.5 : 1 }));
}
