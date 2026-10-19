import { createServer } from "node:http";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = process.env.MEDIACRAWLER_DATA_DIR || "E:\\爆款复刻视频\\视频\\肉\\自家肉\\更换背景\\9月23\\MediaCrawler运行目录\\https-github-com-nanmicoder-mediacrawler-https\\MediaCrawler\\data";
const assetRoot = process.env.CONTENT_ASSET_DIR || path.join(moduleDir, "downloaded-assets");
const port = Number(process.env.CONTENT_BRIDGE_PORT || 4174);
const publicAudioToken = process.env.DOUBAO_ASR_PUBLIC_TOKEN || randomUUID().replaceAll("-", "");
const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  "C:\\Users\\admin\\AppData\\Local\\Packages\\MediaFreeware.5194421BBEBE_bn8kag5gkzjge\\LocalState\\ffmpeg.exe",
].filter(Boolean);
const batchJob = { status: "idle", total: 0, completed: 0, succeeded: 0, failed: 0, current: "", started_at: null, finished_at: null, errors: [] };

function reply(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function sanitizeName(value, fallback = "content") {
  const cleaned = String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 96);
}

function assetId(value) {
  return sanitizeName(String(value || "content").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_"), "content");
}

function splitUrls(value) {
  if (Array.isArray(value)) return value.flatMap(splitUrls);
  return String(value || "").split(",").map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url));
}

function safeAssetPath(relativePath) {
  const fullPath = path.resolve(assetRoot, decodeURIComponent(relativePath || ""));
  const rootWithSeparator = path.resolve(assetRoot) + path.sep;
  if (!fullPath.startsWith(rootWithSeparator)) throw new Error("Invalid asset path");
  return fullPath;
}

function mimeFor(filename) {
  const extension = path.extname(filename).toLowerCase();
  return { ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" }[extension] || "application/octet-stream";
}

function extensionFor(url, contentType, fallback) {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(mp4|webm|m4a|mp3|wav|jpg|jpeg|png|webp)$/i.test(fromUrl)) return fromUrl;
  const normalized = String(contentType || "").split(";")[0].toLowerCase();
  if (normalized.includes("video")) return ".mp4";
  if (normalized.includes("audio")) return ".m4a";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  return fallback;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) return [fullPath];
    return [];
  }));
  return nested.flat();
}

async function listJsonlFiles() {
  try {
    const files = await walk(dataRoot);
    const result = await Promise.all(files.map(async (fullPath) => {
      const stat = await fs.stat(fullPath);
      const text = await fs.readFile(fullPath, "utf8");
      return { name: path.basename(fullPath), path: path.relative(dataRoot, fullPath).split(path.sep).join("/"), size: stat.size, modified_at: stat.mtime.toISOString(), record_count: text.split(/\r?\n/).filter(Boolean).length, type: "jsonl" };
    }));
    return result.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

function resolveFile(relativePath) {
  const fullPath = path.resolve(dataRoot, decodeURIComponent(relativePath || ""));
  const rootWithSeparator = path.resolve(dataRoot) + path.sep;
  if (!fullPath.startsWith(rootWithSeparator) || path.extname(fullPath).toLowerCase() !== ".jsonl") throw new Error("Invalid data path");
  return fullPath;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readManifest(id) {
  try { return JSON.parse(await fs.readFile(path.join(safeAssetPath(id), "manifest.json"), "utf8")); } catch (error) { if (error && error.code === "ENOENT") return null; throw error; }
}

async function writeManifest(id, manifest) {
  const folder = safeAssetPath(id);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

function mediaRequestHeaders(url) {
  const normalized = String(url || "").toLowerCase();
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    Accept: "*/*",
    "Cache-Control": "no-cache",
  };
  if (normalized.includes("douyin.com") || normalized.includes("douyinvod.com") || normalized.includes("douyincdn.com")) {
    headers.Referer = "https://www.douyin.com/";
    headers.Origin = "https://www.douyin.com";
    headers["Sec-Fetch-Dest"] = "video";
    headers["Sec-Fetch-Mode"] = "cors";
    headers["Sec-Fetch-Site"] = "same-origin";
  } else if (normalized.includes("xiaohongshu.com") || normalized.includes("xhscdn.com")) {
    headers.Referer = "https://www.xiaohongshu.com/";
    headers.Origin = "https://www.xiaohongshu.com";
  }
  return headers;
}

async function downloadToFile(url, destinationBase, fallbackExtension) {
  const response = await fetch(url, { headers: mediaRequestHeaders(url), redirect: "follow" });
  if (!response.ok || !response.body) throw new Error("HTTP " + response.status);
  const filename = destinationBase + extensionFor(url, response.headers.get("content-type"), fallbackExtension);
  const temporary = filename + ".part";
  await pipeline(Readable.fromWeb(response.body), (await fs.open(temporary, "w")).createWriteStream());
  await fs.rename(temporary, filename);
  const stat = await fs.stat(filename);
  return { file: path.basename(filename), bytes: stat.size, source_url: url };
}

async function findFfmpeg() {
  for (const candidate of ffmpegCandidates) {
    try { await fs.access(candidate); return candidate; } catch { /* try next */ }
  }
  return null;
}

async function extractAudio(videoPath, outputPath) {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) throw new Error("未检测到 ffmpeg，无法从视频提取音频");
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", outputPath], { windowsHide: true });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.slice(-1000) || "ffmpeg exited with " + code)));
  });
  const stat = await fs.stat(outputPath);
  return { file: path.basename(outputPath), bytes: stat.size };
}

