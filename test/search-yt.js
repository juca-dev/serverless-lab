/**
 * yt_channel_finder.js
 * Discover YouTube channels for a given niche (Brazil/PT-BR focus)
 * Node 18+ single file, no external deps.
 *
 * Outputs (UTF-8):
 *  - canais_resultados.csv
 *  - canais_resultados.json
 *  - canais_resultados.txt  (just channel URLs)
 *
 * Tuning knobs are at the top (QUERIES, thresholds, etc.).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------- CONFIG --------------------
const API_KEY = process.env.YT_API_KEY;
if (!API_KEY) {
  console.error("Missing YT_API_KEY env var.");
  process.exit(1);
}

// ===== Your niche queries (Portuguese/Brazil) =====
const QUERIES = [
  // Slogan-aligned
  // '"economizar com tecnologia" OR "reduzir custos com tecnologia"',
  // '"escalar meu negócio" OR "escalar meu negocio" escalabilidade',
  // 'FinOps OR "custo de nuvem" OR "conta da nuvem" OR "fatura AWS" OR "otimizar cloud"',
  // '"gestão de TI" OR "gestao de TI" OR "gestão tecnológica" OR "gestao tecnologica" OR "tech lead"',
  // '"dívida técnica" OR "divida tecnica" OR legado OR "refatorar" OR "microserviços" OR microservicos',
  // '"observabilidade" OR "sem logs" OR "sem métricas" OR "sem metricas" OR "erro 500" OR timeout',
  // '"minha empresa precisa" OR "meu negócio precisa" OR "meu negocio precisa" tecnologia',
  // '"site lento" OR "app lento" OR "queda de conversão" OR "queda de conversao" performance',
  // 'LGPD OR "segurança da informação" OR "seguranca da informacao" compliance'

  // // Info produtos
  // '"infoproduto" OR "curso online" OR "ebook" OR "mentoria digital" OR "lançamento digital"',
  // '"plataforma de cursos" OR "venda de curso" OR "hotmart" OR "kebook" OR "monetizze"',

  // // Renda digital
  // '"renda digital" OR "ganhar dinheiro online" OR "renda extra com tecnologia"',
  // '"trabalho remoto" OR "trabalho online" OR "home office" oportunidades',
  // '"marketing digital" OR "funil de vendas" OR "anúncios online" OR "trafego pago"',

  // // Empreendedorismo
  // '"empreendedorismo digital" OR "startup" OR "criar negócio online" OR "negocio online"',
  // '"pequeno empresário" OR "microempreendedor" OR MEI tecnologia',
  // '"transformação digital" OR "automatizar processo" OR "escalar empresa"',

  // Donos de empresas
  '"dono de empresa" OR "proprietário de negócio" OR "pequeno empresário" OR "microempresário"',
  '"gestão empresarial" OR "como gerir empresa" OR "problemas empresariais"',
  '"minha empresa" OR "meu negócio" OR "crescer empresa"',

  // C-levels
  '"CEO" OR "CFO" OR "CTO" OR "CIO" OR "CMO" cargos',
  '"alta gestão" OR "tomada de decisão" OR "executivo de tecnologia"',
  '"estratégia corporativa" OR "governança" OR "decisão estratégica"',

  // Capacitação de Tech Lead
  '"tech lead" OR "engenheiro líder" OR "engenharia de software liderança"',
  '"capacitação de tech lead" OR "formação de líderes de tecnologia"',
  '"mentoria tech lead" OR "como ser um tech lead" OR "liderança técnica"',
  '"soft skills liderança" OR "hard skills tech lead" OR "gestão de times de tecnologia"'
];

// Region/language hints for search
const REGION_CODE = "BR";             // Prefer results for Brazil
const RELEVANCE_LANGUAGE = "pt";      // Portuguese
const ORDER = "relevance";            // or 'viewCount'

// Limits & thresholds
const MAX_PAGES_PER_QUERY = 3;        // each page returns up to 50 results
const RESULTS_PER_PAGE = 50;          // max for YouTube search
const MIN_SUBSCRIBERS = 500;          // filter out tiny channels (adjust as needed)
const MIN_VIDEO_COUNT = 5;            // minimal content
const FETCH_LATEST_UPLOAD = true;     // query latest upload timestamp per channel
const LATEST_UPLOAD_WINDOW_DAYS = 365; // prefer active channels in the last N days (set 0 to disable)

// Heuristics for PT-BR filtering
const PT_COMMON = [
  " de ", " que ", " não ", " nao ", " para ", " você ", " voce ", " com ", " está ", " esta ",
  " sobre ", " pelo ", " pela ", " entre ", " então ", " entao ", " pois ", " pra ", " gente ", " um ", " uma "
];
const PT_ACCENTS = /[áàâãéêíóôõúç]/i;

// -------------------- HELPERS --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function csvEscape(s) {
  if (s == null) return "";
  const str = String(s).replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${str}"`;
}

function isPortuguese(text) {
  if (!text) return false;
  const t = " " + text.toLowerCase() + " ";
  if (PT_ACCENTS.test(text)) return true;
  let hit = 0;
  PT_COMMON.forEach(w => { if (t.includes(w)) hit++; });
  return hit >= 2;
}

function withinDays(iso, days) {
  if (!iso || !days || days <= 0) return true;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return false;
  const now = Date.now();
  const deltaDays = (now - then) / (1000 * 60 * 60 * 24);
  return deltaDays <= days;
}

// -------------------- YOUTUBE CALLS --------------------
async function ytFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`YouTube API HTTP ${res.status}: ${t}`);
  }
  return res.json();
}

// Search for channels given a text query
async function searchChannels(query) {
  let nextPageToken = null;
  let pages = 0;
  const items = [];

  do {
    const params = new URLSearchParams({
      key: API_KEY,
      part: "snippet",
      type: "channel",
      q: query,
      maxResults: String(RESULTS_PER_PAGE),
      order: ORDER,
      regionCode: REGION_CODE,
      relevanceLanguage: RELEVANCE_LANGUAGE
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const j = await ytFetch(url);
    (j.items || []).forEach(i => items.push(i));
    nextPageToken = j.nextPageToken || null;
    pages++;
    if (pages >= MAX_PAGES_PER_QUERY) break;

    // polite pacing
    await sleep(300);
  } while (nextPageToken);

  // Extract channel IDs
  const chIds = items
    .map(i => i?.snippet && i?.id?.channelId ? i.id.channelId : null)
    .filter(Boolean);

  // Get channel details
  return await fetchChannelDetails(chIds);
}

// Fetch stats & details for a list of channel IDs
async function fetchChannelDetails(channelIds) {
  const unique = [...new Set(channelIds)];
  const chunks = [];
  const chunkSize = 50; // channels.list allows up to 50 ids

  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize));
  }

  const results = [];
  for (const ids of chunks) {
    const params = new URLSearchParams({
      key: API_KEY,
      part: "snippet,statistics,contentDetails",
      id: ids.join(",")
    });
    const url = `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
    const j = await ytFetch(url);
    (j.items || []).forEach(c => results.push(c));
    await sleep(250);
  }
  return results;
}

// Get latest upload publishedAt for a channel (via search on channelId)
async function fetchLatestUploadISO(channelId) {
  const params = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    channelId,
    order: "date",
    maxResults: "1",
    type: "video"
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const j = await ytFetch(url);
  const it = (j.items || [])[0];
  return it?.snippet?.publishedAt || null;
}

// -------------------- MAIN --------------------
(async () => {
  console.log(`Searching channels for ${QUERIES.length} queries...`);
  const seen = new Map(); // channelId -> object

  for (const q of QUERIES) {
    console.log(`\n>>> Query: ${q}`);
    let channels = [];
    try {
      channels = await searchChannels(q);
    } catch (e) {
      console.error(`Error on query "${q}": ${e.message}`);
      continue;
    }

    // Enrich & filter
    for (const ch of channels) {
      const id = ch?.id;
      if (!id) continue;

      if (seen.has(id)) continue;

      const sn = ch.snippet || {};
      const st = ch.statistics || {};
      const cd = ch.contentDetails || {};

      const title = sn.title || "";
      const description = sn.description || "";
      const country = sn.country || ""; // may be missing
      const customUrl = sn.customUrl || "";
      const publishedAt = sn.publishedAt || "";

      const subs = Number(st.subscriberCount || 0);
      const views = Number(st.viewCount || 0);
      const videos = Number(st.videoCount || 0);

      // Heuristic: PT-BR
      const isPT = isPortuguese(title + " " + description);
      const isBR = country?.toUpperCase() === "BR" || isPT; // prefer BR; if missing, PT language helps

      if (!isBR) continue;
      if (subs < MIN_SUBSCRIBERS) continue;
      if (videos < MIN_VIDEO_COUNT) continue;

      // Optional: check recent activity
      let latestUploadAt = null;
      if (FETCH_LATEST_UPLOAD) {
        try {
          latestUploadAt = await fetchLatestUploadISO(id);
        } catch {
          latestUploadAt = null;
        }
        if (LATEST_UPLOAD_WINDOW_DAYS > 0 && !withinDays(latestUploadAt, LATEST_UPLOAD_WINDOW_DAYS)) {
          // stale channel
          continue;
        }
      }

      seen.set(id, {
        channelId: id,
        title,
        customUrl,
        country,
        subscribers: subs,
        videoCount: videos,
        viewCount: views,
        publishedAt,
        latestUploadAt,
        description
      });

      // Light pacing between channel-level calls
      await sleep(120);
    }
  }

  // Sort by subscribers desc, then viewCount
  const rows = [...seen.values()].sort((a, b) => {
    if (b.subscribers !== a.subscribers) return b.subscribers - a.subscribers;
    return (b.viewCount || 0) - (a.viewCount || 0);
  });

  // -------------------- OUTPUTS --------------------
  const outCsv = path.resolve(__dirname, "canais_resultados.csv");
  const outJson = path.resolve(__dirname, "canais_resultados.json");
  const outTxt = path.resolve(__dirname, "canais_resultados.txt");

  // CSV
  const header = [
    "channelId","title","customUrl","country",
    "subscribers","videoCount","viewCount",
    "publishedAt","latestUploadAt","channelUrl","aboutUrl","description"
  ].map(csvEscape).join(",") + "\n";

  const csvBody = rows.map(r => {
    const channelUrl = r.customUrl ? `https://www.youtube.com/${r.customUrl}` : `https://www.youtube.com/channel/${r.channelId}`;
    const aboutUrl = `${channelUrl}/about`;
    return [
      r.channelId,
      r.title,
      r.customUrl || "",
      r.country || "",
      r.subscribers,
      r.videoCount,
      r.viewCount,
      r.publishedAt || "",
      r.latestUploadAt || "",
      channelUrl,
      aboutUrl,
      r.description || ""
    ].map(csvEscape).join(",");
  }).join("\n");

  fs.writeFileSync(outCsv, header + csvBody, "utf8");

  // JSON
  fs.writeFileSync(outJson, JSON.stringify(rows, null, 2), "utf8");

  // TXT (just URLs)
  const txt = rows.map(r => r.customUrl
    ? `https://www.youtube.com/${r.customUrl}`
    : `https://www.youtube.com/channel/${r.channelId}`
  ).join("\n");
  fs.writeFileSync(outTxt, txt, "utf8");

  console.log(`\nDone. Saved:\n- ${path.basename(outCsv)}\n- ${path.basename(outJson)}\n- ${path.basename(outTxt)}\n`);
})().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
