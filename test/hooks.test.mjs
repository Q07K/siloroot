import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, updateConfig, loadConfig, findFreePort, pluginVersion } from '../lib/config.mjs';
import { updateNotice } from '../lib/update-check.mjs';
import { userDir, userFile } from '../lib/user.mjs';
import { initProject } from '../scripts/init.mjs';
import { makeProject, write } from './fixtures.mjs';

const V = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer');
const run = (script, root, args = []) => execFileSync(process.execPath, [path.join(V, script), ...args], {
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
});
const listAll = (dir) => fs.readdirSync(dir, { recursive: true }).sort();

test('SiloRoot 폴더가 아니면 두 훅 모두 아무것도 하지 않는다', () => {
  const root = makeProject('그냥 폴더');
  write(root, 'notes.md', '# 메모\n');
  const before = listAll(root);
  assert.equal(run('autostart.mjs', root), '');
  assert.equal(run('notify.mjs', root, ['--session']), '');
  assert.equal(run('notify.mjs', root), '');
  assert.deepEqual(listAll(root), before);
});

test('대기 중인 피드백이 있으면 세션 시작 알림이 [SiloRoot]로 시작한다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/2026-11-22-001.md', '---\ntype: feedback\nstatus: 대기\nrelated: [02-study/a.md]\n---\n\n# 피드백\n');
  const out = JSON.parse(run('notify.mjs', root, ['--session']));
  assert.match(out.hookSpecificOutput.additionalContext, /^\[SiloRoot\]/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
});

test('메시지 알림은 같은 할 일을 두 번 알리지 않는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/2026-11-22-001.md', '---\ntype: feedback\nstatus: 대기\n---\n\n# 피드백\n');
  assert.notEqual(run('notify.mjs', root), '');
  assert.equal(run('notify.mjs', root), '');
});

test('설정 포트를 다른 폴더의 서버가 쓰고 있으면 켜지 않고 알린다', async () => {
  const root = makeProject();
  const port = await findFreePort(4260);
  writeConfig(root, { port });
  const fake = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ siloroot: true, root: 'C:\\다른 폴더' }));
  });
  await new Promise((r) => fake.listen(port, '127.0.0.1', r));
  try {
    const out = await new Promise((resolve, reject) => {
      import('node:child_process').then(({ execFile }) => execFile(process.execPath, [path.join(V, 'autostart.mjs')], {
        encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
      }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
    });
    assert.match(out, /다른 폴더가 쓰는 중/);
  } finally {
    fake.close();
  }
});

test('승인된 사용자 정보 후보는 profile.md 반영 대기로 알린다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 승인\n---\n\n# 사용자 정보 후보: 결론부터\n');
  const out = JSON.parse(run('notify.mjs', root, ['--session']));
  assert.match(out.hookSpecificOutput.additionalContext, /사용자 정보 후보, 05-profile\/profile\.md 반영 대기: 04-feedback\/trait-2026-11-22-001\.md/);
});