async function downloadAssets(record) {
  const id = assetId(record.id || record.note_id || record.title);
  const folder = safeAssetPath(id);
  await fs.mkdir(folder, { recursive: true });
  const existing = await readManifest(id);
  const manifest = existing || { id, title: String(record.title || "未命名内容"), original_source: String(record.source || record.note_url || ""), created_at: new Date().toISOString(), assets: {} };
  manifest.title = String(record.title || manifest.title);
  manifest.original_source = String(record.source || record.note_url || manifest.original_source || "");
  manifest.cover_source = String(record.coverUrl || record.cover_url || splitUrls(record.imageUrls || record.image_list)[0] || "");
  manifest.video_sources = splitUrls(record.videoUrls || record.video_url || record.video_download_url || record.play_url);
  manifest.audio_sources = splitUrls(record.audioUrls || record.music_download_url || record.audio_url);
  manifest.image_sources = splitUrls(record.imageUrls || record.image_list);
  manifest.assets ||= {};
  const errors = [];

  async function tryDownload(kind, urls, base, ext) {
    if (!urls.length || manifest.assets[kind]?.file) return;
    for (const url of urls) {
      try { manifest.assets[kind] = await downloadToFile(url, path.join(folder, base), ext); return; }
      catch (error) { errors.push(kind + " 下载失败：" + (error instanceof Error ? error.message : String(error))); }
    }
  }

  await tryDownload("cover", splitUrls(manifest.cover_source), "cover", ".jpg");
  await tryDownload("video", manifest.video_sources, "video", ".mp4");
  await tryDownload("audio", manifest.audio_sources, "audio", ".mp3");
  if (manifest.image_sources.length && !manifest.assets.images) {
    const images = [];
    for (const [index, url] of manifest.image_sources.entries()) {
      try { images.push(await downloadToFile(url, path.join(folder, "image-" + String(index + 1).padStart(2, "0")), ".jpg")); } catch (error) { errors.push("图片下载失败：" + (error instanceof Error ? error.message : String(error))); }
    }
    if (images.length) manifest.assets.images = images;
  }
  if (manifest.assets.video?.file && !manifest.assets.audio?.file) {
    try { manifest.assets.audio = await extractAudio(path.join(folder, manifest.assets.video.file), path.join(folder, "audio.mp3")); }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  manifest.updated_at = new Date().toISOString();
  manifest.errors = errors;
  await writeManifest(id, manifest);
  return manifest;
}

async function allContentRecords() {
  const files = (await listJsonlFiles()).filter((file) => /contents/i.test(file.name));
  const records = [];
  const identities = new Set();
  for (const file of files) {
    const lines = (await fs.readFile(resolveFile(file.path), "utf8")).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const id = assetId(record.note_id || record.aweme_id || record.video_id || record.id || record.title);
        if (!identities.has(id)) { identities.add(id); records.push(record); }
      } catch { /* skip malformed JSONL record */ }
    }
  }
  return records;
}

async function runBatchDownload() {
  const records = await allContentRecords();
  Object.assign(batchJob, { status: "running", total: records.length, completed: 0, succeeded: 0, failed: 0, current: "", started_at: new Date().toISOString(), finished_at: null, errors: [] });
  for (const record of records) {
    batchJob.current = String(record.title || record.note_id || record.aweme_id || "未命名内容").slice(0, 80);
    try {
      const manifest = await downloadAssets(record);
      if (manifest.assets.cover || manifest.assets.video || manifest.assets.audio || manifest.assets.images?.length) batchJob.succeeded += 1;
      else { batchJob.failed += 1; batchJob.errors.push(batchJob.current + "：未找到可下载资源"); }
    } catch (error) {
      batchJob.failed += 1;
      batchJob.errors.push(batchJob.current + "：" + (error instanceof Error ? error.message : String(error)));
    }
    batchJob.completed += 1;
  }
  batchJob.status = "completed";
  batchJob.current = "";
  batchJob.finished_at = new Date().toISOString();
}

