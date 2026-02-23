/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://www.buttergolf.com",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: ["/api/*", "/sign-in", "/sign-in/*", "/sign-up", "/sign-up/*", "/404", "/500"],
  changefreq: "weekly",
  priority: 0.7,
  transform: async (config, path) => {
    // Customize priority per section
    let priority = 0.7;
    if (path === "/") {
      priority = 1.0;
    } else if (path.startsWith("/products/")) {
      priority = 0.8;
    } else if (path === "/sell") {
      priority = 0.9;
    } else if (path === "/rounds") {
      priority = 0.6;
    }

    return {
      loc: path,
      changefreq: config.changefreq,
      priority,
      lastmod: new Date().toISOString(),
      alternateRefs: config.alternateRefs ?? [],
    };
  },
  robotsTxtOptions: {
    additionalSitemaps: [
      // Server-generated sitemap for dynamic content (products)
      `${process.env.SITE_URL || "https://www.buttergolf.com"}/server-sitemap.xml`,
    ],
    policies: [
      {
        userAgent: "*",
        allow: "/",
        // Disallow specific paths
        disallow: ["/api/", "/sign-in", "/sign-up"],
      },
    ],
  },
};
