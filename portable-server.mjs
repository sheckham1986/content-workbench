import { createServer, request as httpRequest } from "node:http";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url));

async function loadEnv(filename) {
  try {
    const text = await fs.readFile(path.join(root, filename), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function localPath(value, fallback) {
  const selected = value || fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(root, selected);
}

await loadEnv("config.env");
process.env.MEDIACRAWLER_DATA_DIR = localPath(process.env.MEDIACRAWLER_DATA_DIR, "data");
process.env.CONTENT_ASSET_DIR = localPath(process.env.CONTENT_ASSET_DIR, "downloaded-assets");
process.env.FFMPEG_PATH = localPath(process.env.FFMPEG_PATH, path.join("runtime", "ffmpeg.exe"));
process.env.CONTENT_BRIDGE_PORT ||= "4174";

const webPort = Number(process.env.CONTENT_WEB_PORT || 4173);
const webHost = process.env.CONTENT_WEB_HOST || "127.0.0.1";
const allowedOrigins = new Set(
  String(
    process.env.CONTENT_ALLOWED_ORIGINS ||
      "http://127.0.0.1:4173,http://localhost:4173,https://sheckham1986.github.io",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const bridgeTarget = new URL(`http://127.0.0.1:${process.env.CONTENT_BRIDGE_PORT}`);
const crawlerTarget = new URL(process.env.MEDIACRAWLER_API_URL || "http://127.0.0.1:8080");
const appRoot = path.join(root, "app");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

await import("./bridge.mjs");

function proxy(request, response, target) {
  const upstream = httpRequest(
    new URL(request.url || "/", target),
    {
      method: request.method,
      headers: { ...request.headers, host: target.host },
    },
    (incoming) => {
      response.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    if (response.headersSent) return response.end();
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ detail: `后端服务未连接：${error.message}` }));
  });
  request.pipe(upstream);
}

async function serveStatic(request, response) {
  const parsed = new URL(request.url || "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  let filename = path.resolve(appRoot, `.${pathname}`);
  const appPrefix = appRoot + path.sep;
  if (filename !== appRoot && !filename.startsWith(appPrefix)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const stat = await fs.stat(filename);
    if (!stat.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    filename = path.join(appRoot, "index.html");
  }
  const stat = await fs.stat(filename);
  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filename).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": path.basename(filename) === "index.html" ? "no-cache" : "public, max-age=3600",
  });
  if (request.method === "HEAD") return response.end();
  createReadStream(filename).pipe(response);
}

const webServer = createServer(async (request, response) => {
  try {
    const origin = String(request.headers.origin || "");
    if (allowedOrigins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, HEAD, POST, OPTIONS",
      );
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (pathname.startsWith("/bridge/") || pathname.startsWith("/public-audio/")) {
      return proxy(request, response, bridgeTarget);
    }
    if (pathname.startsWith("/api/")) return proxy(request, response, crawlerTarget);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end("Method Not Allowed");
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`内容工作台启动错误：${error instanceof Error ? error.message : String(error)}`);
  }
});

webServer.listen(webPort, webHost, async () => {
  await fs.writeFile(path.join(root, ".content-workbench.pid"), String(process.pid), "utf8");
  const pageUrl = `http://127.0.0.1:${webPort}/`;
  console.log(`内容工作台已启动：${pageUrl}（监听 ${webHost}）`);
  console.log("请保持此窗口打开；关闭窗口会停止内容工作台。");
  if (process.platform === "win32" && process.env.NO_AUTO_OPEN !== "1") {
    const opener = spawn("cmd.exe", ["/d", "/s", "/c", "start", "", pageUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    opener.unref();
  }
});

webServer.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`启动失败：端口 ${webPort} 已被其它程序占用。请关闭占用程序，或修改 config.env 中的 CONTENT_WEB_PORT。`);
  } else {
    console.error(`启动失败：${error instanceof Error ? error.message : String(error)}`);
  }
});

async function shutdown() {
  await fs.rm(path.join(root, ".content-workbench.pid"), { force: true }).catch(() => {});
  webServer.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
