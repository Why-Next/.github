#!/usr/bin/env node
// blog.whynext.app RSS 최신 글을 profile/README.md 마커 사이에 채워 넣습니다.
// 의존성 없음 - Node 20+ 내장 fetch 사용.
import { readFile, writeFile } from "node:fs/promises";

const FEED_URL = "https://blog.whynext.app/rss.xml";
const README = new URL("../../profile/README.md", import.meta.url);
const MAX_POSTS = 5;
const START = "<!-- BLOG-POST-LIST:START -->";
const END = "<!-- BLOG-POST-LIST:END -->";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" };
const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
   .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m)
   .trim();

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
};

const fmtDate = (raw) => {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const res = await fetch(FEED_URL, { headers: { "user-agent": "why-next-readme-bot" } });
if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
const xml = await res.text();

const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)]
  .slice(0, MAX_POSTS)
  .map((m) => {
    const b = m[0];
    const title = pick(b, "title");
    const link = pick(b, "link");
    const date = fmtDate(pick(b, "pubDate"));
    return title && link ? `- [${title}](${link})${date ? ` <sub>${date}</sub>` : ""}` : null;
  })
  .filter(Boolean);

if (items.length === 0) throw new Error("No items parsed from feed");

const readme = await readFile(README, "utf8");
const s = readme.indexOf(START);
const e = readme.indexOf(END);
if (s === -1 || e === -1) throw new Error("Markers not found in README");

const next =
  readme.slice(0, s + START.length) + "\n" + items.join("\n") + "\n" + readme.slice(e);

if (next === readme) {
  console.log("No change.");
} else {
  await writeFile(README, next);
  console.log(`Updated with ${items.length} posts.`);
}
