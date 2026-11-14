import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site", import.meta.url));
const port = Number(process.argv[2] ?? 4206);
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain" };

createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
    const url = new URL(request.url, "http://127.0.0.1");
    const path = decodeURIComponent(url.pathname);
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) return response.writeHead(404).end();
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    if (request.method === "HEAD") return response.end();
    createReadStream(file).on("error", () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/`));