function publicAudioUrl(id, filename) {
  const base = process.env.DOUBAO_ASR_PUBLIC_BASE_URL;
  if (!base || !publicAudioToken) return null;
  return base.replace(/\/$/, "") + "/public-audio/" + encodeURIComponent(publicAudioToken) + "/" + encodeURIComponent(id) + "/" + encodeURIComponent(filename);
}

function doubaoConfig() {
  return { ready: Boolean(process.env.DOUBAO_ASR_API_KEY && process.env.DOUBAO_ASR_PUBLIC_BASE_URL), has_api_key: Boolean(process.env.DOUBAO_ASR_API_KEY), has_public_audio_base: Boolean(process.env.DOUBAO_ASR_PUBLIC_BASE_URL), has_public_audio_token: true, resource_id: process.env.DOUBAO_ASR_RESOURCE_ID || "volc.seedasr.auc" };
}

function aiConfig() {
  return {
    deepseek: { ready: Boolean(process.env.DEEPSEEK_API_KEY), model: process.env.DEEPSEEK_MODEL || "deepseek-flash" },
    image: { ready: Boolean(process.env.ZHIPU_API_KEY), model: process.env.ZHIPU_IMAGE_MODEL || "cogview-3-flash" },
  };
}

async function saveTextArtifact(id, filename, content) {
  const folder = safeAssetPath(id);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, filename), content, "utf8");
  return filename;
}

async function rewriteWithDeepSeek(id, body) {
  const config = aiConfig().deepseek;
  if (!config.ready) throw new Error("DeepSeek 尚未配置，请在工作台启动环境中设置 DEEPSEEK_API_KEY");
  const sourceText = String(body.source_text || "").trim();
  if (!sourceText) throw new Error("请先提供待改写的逐字稿");
  const systemPrompt = String(body.system_prompt || "你是一位专业的新媒体内容编辑。保留事实，不虚构数据，以清晰自然的中文改写。").trim();
  const instruction = String(body.instruction || "请将下面的逐字稿改写为结构清晰、可直接发布的内容文案。请使用自然段，每段表达一个完整意思。").trim();
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY },
    body: JSON.stringify({ model: config.model, stream: false, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: instruction + "\n\n逐字稿：\n" + sourceText }] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "DeepSeek 改写请求失败");
  const text = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("DeepSeek 没有返回可用文案");
  const manifest = (await readManifest(id)) || { id, title: "未命名内容", assets: {} };
  const filename = "rewrite-" + Date.now() + ".txt";
  await saveTextArtifact(id, filename, text);
  manifest.rewrites ||= [];
  const rewrite = { id: path.basename(filename, ".txt"), text, filename, system_prompt: systemPrompt, instruction, created_at: new Date().toISOString(), model: config.model };
  manifest.rewrites.unshift(rewrite);
  await writeManifest(id, manifest);
  return rewrite;
}

function imageSizeForRatio(ratio) {
  return { "9:16": "768x1344", "16:9": "1344x768", "3:4": "864x1152", "4:3": "1152x864", "1:1": "1024x1024" }[ratio] || "864x1152";
}

async function localReferenceDataUrl(id) {
  const manifest = await readManifest(id);
  const file = manifest?.assets?.cover?.file || manifest?.assets?.images?.[0]?.file;
  if (!file) return null;
  const fullPath = safeAssetPath(path.join(id, file));
  const buffer = await fs.readFile(fullPath);
  return "data:" + mimeFor(fullPath) + ";base64," + buffer.toString("base64");
}

async function describeReferenceCover(id) {
  const config = aiConfig().deepseek;
  const dataUrl = await localReferenceDataUrl(id);
  if (!dataUrl) throw new Error("请先下载原始封面，才能使用参考图生图");
  if (!config.ready) throw new Error("参考图分析需要 DEEPSEEK_API_KEY；请先完成本机配置");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY },
    body: JSON.stringify({ model: process.env.DEEPSEEK_VISION_MODEL || "deepseek-flash", stream: false, messages: [{ role: "system", content: "你是平面视觉分析师。请提取封面的构图、主体、色彩、排版层级与风格，输出简洁中文描述；不要识别或复刻商标、水印和具体人物身份。" }, { role: "user", content: [{ type: "text", text: "请分析这张封面，给文生图模型提供可借鉴的视觉方向。" }, { type: "image_url", image_url: { url: dataUrl } }] }] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "参考封面分析失败");
  return String(payload?.choices?.[0]?.message?.content || "").trim();
}

