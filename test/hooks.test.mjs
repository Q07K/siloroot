import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, findFreePort } from '../lib/config.mjs';
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
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 제안\n---\n\n# 사용자 정보 후보\n');
  assert.equal(run('notify.mjs', root, ['--session']), '');
});
