/**
 * X (Twitter) recent search → save replies in PT-BR to resultados.txt
 * Single-file Node.js script (Node 18+)
 *
 * Setup:
 *   export X_BEARER_TOKEN="YOUR_TOKEN_HERE"
 * Run:
 *   node coletar_x.js
 *
 * Notes:
 * - Uses official v2 API (recent search). Access window depends on your plan.
 * - Filters: language=pt, is:reply, no retweets/quotes.
 * - Heuristics for Brazil using user.location and tweet.place (when present).
 * - Deduplicates across multiple queries; writes to resultados.txt (UTF-8).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------- CONFIG --------------------
const BEARER = process.env.X_BEARER_TOKEN;
if (!BEARER) {
  console.error("Missing X_BEARER_TOKEN env var.");
  process.exit(1);
}

// Output
const OUTPUT_FILE = "resultados.txt";

// Time window (default: last 7 days to fit most plans)
const NOW = new Date();
const DEFAULT_DAYS = 7; // adjust if your plan allows more
const startTime = new Date(NOW.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .substring(0, 10);
const endTime = NOW.toISOString().substring(0, 10);

// Engagement thresholds (adjust as you like)
const MIN_LIKES = 5;
const MIN_REPLIES = 2;
const MIN_RETWEETS = 1;

// Max tweets per query (hard cap to avoid huge files)
const MAX_TWEETS_PER_QUERY = 300;

// Heuristic filter for Brazil (user.location or place.country_code === "BR")
const BRAZIL_KEYWORDS = [
  "Brasil",
  "Brazil",
  "BR",
  "São Paulo",
  "SP",
  "Rio de Janeiro",
  "RJ",
  "Minas",
  "BH",
  "Curitiba",
  "PR",
  "Porto Alegre",
  "RS",
  "Florianópolis",
  "SC",
  "Goiânia",
  "GO",
  "Recife",
  "PE",
  "Salvador",
  "BA",
  "Fortaleza",
  "CE",
  "Belém",
  "PA",
  "Manaus",
  "AM",
  "Brasília",
  "DF",
  "Campinas",
  "Santos",
  "Maceió",
  "Natal",
  "João Pessoa",
  "Cuiabá",
  "Campo Grande",
  "Vitória",
  "ES",
  "Uberlândia",
  "Ribeirão Preto",
  "SJP",
  "São José dos Pinhais",
];

// Domain-specific queries (is:reply + lang:pt + negative filters)
const QUERIES = [
  // Escalabilidade / MVP / gargalos
  '("MVP" OR "produto") ("não escala" OR trava OR "cai com") lang:pt is:reply -is:retweet -is:quote',
  '("escalar software" OR escalabilidade OR "pico de tráfego") lang:pt is:reply -is:retweet -is:quote',
  '("dívida técnica" OR "tech debt" OR refatoração OR legado) (startup OR PME) lang:pt is:reply -is:retweet -is:quote',
  // Custos / nuvem / finops
  '("fatura" OR "custo") (nuvem OR cloud OR AWS OR Azure OR GCP) (caro OR explodiu OR cortar) lang:pt is:reply -is:retweet -is:quote',
  // Observabilidade / produção
  '("observabilidade" OR "sem logs" OR "sem métricas") (prod OR produção) lang:pt is:reply -is:retweet -is:quote',
  '("timeout" OR "erro 500" OR latência) (cliente OR checkout OR vendas) lang:pt is:reply -is:retweet -is:quote',
  // Arquitetura / microserviços
  "(monolito OR monolith) (migrar OR microserviços) lang:pt is:reply -is:retweet -is:quote",
  // Processo / CI/CD
  '("deploy" OR "CI/CD") ("sem teste" OR quebrado) lang:pt is:reply -is:retweet -is:quote',
  // Perfil do emissor (fundadores/C-level) — ajuda a puxar dor de decisor
  '(fundador OR cofundador OR CEO OR dono OR sócio) ("meu software" OR "nosso produto" OR "nossa plataforma") lang:pt is:reply -is:retweet -is:quote',
];

// ------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://api.x.com/2/tweets/search/recent";

const TWEET_FIELDS = [
  "id",
  "text",
  "author_id",
  "created_at",
  "lang",
  "public_metrics",
  "conversation_id",
  "referenced_tweets",
  "geo",
].join(",");

const USER_FIELDS = [
  "id",
  "name",
  "username",
  "location",
  "description",
  "public_metrics",
  "verified",
].join(",");

const PLACE_FIELDS = ["full_name", "country", "country_code"].join(",");

// Simple sleep/backoff
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rate limit–aware fetch
async function xFetch(url, params) {
  let attempt = 0;
  while (true) {
    console.log(`attempt: `, attempt, url);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BEARER}`,
      },
    });

    if (res.status === 429) {
      // rate limited → backoff
      const reset = parseInt(res.headers.get("x-rate-limit-reset"));
      const resetAt = new Date(reset * 1000);
      let wait = 0;
      do {
        wait = resetAt.getTime() - Date.now();
        console.warn(`[429] Rate limited. Waiting ${Math.floor(wait / 1000)}s...`);
        attempt++;
        await sleep(1000);
      } while (wait > 0);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return res.json();
  }
}

// Build the request URL with query & pagination
function buildUrl(q, nextToken = null) {
  const usp = new URLSearchParams({
    query: q,
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "place.fields": PLACE_FIELDS,
    expansions: "author_id,geo.place_id",
    max_results: "100",
    start_time: startTime,
    end_time: endTime,
  });
  if (nextToken) usp.set("next_token", nextToken);
  return `${API_URL}?${usp.toString()}`;
}

// Check if user location looks Brazilian
function looksBrazilian(user, place) {
  if (place && place.country_code === "BR") return true;
  if (user && typeof user.location === "string") {
    const loc = user.location.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return BRAZIL_KEYWORDS.some((k) =>
      loc.toLowerCase().includes(
        k
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
      )
    );
  }
  return false;
}

// Format a tweet record to plain text block
function formatRecord(t, user, place) {
  const pm = t.public_metrics || {};
  const u = user ? `@${user.username}` : t.author_id;
  const loc = place?.full_name ? ` | place: ${place.full_name}` : "";
  const url = user
    ? `https://x.com/${user.username}/status/${t.id}`
    : `https://x.com/i/status/${t.id}`;
  // Clean up whitespace in text (keep original content)
  const text = t.text.replace(/\s+\n/g, "\n").trim();

  return [
    "------------------------------------------------------------",
    `id: ${t.id}`,
    `author: ${u}${loc}`,
    `date: ${t.created_at}`,
    `metrics: likes=${pm.like_count ?? 0} replies=${pm.reply_count ?? 0} rts=${
      pm.retweet_count ?? 0
    } quotes=${pm.quote_count ?? 0}`,
    `url: ${url}`,
    "text:",
    text,
    "",
  ].join("\n");
}

// Main: iterate queries, paginate, filter, write
(async () => {
  console.log(
    `Searching ${QUERIES.length} queries... window: ${startTime} → ${endTime}`
  );
  const outPath = path.resolve(__dirname, OUTPUT_FILE);
  fs.writeFileSync(outPath, ""); // truncate

  const globalSeen = new Set(); // dedupe tweet IDs

  for (const q of QUERIES) {
    console.log(`\n>>> Query: ${q}`);
    let next = null;
    let countForQuery = 0;

    // paginate
    while (true) {
      if (countForQuery >= MAX_TWEETS_PER_QUERY) break;
      const url = buildUrl(q, next);
      let data;
      try {
        data = await xFetch(url);
      } catch (err) {
        console.error(`Error on query page: ${err.message}`);
        break;
      }

      const users = new Map((data.includes?.users || []).map((u) => [u.id, u]));
      const places = new Map(
        (data.includes?.places || []).map((p) => [p.id, p])
      );

      for (const t of data.data || []) {
        if (globalSeen.has(t.id)) continue;
        globalSeen.add(t.id);

        // Keep only Portuguese replies
        if (t.lang !== "pt") continue;

        // Engagement filters
        const pm = t.public_metrics || {};
        if ((pm.like_count ?? 0) < MIN_LIKES) continue;
        if ((pm.reply_count ?? 0) < MIN_REPLIES) continue;
        if ((pm.retweet_count ?? 0) < MIN_RETWEETS) continue;

        // Brazil heuristic
        const user = users.get(t.author_id);
        const place = t.geo?.place_id ? places.get(t.geo.place_id) : null;
        if (!looksBrazilian(user, place)) continue;

        // Append to file
        const block = formatRecord(t, user, place);
        fs.appendFileSync(outPath, block + "\n", "utf8");
        countForQuery++;
        if (countForQuery >= MAX_TWEETS_PER_QUERY) break;
      }

      next = data.meta?.next_token || null;
      if (!next) break;
      // Friendly pacing to reduce rate-limit risk
      await sleep(500);
    }

    console.log(`Collected for query: ${countForQuery}`);
  }

  console.log(`\nDone. Saved to ${OUTPUT_FILE}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