async function saveGeneratedImage(id, index, source) {
  const folder = safeAssetPath(id);
  await fs.mkdir(folder, { recursive: true });
  const base = path.join(folder, "generated-cover-" + Date.now() + "-" + index);
  if (source?.b64_json) {
    const file = base + ".png";
    await fs.writeFile(file, Buffer.from(source.b64_json, "base64"));
    return { file: path.basename(file), bytes: (await fs.stat(file)).size };
  }
  const remote = source?.url || source?.file_url;
  if (!remote) throw new Error("生图接口未返回图片地址");
  return downloadToFile(remote, base, ".png");
}

async function generateCover(id, body) {
  const config = aiConfig().image;
  if (!config.ready) throw new Error("封面生图尚未配置，请在工作台启动环境中设置 ZHIPU_API_KEY");
  const prompt = String(body.prompt || "").trim();
  if (!prompt) throw new Error("请填写封面提示词");
  const mode = body.mode === "reference" ? "reference" : "text";
  const ratio = String(body.ratio || "3:4");
  let referenceDescription = "";
  if (mode === "reference") referenceDescription = await describeReferenceCover(id);
  const finalPrompt = [prompt, body.style ? "风格偏好：" + body.style : "", referenceDescription ? "参考原封面的视觉方向（只借鉴构图和色彩，不复制文字、Logo、水印、具体人物）：" + referenceDescription : ""].filter(Boolean).join("\n");
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ZHIPU_API_KEY },
    body: JSON.stringify({ model: config.model, prompt: finalPrompt, size: imageSizeForRatio(ratio), n: Math.max(1, Math.min(Number(body.count) || 1, 4)), response_format: "url" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "封面生成请求失败");
  const images = await Promise.all((payload.data || []).map((entry, index) => saveGeneratedImage(id, index + 1, entry)));
  if (!images.length) throw new Error("封面生成接口未返回图片");
  const manifest = (await readManifest(id)) || { id, title: "未命名内容", assets: {} };
  manifest.generated_covers ||= [];
  const task = { id: "cover-" + Date.now(), mode, ratio, prompt, style: body.style || "", reference_description: referenceDescription, images, created_at: new Date().toISOString(), model: config.model };
  manifest.generated_covers.unshift(task);
  await writeManifest(id, manifest);
  return task;
}

async function transcribeWithDoubao(id) {
  const manifest = await readManifest(id);
  if (!manifest?.assets?.audio?.file) throw new Error("请先下载视频并提取音频");
  const config = doubaoConfig();
  if (!config.ready) throw new Error("豆包转写尚未配置：需要 DOUBAO_ASR_API_KEY 和 DOUBAO_ASR_PUBLIC_BASE_URL");
  const requestId = randomUUID();
  const audioUrl = publicAudioUrl(id, manifest.assets.audio.file);
  const headers = { "Content-Type": "application/json", "X-Api-Key": process.env.DOUBAO_ASR_API_KEY, "X-Api-Resource-Id": config.resource_id, "X-Api-Request-Id": requestId, "X-Api-Sequence": "-1" };
  const submit = await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit", { method: "POST", headers, body: JSON.stringify({ user: { uid: "content-workbench" }, audio: { format: "mp3", url: audioUrl, language: "zh-CN" }, request: { model_name: "bigmodel", enable_itn: true, enable_punc: true, enable_ddc: true, show_utterances: true } }) });
  if (!submit.ok || submit.headers.get("x-api-status-code") !== "20000000") throw new Error(submit.headers.get("x-api-message") || "豆包未接受转写任务");
  manifest.transcription = { status: "submitted", request_id: requestId, audio_url: audioUrl, submitted_at: new Date().toISOString() };
  await writeManifest(id, manifest);
  return { status: "submitted", request_id: requestId, audio_url: audioUrl };
}

