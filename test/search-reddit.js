/**
 * Reddit comment harvester (Brazil/PT-BR focus) → resultados.txt
 * Single-file Node.js (Node 18+). No external deps.
 *
 * Auth:
 *  - Tries OAuth2 client_credentials first (app-only read).
 *  - If unauthorized, falls back to password grant (needs REDDIT_USERNAME/PASSWORD).
 *
 * What it does:
 *  - Searches posts for each domain-specific query (last 90 days).
 *  - Fetches top comments for each post.
 *  - Filters comments: Portuguese heuristic + engagement + length.
 *  - Deduplicates and saves to resultados.txt (UTF-8).
 *
 * Env vars:
 *  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
 *  (optional) REDDIT_USERNAME, REDDIT_PASSWORD
 *
 * Run:
 *  REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=yyy REDDIT_USER_AGENT="myapp/1.0 by u_me"
 *  node coletar_reddit.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { QUERIES } from "./queries.js"; // ensure module is loaded

// -------------------- CONFIG --------------------
const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const USER_AGENT =
  process.env.REDDIT_USER_AGENT || "reddit-harvester/1.0 (by unknown)";
const USERNAME = process.env.REDDIT_USERNAME; // optional
const PASSWORD = process.env.REDDIT_PASSWORD; // optional

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET.");
  process.exit(1);
}

const OUTPUT_FILE = "resultados.txt";

// Window: last 90 days (filter client-side on post.created_utc)
const NOW = Date.now();
const DAYS = 90;
const WINDOW_START_UTC = Math.floor((NOW - DAYS * 24 * 60 * 60 * 1000) / 1000);

// Engagement thresholds for comments
const MIN_SCORE = 2; // upvotes score
const MIN_LENGTH = 80; // characters
const MAX_COMMENTS_TOTAL = 1200; // safety cap
const MAX_POSTS_PER_QUERY = 120; // limit posts scanned per query
const COMMENTS_PER_POST = 100; // fetch up to 100 (top) per post

// Heuristic: Brazilian Portuguese (language + geo-ish keywords)
const PT_COMMON = [
  " de ",
  " que ",
  " não ",
  " nao ",
  " para ",
  " você ",
  " voce ",
  " com ",
  " está ",
  " esta ",
  " sobre ",
  " pelo ",
  " pela ",
  " entre ",
  " então ",
  " entao ",
  " pois ",
  " pra ",
  " gente ",
];
const PT_ACCENTS = /[áàâãéêíóôõúç]/i;

const BRAZIL_HINTS = [
  "brasil",
  "brazil",
  "curitiba",
  "são paulo",
  "sao paulo",
  "rio de janeiro",
  "porto alegre",
  "minas",
  "bahia",
  "recife",
  "fortaleza",
  "manaus",
  "brasileiro",
  "brasileira",
  "paraná",
  "parana",
];

// Preferred subreddits (optional; still searches globally)
const SUBREDDITS_HINT = [
  "brasil",
  "programacao",
  "brdev",
  "empreendedor",
  "empreendedorismo",
  "startups",
  "saas",
  "fintech",
  "desenvolvimentoweb",
];

// -------------------- OAUTH --------------------
async function getAccessToken() {
  // Try client_credentials (app-only)
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  let res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      duration: "temporary",
    }),
  });

  if (res.ok) {
    const j = await res.json();
    return j.access_token;
  }

  // Fallback: password grant (requires bot account)
  if (USERNAME && PASSWORD) {
    res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: USERNAME,
        password: PASSWORD,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OAuth failed (password grant). ${res.status} ${t}`);
    }
    const j = await res.json();
    return j.access_token;
  }

  const t = await res.text().catch(() => "");
  throw new Error(`OAuth failed (client_credentials). ${res.status} ${t}`);
}

// Rate-limit aware fetch (429 + headers)
async function redditFetch(url, token) {
  while (true) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
      },
    });

    const rlRemain = res.headers.get("x-ratelimit-remaining");
    const rlReset = res.headers.get("x-ratelimit-reset");
    const retryAfter = res.headers.get("retry-after");
    if (rlRemain || rlReset) {
      console.warn(
        `[rate] remaining=${rlRemain ?? "-"} reset=${rlReset ?? "-"}`
      );
    }

    if (res.status === 429) {
      let waitSec = 60;
      if (retryAfter) waitSec = Number(retryAfter);
      else if (rlReset) waitSec = Math.ceil(Number(rlReset));
      console.warn(`[429] Waiting ${waitSec}s...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    return res.json();
  }
}

// -------------------- SEARCH --------------------
// Search posts for a query. We paginate using "after" (fullname t3_*) and filter by created_utc >= WINDOW_START_UTC.
async function* searchPosts(token, query) {
  let after = null;
  let fetched = 0;

  // Prefer relevance by comments; can also try sort=top with t=year/all.
  while (true) {
    const params = new URLSearchParams({
      q: query,
      sort: "comments",
      limit: "100",
      type: "link,self", // posts
      include_over_18: "on", // include all to avoid filtering by nsfw
      restrict_sr: "false",
    });
    if (after) params.set("after", after);

    const url = `https://oauth.reddit.com/search?${params.toString()}`;
    const j = await redditFetch(url, token);
    const children = j?.data?.children || [];
    if (children.length === 0) return;

    for (const c of children) {
      if (c.kind !== "t3") continue;
      const post = c.data;
      if (!post) continue;

      // Filter by last 90 days (client-side)
      if (post.created_utc && post.created_utc < WINDOW_START_UTC) {
        // If results already older than window, you may break. But search mixes times; so we keep scanning.
      }

      fetched++;
      yield post;
      if (fetched >= MAX_POSTS_PER_QUERY) return;
    }

    after = j.data?.after || null;
    if (!after) return;
    // Friendly pacing
    await new Promise((r) => setTimeout(r, 400));
  }
}

// Fetch comments (top) for a post id
async function fetchCommentsForPost(token, postId, limit = COMMENTS_PER_POST) {
  // https://oauth.reddit.com/comments/{article}.json
  const url = `https://oauth.reddit.com/comments/${postId}.json?limit=${limit}&sort=top`;
  const j = await redditFetch(url, token);
  // comments are in the second element [1].data.children (kind t1)
  const arr = Array.isArray(j) ? j : [];
  if (arr.length < 2) return [];
  const comments = arr[1]?.data?.children || [];
  return comments.filter((c) => c.kind === "t1" && c.data).map((c) => c.data);
}

// -------------------- FILTERS --------------------
function isPortuguese(text) {
  if (!text) return false;
  const t = " " + text.toLowerCase() + " ";
  if (PT_ACCENTS.test(text)) return true;
  let hit = 0;
  PT_COMMON.forEach((w) => {
    if (t.includes(w)) hit++;
  });
  return hit >= 2;
}

function hintsBrazil(text) {
  if (!text) return false;
  const lc = text.toLowerCase();
  return BRAZIL_HINTS.some((k) => lc.includes(k));
}

function looksBrazilianContext(post, comment) {
  // Heuristic: Portuguese + either Brazil hints in post title or comment,
  // or subreddit hint appears in subreddit display_name.
  const sub = (
    post?.subreddit ||
    post?.subreddit_name_prefixed ||
    ""
  ).toLowerCase();
  const title = (post?.title || "").toLowerCase();
  const body = (comment?.body || "").toLowerCase();

  const subHit = SUBREDDITS_HINT.some((s) => sub.includes(s));
  const brHit = hintsBrazil(title) || hintsBrazil(body);
  return isPortuguese(body) && (subHit || brHit);
}

function formatBlock(post, comment) {
  const created = new Date(comment.created_utc * 1000).toISOString();
  const perma = `https://www.reddit.com${comment.permalink}`;
  const score = comment.score ?? 0;

  const hdr = [
    "------------------------------------------------------------",
    `post_id: ${post.id} | subreddit: ${post.subreddit} | post_title: ${post.title}`,
    `comment_id: ${comment.id} | author: u/${comment.author} | score: ${score}`,
    `date: ${created}`,
    `url: ${perma}`,
    "text:",
  ].join("\n");

  // Preserve original text as-is.
  return `${hdr}\n${comment.body}\n`;
}

// -------------------- MAIN --------------------
(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outPath = path.resolve(__dirname, OUTPUT_FILE);
  fs.writeFileSync(outPath, ""); // truncate
  console.log(`Saving to ${OUTPUT_FILE}`);

  const token = await getAccessToken();
  console.log("OAuth OK.");

  const seenComments = new Set();
  let collected = 0;

  for (const q of QUERIES) {
    if (collected >= MAX_COMMENTS_TOTAL) break;
    console.log(`\n>>> Query: ${q}`);

    for await (const post of searchPosts(token, q)) {
      if (collected >= MAX_COMMENTS_TOTAL) break;

      const comments = await fetchCommentsForPost(
        token,
        post.id,
        COMMENTS_PER_POST
      );
      for (const c of comments) {
        if (!c || seenComments.has(c.id)) continue;
        seenComments.add(c.id);

        // Basic filters
        const text = c.body || "";
        if (text.length < MIN_LENGTH) continue;
        if ((c.score ?? 0) < MIN_SCORE) continue;
        if (!looksBrazilianContext(post, c)) continue;

        // Save block
        const block = formatBlock(post, c);
        fs.appendFileSync(outPath, block + "\n", "utf8");
        collected++;
        if (collected % 20 === 0) {
          console.log(`Collected so far: ${collected}`);
        }
        if (collected >= MAX_COMMENTS_TOTAL) break;
      }

      // Light pacing between posts
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(
    `\nDone. Collected ${collected} comments. Saved to ${OUTPUT_FILE}`
  );
})().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
