/**
 * yt_engagement_from_ids.js
 * Given a list of YouTube channel IDs (one per line in channel_ids.txt),
 * fetch last 30 recent videos per channel, compute engagement, analyze PT-BR
 * sentiment of comments, and export CSV + JSON.
 *
 * Node 18+, single file, no external deps.
 *
 * Env:
 *   YT_API_KEY=<your YouTube Data API v3 key>
 *
 * Inputs:
 *   channel_ids.txt   // one channelId per line (e.g., UC_x5XG1OV2P6uZZ5FSM9Ttw)
 *
 * Outputs (UTF-8):
 *   videos_engajamento.csv
 *   videos_engajamento.json
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

const CHANNEL_IDS_FILE = "channel_ids.txt";
const VIDEOS_PER_CHANNEL = 30;       // last N videos (search.list caps at 50)
const COMMENTS_PER_VIDEO = 60;       // reduce if quota tight (0 to skip comments)
const COMMENT_PAGE_SIZE = 50;        // up to 100; 50 is a safe balance

// Engagement weights (transparent and easy to tweak)
const W_VIEWS = 1.0;
const W_COMMENTS = 20.0;
const W_LIKES = 5.0;

// -------------------- SENTIMENT (PT-BR, lightweight) --------------------
const POS_WORDS = [
  "bom","boa","excelente","ótimo","otimo","incrível","incrivel","maravilhoso","fantástico","fantastico",
  "ajudou","ajuda","útil","util","gostei","top","perfeito","funcionou","show","sensacional","recomendo","aprovado"
];
const NEG_WORDS = [
  "ruim","péssimo","pessimo","horrível","horrivel","lixo","fracasso","não funciona","nao funciona",
  "bugado","caro","decepcionado","decepcionante","pior","triste","errado","falhou","enganoso","fraco"
];
const NEGATORS = ["não","nao","nunca","jamais","sem"];
const INTENSIFIERS = ["muito","super","bem","demais","bastante"];

// -------------------- HELPERS --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function csvEscape(s){
  if (s == null) return "";
  const str = String(s).replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${str}"`;
}

function tokenizePT(text){
  return (text||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .split(/\s+/)
    .filter(Boolean);
}

function sentimentPT(text){
  const toks = tokenizePT(text);
  let score = 0;
  let pos=0, neg=0;
  let lastNeg = false;
  let intens = 1;

  for (const t of toks){
    if (NEGATORS.includes(t)) { lastNeg = true; continue; }
    if (INTENSIFIERS.includes(t)) { intens += 0.25; continue; }

    const isPos = POS_WORDS.includes(t);
    const isNeg = NEG_WORDS.includes(t) || text.includes("não funciona") || text.includes("nao funciona");

    if (isPos){
      const s = lastNeg ? -1 : 1;
      score += s * intens;
      if (s>0) pos++; else neg++;
      lastNeg = false; intens = 1;
    } else if (isNeg){
      const s = lastNeg ? 1 : -1;
      score += s * intens;
      if (s>0) pos++; else neg++;
      lastNeg = false; intens = 1;
    } else {
      lastNeg = false;
    }
  }
  let label = "neutral";
  if (score > 0.4) label = "positive";
  else if (score < -0.4) label = "negative";
  return {score, label, pos, neg};
}

function aggregateSentiment(items){
  const n = items.length;
  if (!n) return {avgScore:0, posPct:0, negPct:0, neuPct:100};
  const pos = items.filter(i=>i.label==="positive").length;
  const neg = items.filter(i=>i.label==="negative").length;
  const neu = n - pos - neg;
  const avg = items.reduce((a,b)=>a+b.score,0)/n;
  return {
    avgScore: Number(avg.toFixed(3)),
    posPct: Number((100*pos/n).toFixed(1)),
    negPct: Number((100*neg/n).toFixed(1)),
    neuPct: Number((100*neu/n).toFixed(1))
  };
}

function engagementScore({views=0, comments=0, likes=0}){
  const v = Number(views)||0;
  const c = Number(comments)||0;
  const l = Number(likes)||0;
  const lv = Math.log10(v+1); // avoid views dominance
  return Number((W_VIEWS*lv + W_COMMENTS*c + W_LIKES*l).toFixed(3));
}

// -------------------- YOUTUBE API --------------------
async function ytFetch(url){
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`YouTube API HTTP ${res.status}: ${t}`);
  }
  return res.json();
}

async function fetchChannelBasics(channelIds){
  // channels.list (snippet, statistics)
  const unique = [...new Set(channelIds)].filter(Boolean);
  const chunkSize = 50;
  const out = [];
  for (let i=0;i<unique.length;i+=chunkSize){
    const ids = unique.slice(i,i+chunkSize);
    const params = new URLSearchParams({
      key: API_KEY,
      part: "snippet,statistics",
      id: ids.join(",")
    });
    const url = `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
    const j = await ytFetch(url);
    (j.items||[]).forEach(c=>out.push(c));
    await sleep(200);
  }
  return out;
}

async function fetchRecentVideosForChannel(channelId, maxResults){
  // search.list for latest videos by channel
  const params = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    channelId,
    order: "date",
    maxResults: String(Math.min(maxResults,50)),
    type: "video"
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const j = await ytFetch(url);
  const arr = (j.items||[]).map(it => ({
    videoId: it.id?.videoId,
    publishedAt: it.snippet?.publishedAt,
    title: it.snippet?.title,
    description: it.snippet?.description
  })).filter(v=>v.videoId);
  return arr.slice(0, maxResults);
}

async function fetchVideosStats(videoIds){
  const unique = [...new Set(videoIds)].filter(Boolean);
  const chunkSize = 50;
  const out = [];
  for (let i=0;i<unique.length;i+=chunkSize){
    const ids = unique.slice(i,i+chunkSize);
    const params = new URLSearchParams({
      key: API_KEY,
      part: "snippet,statistics",
      id: ids.join(",")
    });
    const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    const j = await ytFetch(url);
    (j.items||[]).forEach(v=>out.push(v));
    await sleep(200);
  }
  const map = new Map();
  for (const v of out){
    const st = v.statistics||{};
    map.set(v.id, {
      views: Number(st.viewCount||0),
      likes: Number(st.likeCount||0),        // may be empty depending on channel config
      comments: Number(st.commentCount||0),
      title: v.snippet?.title || "",
      publishedAt: v.snippet?.publishedAt || ""
    });
  }
  return map;
}

async function fetchVideoComments(videoId, maxCount){
  if (maxCount <= 0) return [];
  let nextPageToken = null;
  const got = [];
  do {
    const pageSize = Math.min(COMMENT_PAGE_SIZE, maxCount - got.length);
    if (pageSize <= 0) break;
    const params = new URLSearchParams({
      key: API_KEY,
      part: "snippet",
      videoId,
      maxResults: String(pageSize),
      order: "relevance",
      textFormat: "plainText"
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`;
    const j = await ytFetch(url);
    const items = j.items || [];
    for (const it of items){
      const top = it.snippet?.topLevelComment?.snippet;
      if (top?.textDisplay){
        got.push({
          author: top.authorDisplayName || "",
          text: top.textDisplay || "",
          likeCount: Number(top.likeCount || 0),
          publishedAt: top.publishedAt || ""
        });
      }
    }
    nextPageToken = j.nextPageToken || null;
    await sleep(150);
  } while (nextPageToken && got.length < maxCount);
  return got;
}

// -------------------- IO --------------------
function readChannelIds(filePath){
  const full = path.resolve(__dirname, filePath);
  if (!fs.existsSync(full)){
    console.error(`Input file not found: ${filePath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(full, "utf8")
    .split(/\r?\n/)
    .map(l=>l.trim())
    .filter(l=>l && !l.startsWith("#"));
  // Only accept canonical channel IDs (start with UC…)
  const ids = lines.filter(l => /^UC[0-9A-Za-z_-]{20,}$/.test(l));
  const rejected = lines.filter(l => !/^UC[0-9A-Za-z_-]{20,}$/.test(l));
  if (rejected.length){
    console.warn(`Ignored ${rejected.length} non-channelId lines (expects IDs like UCxxxx...).`);
  }
  return ids;
}

// -------------------- MAIN --------------------
(async ()=>{
  console.log("YouTube engagement (from channel IDs) starting...");
  const channelIds = readChannelIds(CHANNEL_IDS_FILE);
  if (!channelIds.length){
    console.error("No valid channel IDs found in channel_ids.txt");
    process.exit(1);
  }
  console.log(`Channels to process: ${channelIds.length}`);

  // 1) Basic channel metadata
  const channels = await fetchChannelBasics(channelIds);
  const channelMap = new Map();
  for (const ch of channels){
    const id = ch.id;
    const title = ch.snippet?.title || "";
    const customUrl = ch.snippet?.customUrl || "";
    const chUrl = customUrl ? `https://www.youtube.com/${customUrl}` : `https://www.youtube.com/channel/${id}`;
    channelMap.set(id, { id, title, chUrl });
  }

  const results = []; // per-video
  // 2) Per channel: fetch recent videos -> stats -> comments -> sentiment
  for (const chId of channelIds){
    const meta = channelMap.get(chId) || { id: chId, title: chId, chUrl: `https://www.youtube.com/channel/${chId}` };
    console.log(`\nChannel: ${meta.title} (${chId})`);

    let recent = [];
    try {
      recent = await fetchRecentVideosForChannel(chId, VIDEOS_PER_CHANNEL);
    } catch(e){
      console.error(`  Failed to fetch recent videos: ${e.message}`);
      continue;
    }
    if (!recent.length){
      console.log("  No recent videos.");
      continue;
    }

    const statsMap = await fetchVideosStats(recent.map(v=>v.videoId));

    for (const v of recent){
      const st = statsMap.get(v.videoId) || {};
      const views = st.views || 0;
      const likes = st.likes || 0;
      const commentsReported = st.comments || 0;

      let comments = [];
      try {
        comments = await fetchVideoComments(v.videoId, COMMENTS_PER_VIDEO);
      } catch(e){
        console.error(`  Error fetching comments for ${v.videoId}: ${e.message}`);
        comments = [];
      }

      const sentiments = comments.map(c => sentimentPT(c.text));
      const agg = aggregateSentiment(sentiments);
      const eScore = engagementScore({
        views,
        comments: commentsReported, // use API’s official count, even if we fetched a subset
        likes
      });

      const sample = comments.slice(0,3).map(c => c.text);

      results.push({
        channelId: chId,
        channelTitle: meta.title,
        channelUrl: meta.chUrl,
        videoId: v.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        videoTitle: st.title || v.title || "",
        publishedAt: st.publishedAt || v.publishedAt || "",
        views,
        likes,
        commentsCount: commentsReported,
        engagementScore: eScore,
        sentiment: agg,
        sampleComments: sample
      });

      await sleep(120);
    }
  }

  // 3) Sort by engagement desc
  results.sort((a,b)=> b.engagementScore - a.engagementScore);

  // 4) Write outputs
  const outCsv = path.resolve(__dirname, "videos_engajamento.csv");
  const outJson = path.resolve(__dirname, "videos_engajamento.json");

  const header = [
    "channelTitle","channelUrl","videoTitle","videoUrl",
    "publishedAt","views","likes","commentsCount","engagementScore",
    "sentiment.avgScore","sentiment.posPct","sentiment.negPct","sentiment.neuPct",
    "sampleComment1","sampleComment2","sampleComment3"
  ].map(csvEscape).join(",") + "\n";

  const csvBody = results.map(r=>[
    r.channelTitle,
    r.channelUrl,
    r.videoTitle,
    r.videoUrl,
    r.publishedAt,
    r.views,
    r.likes,
    r.commentsCount,
    r.engagementScore,
    r.sentiment.avgScore,
    r.sentiment.posPct,
    r.sentiment.negPct,
    r.sentiment.neuPct,
    r.sampleComments?.[0]||"",
    r.sampleComments?.[1]||"",
    r.sampleComments?.[2]||""
  ].map(csvEscape).join(",")).join("\n");

  fs.writeFileSync(outCsv, header + csvBody, "utf8");
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2), "utf8");

  console.log(`\nDone. Saved:\n- ${path.basename(outCsv)}\n- ${path.basename(outJson)}\n`);
})().catch(e=>{
  console.error("Fatal:", e);
  process.exit(1);
});
