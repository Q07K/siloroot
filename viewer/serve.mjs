#!/usr/bin/env node
// SiloRoot 뷰어를 이 PC 안에서만 열어 보는 작은 서버. 127.0.0.1에만 붙는다.
// - 새로 고칠 때마다 뷰어를 다시 만든다. 이전 상태는 그대로 두어서 "최근 바뀐 것"이 쌓인다.
// - 화면의 "다 확인했어요"를 누르면 지금 상태를 이전 상태로 저장한다.
// - 화면에서 댓글(피드백)을 남기고, 문서를 고치고, 규칙 후보를 승인할 수 있다. 쓰는 곳은 아래 safePath가 정한다.
// 실행: node viewer/serve.mjs <프로젝트 폴더>  →  http://127.0.0.1:<설정의 port>
// GET /health 는 { siloroot: true, root, viewers } 를 돌려준다. 훅이 이 포트가 내 폴더의 서버인지,
// 뷰어 화면이 이미 열려 있는지(viewers: /events에 붙은 화면 수) 확인할 때 쓴다.
// 화면을 찍으려고 띄운 headless 브라우저는 사람이 보는 화면이 아니므로 viewers에 세지 않는다.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { summarize } from './diff.mjs';
import { loadConfig, DEFAULT_DIRS } from '../lib/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argOf = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const posArg = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')));
if (argOf('--root') || posArg) process.env.VIEWER_ROOT = argOf('--root') || posArg;
if (argOf('--port')) process.env.PORT = argOf('--port');
const ROOT = path.resolve(process.env.VIEWER_ROOT || process.cwd());
const CFG = loadConfig(ROOT) || { port: 4180, docsRoot: ROOT, dirs: { ...DEFAULT_DIRS }, stateDir: path.join(ROOT, '.siloroot', 'state') };
// ROOT는 프로젝트 폴더(빌드 인자, /health). 문서를 읽고 쓰는 기준은 DOCS다. 감싼 배치면 프로젝트의 .siloroot/.
const DOCS = CFG.docsRoot;
const HTML = path.join(CFG.stateDir, 'viewer-private.html');
const EDIT_LOG = path.join(CFG.stateDir, 'web-edits.jsonl');
const FB_REL = CFG.dirs.feedback;
const FEEDBACK_DIR = path.join(DOCS, FB_REL);
const inDocs = (full) => full.startsWith(DOCS + path.sep) && !(full + path.sep).startsWith(CFG.stateDir + path.sep);
const PORT = Number(argOf('--port') || (loadConfig(ROOT) ? CFG.port : process.env.PORT) || 4180);
const STATUS = {
  feedback: ['대기', '진행 중', '완료', '안 함'],
  rule: ['제안', '승인', '거절', '반영'],
};
const KINDS = ['표현', '내용', '구조', '기타'];

const build = (extra) => execFileSync(process.execPath, [path.join(here, 'build.mjs'), ROOT, ...extra], {
  cwd: ROOT, stdio: 'ignore', windowsHide: true, env: { ...process.env, VIEWER_ROOT: ROOT }, // 창 없는 서버의 자식이 콘솔 창을 띄우지 않게
});
const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const norm = (t) => t.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// 웹에서 쓸 수 있는 파일: 폴더 안의 .md, 원본 자료와 설정, 생성물은 제외
function safePath(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 400) return null;
  const clean = path.posix.normalize(rel.replace(/\\/g, '/'));
  if (clean.startsWith('..') || clean.startsWith('/') || !/\.md$/i.test(clean)) return null;
  if (clean.split('/').some((seg) => seg.startsWith('.') || seg.startsWith('_'))) return null;
  const full = path.resolve(DOCS, clean);
  if (!inDocs(full)) return null;
  return { rel: clean, full };
}

// 문서에 넣은 그림만 내준다: 폴더 안의 그림 파일, 원본 자료와 설정 폴더는 제외
const IMAGE_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
function safeImage(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 400) return null;
  const clean = path.posix.normalize(rel.replace(/\\/g, '/'));
  const type = IMAGE_TYPES[path.posix.extname(clean).toLowerCase()];
  if (!type || clean.startsWith('..') || clean.startsWith('/')) return null;
  if (clean.split('/').some((seg) => seg.startsWith('.') || seg.startsWith('_'))) return null;
  const full = path.resolve(DOCS, clean);
  if (!inDocs(full) || !fs.existsSync(full)) return null;
  return { full, type };
}