async function transcriptionStatus(id) {
  const manifest = await readManifest(id);
  if (!manifest?.transcription?.request_id) return { status: "not_started" };
  if (manifest.transcription.status === "completed") return manifest.transcription;
  const config = doubaoConfig();
  if (!config.ready) return manifest.transcription;
  const response = await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/query", { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": process.env.DOUBAO_ASR_API_KEY, "X-Api-Resource-Id": config.resource_id, "X-Api-Request-Id": manifest.transcription.request_id }, body: "{}" });
  const payload = await response.json().catch(() => ({}));
  const statusCode = response.headers.get("x-api-status-code");
  if (statusCode === "20000000" && payload?.result?.text) {
    manifest.transcription = { ...manifest.transcription, status: "completed", text: payload.result.text, utterances: payload.result.utterances || [], completed_at: new Date().toISOString() };
    await fs.writeFile(path.join(safeAssetPath(id), "transcript.txt"), payload.result.text, "utf8");
    await fs.writeFile(path.join(safeAssetPath(id), "transcript.json"), JSON.stringify(payload, null, 2), "utf8");
    await writeManifest(id, manifest);
  } else if (statusCode && statusCode !== "20000001" && statusCode !== "20000002") {
    manifest.transcription = { ...manifest.transcription, status: "failed", error: response.headers.get("x-api-message") || "豆包转写失败" };
    await writeManifest(id, manifest);
  }
  return manifest.transcription;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  try {
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/public-audio/")) {
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (parts.length !== 4 || !publicAudioToken || parts[1] !== publicAudioToken) return reply(response, 404, { detail: "Not found" });
      const filePath = safeAssetPath(path.join(parts[2], parts[3]));
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || !/^audio\//.test(mimeFor(filePath))) return reply(response, 404, { detail: "Not found" });
      response.writeHead(200, { "Content-Type": mimeFor(filePath), "Content-Length": stat.size, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      if (request.method === "HEAD") return response.end();
      createReadStream(filePath).pipe(response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/bridge/files") return reply(response, 200, { files: await listJsonlFiles() });
    if (request.method === "GET" && url.pathname === "/bridge/preview") {
      const fullPath = resolveFile(url.searchParams.get("path"));
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 30, 1000));
      const lines = (await fs.readFile(fullPath, "utf8")).split(/\r?\n/).filter(Boolean);
      const data = lines.slice(0, limit).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
      return reply(response, 200, { data, total: lines.length });
    }
    if (request.method === "GET" && url.pathname === "/bridge/status") return reply(response, 200, { asset_root: assetRoot, ffmpeg_ready: Boolean(await findFfmpeg()), doubao: doubaoConfig(), ai: aiConfig() });
    if (request.method === "GET" && url.pathname === "/bridge/assets") {
      const id = assetId(url.searchParams.get("record_id"));
      const manifest = await readManifest(id);
      return reply(response, 200, { id, manifest, folder: manifest ? safeAssetPath(id) : null });
    }
    if (request.method === "GET" && url.pathname === "/bridge/asset") {
      const filePath = safeAssetPath(url.searchParams.get("path"));
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw new Error("Asset not found");
      response.writeHead(200, { "Content-Type": mimeFor(filePath), "Content-Length": stat.size, "Cache-Control": "no-store" });
      createReadStream(filePath).pipe(response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/bridge/media/download") {
      const body = await readBody(request);
      return reply(response, 200, { manifest: await downloadAssets(body.record || {}) });
    }
    if (request.method === "GET" && url.pathname === "/bridge/media/batch/status") return reply(response, 200, batchJob);
    if (request.method === "POST" && url.pathname === "/bridge/media/batch") {
      if (batchJob.status === "running") return reply(response, 202, batchJob);
      runBatchDownload().catch((error) => {
        batchJob.status = "failed";
        batchJob.errors.push(error instanceof Error ? error.message : String(error));
        batchJob.finished_at = new Date().toISOString();
      });
      return reply(response, 202, batchJob);
    }
    if (request.method === "POST" && url.pathname === "/bridge/asr/transcribe") {
      const body = await readBody(request);
      return reply(response, 200, await transcribeWithDoubao(assetId(body.record_id)));
    }
    if (request.method === "GET" && url.pathname === "/bridge/asr/status") return reply(response, 200, await transcriptionStatus(assetId(url.searchParams.get("record_id"))));
    if (request.method === "POST" && url.pathname === "/bridge/rewrite") {
      const body = await readBody(request);
      return reply(response, 200, await rewriteWithDeepSeek(assetId(body.record_id), body));
    }
    if (request.method === "POST" && url.pathname === "/bridge/cover/generate") {
      const body = await readBody(request);
      return reply(response, 200, await generateCover(assetId(body.record_id), body));
    }
    return reply(response, 404, { detail: "Not found" });
  } catch (error) {
    return reply(response, 400, { detail: error instanceof Error ? error.message : "Bridge error" });
  }
});

server.listen(port, "127.0.0.1", () => console.log("Content sync bridge listening on http://127.0.0.1:" + port));
