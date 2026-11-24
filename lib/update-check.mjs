// 세션 시작 알림(viewer/notify.mjs --session)에 붙일 업데이트 안내. 설정과 플러그인 버전만 보고, 작업 공간 파일은 읽지 않는다.
import { SCHEMA, pluginVersion } from './config.mjs';
import { pendingMigrations } from './migrations/index.mjs';

// 알릴 줄. 없으면 []
export function updateNotice(cfg) {
  const lines = [];
  // 갈 마이그레이션이 없으면(새 모양의 마이그레이션이 아직 없으면) 모양 줄을 넣지 않는다.
  // hold: 사용자가 그 모양까지는 올리지 않기로 했다. 그보다 새 모양으로 가는 마이그레이션이 나오면 다시 알린다
  const pending = pendingMigrations(cfg.schema, SCHEMA);
  if (pending.some((m) => !(cfg.hold != null && m.to <= cfg.hold))) {
    const to = pending[pending.length - 1].to;
    lines.push(`작업 공간 모양 ${cfg.schema} → ${to}: ${pending.map((m) => m.title).join(', ')}`);
  }
  const version = pluginVersion();
  if (cfg.plugin !== version) lines.push(`규칙 블록과 안내 문서를 ${version}에 맞출 수 있습니다`);
  return lines;
}