test('제안 상태의 사용자 정보 후보는 알리지 않는다', () => {
  const root = makeProject();
  // 업데이트 알림이 붙지 않게 플러그인 버전을 맞추고 예전 배치에 머물기로 한 작업 공간
  writeConfig(root, { port: 4180, plugin: pluginVersion() }); updateConfig(root, { hold: 3 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 제안\n---\n\n# 사용자 정보 후보\n');
  assert.equal(run('notify.mjs', root, ['--session']), '');
});

// 뷰어 서버를 띄워 두고 autostart가 브라우저를 열지 말지(시험용 stderr 한 줄)를 본다.
async function withServer(fn) {
  const root = makeProject();
  const port = await findFreePort(4270);
  writeConfig(root, { port });
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [path.join(V, 'serve.mjs'), root], { stdio: 'ignore' });
  try {
    const end = Date.now() + 5000;
    for (;;) {
      try { if ((await fetch(base + '/health')).ok) break; } catch { /* 아직 */ }
      if (Date.now() > end) throw new Error('서버가 뜨지 않음');
      await new Promise((r) => setTimeout(r, 100));
    }
    await fn({ root, base });
  } finally {
    child.kill();
  }
}
const decide = (root, source) => spawnSync(process.execPath, [path.join(V, 'autostart.mjs')], {
  encoding: 'utf8',
  input: source ? JSON.stringify({ hook_event_name: 'SessionStart', source }) : '',
  env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
}).stderr.trim();

test('뷰어 화면이 없으면 세션을 시작할 때마다 브라우저를 연다', async () => {
  await withServer(({ root }) => {
    assert.equal(decide(root, 'startup'), 'open:no-viewer');
    assert.equal(decide(root, 'startup'), 'open:no-viewer');
    assert.equal(decide(root, 'resume'), 'open:no-viewer');
  });
});

test('뷰어 화면이 이미 열려 있으면 브라우저를 다시 열지 않는다', async () => {
  await withServer(async ({ root, base }) => {
    const ac = new AbortController();
    const res = await fetch(base + '/events', { signal: ac.signal });
    await res.body.getReader().read();
    try {
      assert.equal((await (await fetch(base + '/health')).json()).viewers, 1);
      assert.equal(decide(root, 'startup'), 'skip:already-open');
    } finally {
      ac.abort();
    }
  });
});

test('화면을 찍으려고 띄운 headless 브라우저는 열린 화면으로 세지 않는다', async () => {
  await withServer(async ({ root, base }) => {
    const ac = new AbortController();
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36 Edg/158.0.0.0';
    const res = await fetch(base + '/events', { signal: ac.signal, headers: { 'user-agent': ua } });
    await res.body.getReader().read();
    try {
      assert.equal((await (await fetch(base + '/health')).json()).viewers, 0);
      assert.equal(decide(root, 'startup'), 'open:no-viewer');
    } finally {
      ac.abort();
    }
  });
});

// 예전 버전 뷰어 서버를 흉내 낸다. health는 /health 응답에 더할 값(version, pid). 따로 띄운 프로세스라
// autostart가 꺼도 시험 프로세스는 남는다.
async function fakeServer(root, port, health) {
  const script = write(root, '_fake-serve.mjs', `
import http from 'node:http';
const extra = ${JSON.stringify(health)};
if (extra.pid === 'self') extra.pid = process.pid;
http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ siloroot: true, root: ${JSON.stringify(path.resolve(root))}, viewers: 0, ...extra }));
}).listen(${port}, '127.0.0.1');
`);
  const child = spawn(process.execPath, [script], { stdio: 'ignore' });
  const end = Date.now() + 5000;
  for (;;) {
    try { if ((await fetch('http://127.0.0.1:' + port + '/health')).ok) return child; } catch { /* 아직 */ }
    if (Date.now() > end) { child.kill(); throw new Error('가짜 서버가 뜨지 않음'); }
    await new Promise((r) => setTimeout(r, 100));
  }
}
const exited = (child) => child.exitCode !== null || child.signalCode !== null;
const waitExit = (child, ms = 5000) => (exited(child) ? Promise.resolve(true)
  : new Promise((r) => { const t = setTimeout(() => r(false), ms); child.once('exit', () => { clearTimeout(t); r(true); }); }));
const decideAsync = (root) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(V, 'autostart.mjs')], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
  });
  let err = '';
  p.stdout.resume();
  p.stderr.on('data', (c) => { err += c; });
  p.stdin.end(JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }));
  p.on('close', () => resolve(err.trim()));
});
// autostart가 새로 띄운 서버를 /health의 pid로 끈다.
async function killServerOn(port) {
  try { process.kill((await (await fetch('http://127.0.0.1:' + port + '/health')).json()).pid); } catch { /* 없음 */ }
}

for (const [name, health] of [
  ['버전과 pid를 알려 주는 옛 서버', { version: '0.0.1', pid: 'self' }],
  ['버전을 알려 주지 않는 옛 서버', {}],
]) {
  test(`${name}가 떠 있으면 끄고 지금 버전 서버를 새로 띄운다`, async () => {
    const root = makeProject();
    const port = await findFreePort(4290);
    writeConfig(root, { port });
    const old = await fakeServer(root, port, health);
    try {
      assert.equal(await decideAsync(root), 'open:no-viewer');
      assert.equal(await waitExit(old), true, '옛 서버가 꺼지지 않음');
      const j = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
      assert.equal(j.version, pluginVersion());
    } finally {
      old.kill();
      await killServerOn(port);
    }
  });
}

