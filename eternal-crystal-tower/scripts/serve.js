import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LeaderboardStore } from "./leaderboard-store.js";

const root = normalize(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const leaderboardFile = resolve(process.env.LEADERBOARD_FILE || join(root, "data", "leaderboard.json"));
const leaderboard = new LeaderboardStore(leaderboardFile);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png" };

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error("成绩数据过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/api/leaderboard") {
      if (request.method === "GET") return json(response, 200, { entries: await leaderboard.read() });
      if (request.method === "POST") {
        const result = await leaderboard.submit(await readJsonBody(request));
        return json(response, 201, result);
      }
      response.setHeader("Allow", "GET, POST");
      return json(response, 405, { error: "Method not allowed" });
    }
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const target = normalize(join(root, relative));
    if (!target.startsWith(root)) throw new Error("Forbidden");
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(await readFile(file));
  } catch (error) {
    if (request.url?.startsWith("/api/")) return json(response, 400, { error: error?.message || "请求失败" });
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`永耀晶塔已启动：http://${host}:${port}`);
});
