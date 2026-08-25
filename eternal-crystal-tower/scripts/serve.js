import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png" };

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const target = normalize(join(root, relative));
    if (!target.startsWith(root)) throw new Error("Forbidden");
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`永耀晶塔已启动：http://127.0.0.1:${port}`);
});