// 문서가 바뀌면 열려 있는 화면에 알린다 (Server-Sent Events). 여러 번 연달아 저장해도 한 번에 묶어 보낸다.
// 연결 그래프는 알림을 받으면 /data로 최신 데이터를 받아 점과 선만 고친다.
const clients = new Set();
let pending = new Set(), timer = null;
function onChange(rel) {
  if (!rel) return;
  const p = rel.split(path.sep).join('/');
  if (p.split('/').some((seg) => seg.startsWith('.') || seg.startsWith('_') || seg === 'node_modules')) return;
  if (!/\.(md|svg|png|jpe?g|gif|webp)$/i.test(p)) return;
  if (!inDocs(path.join(DOCS, rel))) return; // 뷰어 생성물(state)은 알리지 않는다
  pending.add(p);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const msg = 'data: ' + JSON.stringify({ paths: [...pending] }) + '\n\n';
    pending = new Set();
    for (const res of clients) res.write(msg);
  }, 400);
}
try { fs.watch(DOCS, { recursive: true }, (_e, f) => onChange(f)); } catch (e) { console.error('파일 감시를 시작하지 못했습니다:', e.message); }
setInterval(() => { for (const res of clients) res.write(': keep-alive\n\n'); }, 25000);

// 다른 사이트가 이 서버로 요청을 보내지 못하게: 같은 주소에서 온 JSON 요청만 받는다
function trusted(req) {
  const origin = req.headers.origin || '';
  const okOrigin = origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`;
  const okType = (req.headers['content-type'] || '').startsWith('application/json');
  return okOrigin && okType;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 2 * 1024 * 1024) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function setStatus(text, status, note) {
  let out = text.replace(/^(---\n[\s\S]*?^)status:.*$/m, `$1status: ${status}`);
  if (note) {
    const line = `- ${today()} ${status}: ${note.replace(/\s+/g, ' ').trim()}`;
    out = /^## 메모\s*$/m.test(out) ? out.replace(/(^## 메모\s*\n)/m, `$1${line}\n`) : out.replace(/\s*$/, '\n\n## 메모\n\n' + line + '\n');
  }
  return out;
}

function nextFeedbackPath() {
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  const day = today();
  const used = fs.readdirSync(FEEDBACK_DIR).filter((f) => f.startsWith(day + '-')).length;
  for (let n = used + 1; ; n++) {
    const name = `${day}-${String(n).padStart(3, '0')}.md`;
    if (!fs.existsSync(path.join(FEEDBACK_DIR, name))) return { rel: FB_REL + '/' + name, full: path.join(FEEDBACK_DIR, name) };
  }
}

async function api(req, res) {
  if (!trusted(req)) return send(res, 403, { error: '이 화면에서 보낸 요청만 받습니다.' });
  const body = await readBody(req);

  if (req.url === '/api/feedback') {
    const target = safePath(body.target);
    const text = String(body.body || '').trim();
    if (!target || !fs.existsSync(target.full)) return send(res, 400, { error: '대상 문서를 찾지 못했습니다.' });
    if (!text) return send(res, 400, { error: '댓글을 적어 주세요.' });
    const quote = String(body.quote || '').trim().slice(0, 600);
    const out = nextFeedbackPath();
    const md = [
      '---', 'type: feedback', 'status: 대기', `created: ${today()}`, `related: [${target.rel}]`, '---', '',
      `# 피드백: ${target.rel}`, '',
      ...(quote ? ['## 고른 부분', '', ...quote.split('\n').map((l) => '> ' + l), ''] : []),
      '## 댓글', '', text, '',
      '## 처리', '', '(AI가 처리하면 무엇을 왜 어떻게 바꿨는지 여기에 적는다)', '',
    ].join('\n');
    fs.writeFileSync(out.full, md);
    return send(res, 200, { ok: true, path: out.rel });
  }

  if (req.url === '/api/status') {
    const p = safePath(body.path);
    if (!p || !p.rel.startsWith(FB_REL + '/') || !fs.existsSync(p.full)) return send(res, 400, { error: '피드백 파일만 상태를 바꿀 수 있습니다.' });
    const text = norm(fs.readFileSync(p.full, 'utf8'));
    const type = (text.match(/^type:\s*(\S+)/m) || [])[1];
    if (!STATUS[type] || !STATUS[type].includes(body.status)) return send(res, 400, { error: '쓸 수 없는 상태입니다.' });
    fs.writeFileSync(p.full, setStatus(text, body.status, body.note ? String(body.note).slice(0, 500) : ''));
    return send(res, 200, { ok: true });
  }

  if (req.url === '/api/save') {
    const p = safePath(body.path);
    if (!p || !fs.existsSync(p.full)) return send(res, 400, { error: '고칠 수 없는 문서입니다.' });
    if (typeof body.text !== 'string') return send(res, 400, { error: '내용이 없습니다.' });
    const raw = fs.readFileSync(p.full, 'utf8');
    const before = norm(raw);
    if (body.hash && body.hash !== sha(before)) return send(res, 409, { error: '그 사이 이 문서가 바뀌었습니다. 새로 고친 뒤 다시 고쳐 주세요.' });
    const after = norm(body.text);
    if (after === before) return send(res, 200, { ok: true, unchanged: true });
    const crlf = raw.includes('\r\n'), bom = raw.startsWith('﻿');
    fs.writeFileSync(p.full, (bom ? '﻿' : '') + (crlf ? after.replace(/\n/g, '\r\n') : after));
    const s = summarize(before, after);
    const entry = {
      id: 'e-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + crypto.randomBytes(2).toString('hex'),
      at: new Date().toISOString(),
      path: p.rel,
      kind: KINDS.includes(body.kind) ? body.kind : '기타',
      reason: String(body.reason || '').trim().slice(0, 500),
      plus: s.plus, minus: s.minus, diff: s.diff,
    };
    fs.mkdirSync(path.dirname(EDIT_LOG), { recursive: true });
    fs.appendFileSync(EDIT_LOG, JSON.stringify(entry) + '\n');
    return send(res, 200, { ok: true, id: entry.id });
  }

  if (req.url === '/api/seen') {
    if (body.path === undefined) { build(['--seen']); return send(res, 200, { ok: true }); }
    // 문서 하나만 확인: 지운 문서도 받으므로 파일이 있는지는 보지 않고 경로 모양만 확인한다
    const p = safePath(body.path);
    if (!p) return send(res, 400, { error: '확인할 수 없는 경로입니다.' });
    build(['--seen-path', p.rel]);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: '없는 요청입니다.' });
}

