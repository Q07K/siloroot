// 세션 시작 알림(viewer/notify.mjs --session)에 붙일 업데이트 안내. 설정과 플러그인 버전만 보고, 작업 공간 문서는 읽지 않는다.
// 모양 3 프로젝트는 홈(user.json의 home)의 설정도 본다. 홈은 사람들이 거기서 Claude를 잘 열지 않아 프로젝트 세션에서 같이 알린다.
import { SCHEMA, pluginVersion, loadConfig } from './config.mjs';
import { pendingMigrations } from './migrations/index.mjs';
import { readUser } from './user.mjs';

// 한 작업 공간의 알릴 줄
function linesOf(cfg, label = '') {
  const lines = [];
  // hold: 사용자가 그 모양까지는 올리지 않기로 했다. 그보다 새 모양으로 가는 마이그레이션이 나오면 다시 알린다
  const pending = pendingMigrations(cfg.schema, SCHEMA);
  if (pending.some((m) => !(cfg.hold != null && m.to <= cfg.hold))) {
    const to = pending[pending.length - 1].to;
    lines.push(`${label}작업 공간 모양 ${cfg.schema} → ${to}: ${pending.map((m) => m.title).join(', ')}`);
  }
  const version = pluginVersion();
  if (cfg.plugin !== version) lines.push(`${label}규칙 블록과 안내 문서를 ${version}에 맞출 수 있습니다`);
  return lines;
}

// 알릴 줄. 없으면 []
export function updateNotice(cfg) {
  const lines = linesOf(cfg);
  if ((cfg.schema ?? 0) >= 3 && cfg.mode === 'project') {
    const u = readUser();
    const home = !u.invalid && u.home ? loadConfig(u.home) : null;
    if (home) lines.push(...linesOf(home, `홈(${u.home}): `));
  }
  return lines;
}
