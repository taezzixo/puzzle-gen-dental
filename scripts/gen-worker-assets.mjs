// 빌드된 화면(dist)을 Worker 코드 안에 포함시키는 모듈(worker/assets.gen.js)을 생성합니다.
// Worker 한 개로 화면 + 저장 API를 함께 배포하기 위함 (npm run cf:deploy 에서 자동 실행).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const TEXT = new Set([".html", ".js", ".css", ".svg", ".json", ".txt"]);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}

const files = await walk(dist).catch(() => { console.error("dist 폴더가 없습니다. 먼저 npm run build 를 실행하세요."); process.exit(1); });
let src = "// 자동 생성 파일 — 직접 수정하지 마세요 (scripts/gen-worker-assets.mjs)\nexport default {\n";
let total = 0;
for (const f of files.sort()) {
  const ext = path.extname(f);
  const url = "/" + path.relative(dist, f).split(path.sep).join("/");
  const buf = await fs.readFile(f);
  total += buf.length;
  const body = TEXT.has(ext) ? `text: ${JSON.stringify(buf.toString("utf8"))}` : `b64: ${JSON.stringify(buf.toString("base64"))}`;
  src += `  ${JSON.stringify(url)}: { type: ${JSON.stringify(TYPES[ext] || "application/octet-stream")}, immutable: ${url.startsWith("/assets/")}, ${body} },\n`;
}
src += "};\n";
await fs.writeFile(path.join(root, "worker", "assets.gen.js"), src);
console.log(`worker/assets.gen.js 생성 — 파일 ${files.length}개, ${(total / 1024).toFixed(0)} KB`);
