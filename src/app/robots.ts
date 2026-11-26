import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/email";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/staff", "/portal", "/billing", "/account", "/api", "/apply", "/login", "/register"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
