// Build step of studiolee.nl (vercel.json buildCommand): the search index of the Kennisbank, made from the articles.
//   node tools/blog-search-index.mjs [site-root]   writes blog/search-index.json
// Every card on blog.html is one article; its page blog/<slug>/index.html gives the title (H1), the excerpt (meta
// description) and the headings of the article body. The card's badge is its tag. No service, no dependency.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || ".";
const decode = (s) => s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, " ").trim();

const listing = readFileSync(join(root, "blog.html"), "utf8");
const cards = [...listing.matchAll(/<div class="[^"]*blog-card-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
const seen = new Set();
const entries = [];
for (const [, card] of cards) {
    const slug = (/href="\/blog\/([^"/?#]+)"/.exec(card) || [])[1];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const badge = decode((/class="blog-card-badge"[^>]*>([\s\S]*?)<\/span>/.exec(card) || [, ""])[1]);
    const cardTitle = decode((/class="blog-card-title"[^>]*>([\s\S]*?)<\/h3>/.exec(card) || [, ""])[1]);
    const page = join(root, "blog", slug, "index.html");
    const html = existsSync(page) ? readFileSync(page, "utf8") : "";
    const title = decode((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [, cardTitle])[1]) || cardTitle;
    const excerpt = decode((/<meta name="description" content="([^"]*)"/.exec(html) || [, ""])[1]);
    const date = (/"datePublished"\s*:\s*"([^"]+)"/.exec(html) || [, ""])[1];
    const body = (/<section class="blog-detail[\s\S]*?<\/section>/.exec(html) || [""])[0];
    const headings = [];
    for (const [, attrs, text] of body.matchAll(/<h[23]([^>]*)>([\s\S]*?)<\/h[23]>/g)) {
        const t = decode(text);
        if (t && !/text-white/.test(attrs) && !headings.includes(t)) headings.push(t);
    }
    entries.push({ slug, title, excerpt, tags: badge ? [badge] : [], headings, date });
}
if (!entries.length) {
    console.error("refused: no article cards found in blog.html");
    process.exit(1);
}
writeFileSync(join(root, "blog", "search-index.json"), JSON.stringify(entries));
console.log(`blog/search-index.json: ${entries.length} articles`);