test('옛 서버를 바꿨는데 화면이 다시 붙으면 새로고침하라고 알린다', async () => {
  const root = makeProject();
  const port = await findFreePort(4290);
  writeConfig(root, { port });
  const base = 'http://127.0.0.1:' + port;
  const old = await fakeServer(root, port, { version: '0.5.1', pid: 'self' });
  const ac = new AbortController();
  try {
    const p = spawn(process.execPath, [path.join(V, 'autostart.mjs')], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
    });
    let out = '', err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.stdin.end(JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }));
    const closed = new Promise((r) => p.on('close', r));
    // 새 서버가 뜨면 열려 있던 화면처럼 /events에 붙는다
    const end = Date.now() + 8000;
    for (;;) {
      try { if ((await (await fetch(base + '/health')).json()).version === pluginVersion()) break; } catch { /* 아직 */ }
      if (Date.now() > end) throw new Error('새 서버가 뜨지 않음');
      await new Promise((r) => setTimeout(r, 100));
    }
    await (await fetch(base + '/events', { signal: ac.signal })).body.getReader().read();
    await closed;
    assert.equal(err.trim(), 'skip:already-open');
    assert.match(out, /새로고침/);
  } finally {
    ac.abort();
    old.kill();
    await killServerOn(port);
  }
});

test('지금 버전보다 새 서버가 떠 있으면 그대로 둔다', async () => {
  const root = makeProject();
  const port = await findFreePort(4280);
  writeConfig(root, { port });
  const newer = await fakeServer(root, port, { version: '999.0.0', pid: 'self' });
  try {
    assert.equal(await decideAsync(root), 'open:no-viewer');
    assert.equal(exited(newer), false);
    assert.equal((await (await fetch('http://127.0.0.1:' + port + '/health')).json()).version, '999.0.0');
  } finally {
    newer.kill();
  }
});

test('대화 압축으로 다시 시작한 세션에서는 브라우저를 열지 않는다', async () => {
  await withServer(({ root }) => {
    assert.equal(decide(root, 'compact'), 'skip:compact');
  });
});

test('AI 코멘트 파일이 9시보다 오래됐으면 세션 시작 때만 갱신을 알린다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '05-profile/ai-comment.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# AI 코멘트\n');
  const old = new Date(Date.now() - 3 * 86400000);
  fs.utimesSync(path.join(root, '05-profile/ai-comment.md'), old, old);
  const out = JSON.parse(run('notify.mjs', root, ['--session']));
  assert.match(out.hookSpecificOutput.additionalContext, /AI 코멘트 갱신 차례/);
  assert.equal(run('notify.mjs', root), '');
});

test('AI 코멘트를 방금 고쳤거나 파일이 없으면 알리지 않는다', () => {
  const root = makeProject();
  // 업데이트 알림이 붙지 않게 플러그인 버전을 맞추고 예전 배치에 머물기로 한 작업 공간
  writeConfig(root, { port: 4180, plugin: pluginVersion() }); updateConfig(root, { hold: 3 });
  assert.equal(run('notify.mjs', root, ['--session']), '');
  write(root, '05-profile/ai-comment.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# AI 코멘트\n');
  // 9시 전에 방금 고친 파일은 다음 9시까지 갱신 차례가 아니고, 9시 뒤에 고친 파일도 그날은 아니다
  assert.equal(run('notify.mjs', root, ['--session']), '');
});

test('뒤처진 작업 공간은 세션 시작에만 업데이트를 알린다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180 }); // flat, schema 1
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  assert.match(ctx, /업데이트할 것이 있습니다/);
  assert.match(ctx, /작업 공간 모양 1 → 3: 문서를 \.siloroot\/ 안으로 감싼다/);
  assert.match(ctx, new RegExp('규칙 블록과 안내 문서를 ' + pluginVersion().replace(/\./g, '\.') + '에 맞출 수 있습니다'));
  assert.doesNotMatch(run('notify.mjs', root), /업데이트할 것/);
});

test('업데이트 알림은 처리할 일 앞에 따로 붙는다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180 });
  write(root, '04-feedback/2026-11-22-001.md', '---\ntype: feedback\nstatus: 대기\n---\n\n# 피드백\n');
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  assert.ok(ctx.indexOf('업데이트할 것이 있습니다') < ctx.indexOf('처리할 일이 있습니다'));
});