// 다른 도메인 이름을 127.0.0.1로 돌려 문서를 읽어 가지 못하게(DNS 리바인딩): 이 주소로 온 요청만 받는다
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

http.createServer(async (req, res) => {
  try {
    if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); res.end(); return; }
    if (req.method === 'POST' && req.url.startsWith('/api/')) return await api(req, res);
    if (req.method === 'GET' && req.url.startsWith('/file?')) {
      const img = safeImage(new URL(req.url, 'http://x').searchParams.get('path'));
      if (!img) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': img.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
      res.end(fs.readFileSync(img.full)); return;
    }
    // 연결 그래프가 새로 고침 없이 새 문서를 넣고 뺄 때 쓰는 최신 데이터. 비교 기준은 건드리지 않는다.
    if (req.method === 'GET' && req.url === '/data') {
      build(['--keep-snapshot', '--data-only']);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(path.join(CFG.stateDir, 'data-private.json'))); return;
    }
    if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': connected\n\n');
      res.headless = /Headless/i.test(req.headers['user-agent'] || '');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      const viewers = [...clients].filter((c) => !c.headless).length;
      return send(res, 200, { siloroot: true, root: ROOT, viewers });
    }
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
      build(['--keep-snapshot']);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(HTML)); return;
    }
    res.writeHead(404); res.end();
  } catch (e) {
    if (!res.headersSent) send(res, 500, { error: '처리하지 못했습니다: ' + e.message });
  }
}).listen(PORT, '127.0.0.1', () => console.log('SiloRoot 뷰어: http://127.0.0.1:' + PORT + ' (폴더: ' + ROOT + ')'));