test('hold가 SCHEMA 이상이면 모양 알림을 끄고 맞추기 알림만 남긴다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180 });
  updateConfig(root, { hold: 3, plugin: '0.0.1' });
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  assert.doesNotMatch(ctx, /작업 공간 모양/);
  assert.match(ctx, /규칙 블록과 안내 문서를/);
  assert.deepEqual(updateNotice({ ...loadConfig(root), plugin: pluginVersion() }), []);
});

test('머물기로 한 모양 2 작업 공간은 업데이트 알림이 없다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180, layout: 'wrapped', schema: 2, plugin: pluginVersion() }); updateConfig(root, { hold: 3 });
  assert.equal(run('notify.mjs', root, ['--session']), '');
});

// ---- 모양 3: 홈의 후보와 홈 뷰어 ----
const HOME = () => path.join(userDir(), 'siloroot-home');
const v3Project = async () => {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject();
  await initProject(root, { home: HOME() });
  return root;
};
const slashed = (p) => p.split(path.sep).join('/');

test('모양 3 프로젝트 세션은 홈의 승인된 사용자 정보 후보를 알린다', async () => {
  const root = await v3Project();
  write(HOME(), 'feedback/trait-2026-11-24-001.md', '---\ntype: trait\nstatus: 승인\n---\n\n# 사용자 정보 후보\n');
  write(HOME(), 'feedback/rule-2026-11-24-001.md', '---\ntype: rule\nstatus: 승인\n---\n\n# 규칙 후보\n');
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  const h = slashed(HOME());
  assert.ok(ctx.includes(h + '/profile.md 반영 대기: ' + h + '/feedback/trait-2026-11-24-001.md'), ctx);
  assert.ok(ctx.includes(h + '/writing-guide.md 반영 대기: ' + h + '/feedback/rule-2026-11-24-001.md'), ctx);
});

test('모양 3 프로젝트의 AI 코멘트 갱신 알림은 홈의 ai-comment.md를 본다', async () => {
  const root = await v3Project();
  const f = write(HOME(), 'ai-comment.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# 코멘트\n');
  const old = new Date(Date.now() - 3 * 86400000); fs.utimesSync(f, old, old);
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes(slashed(HOME()) + '/ai-comment.md'), ctx);
});

test('user.json이 깨져도 notify는 프로젝트 할 일만 알리고 끝난다', async () => {
  const root = await v3Project();
  write(root, '.siloroot/private/feedback/2026-11-24-001.md', '---\ntype: feedback\nstatus: 대기\nrelated: [shared/README.md]\n---\n\n# 피드백\n');
  write(HOME(), 'feedback/trait-2026-11-24-001.md', '---\ntype: trait\nstatus: 승인\n---\n\n# 후보\n');
  fs.writeFileSync(userFile(), '{ 깨짐');
  const ctx = JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext;
  assert.match(ctx, /피드백 대기: \.siloroot\/private\/feedback\/2026-11-24-001\.md \(대상 \.siloroot\/shared\/README\.md\)/);
  assert.doesNotMatch(ctx, /trait/);
});

test('autostart는 모양 3 프로젝트에서 홈 뷰어도 켠다', async () => {
  const root = await v3Project();
  const urls = [root, HOME()].map((r) => 'http://127.0.0.1:' + loadConfig(r).port);
  try {
    const r = spawnSync(process.execPath, [path.join(V, 'autostart.mjs')], {
      encoding: 'utf8', input: '', env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
    });
    assert.match(r.stderr, /^home:mine$/m, r.stderr);
    for (const [u, want] of [[urls[0], root], [urls[1], HOME()]]) {
      const j = await (await fetch(u + '/health')).json();
      assert.equal(path.resolve(j.root), path.resolve(want));
    }
  } finally {
    // autostart가 따로 띄운 서버를 끈다. 이 테스트가 만든 폴더의 서버만
    for (const [u, want] of [[urls[0], root], [urls[1], HOME()]]) {
      try { const j = await (await fetch(u + '/health')).json(); if (j.pid && path.resolve(j.root) === path.resolve(want)) process.kill(j.pid); } catch { /* 이미 꺼짐 */ }
    }
  }
});
