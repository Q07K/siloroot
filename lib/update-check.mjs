// 세션 시작 알림(viewer/notify.mjs --session)에 붙일 업데이트 안내. 설정과 플러그인 버전만 보고, 작업 공간 파일은 읽지 않는다.
import { SCHEMA, pluginVersion } from './config.mjs';
import { pendingMigrations } from './migrations/index.mjs';

// 알릴 줄. 없으면 []
export function updateNotice(cfg) {
  const lines = [];
  // hold: 사용자가 그 모양까지는 올리지 않기로 했다. 더 새 모양이 나오면 다시 알린다
  if (cfg.schema < SCHEMA && !(cfg.hold != null && SCHEMA <= cfg.hold)) {
    const titles = pendingMigrations(cfg.schema, SCHEMA).map((m) => m.title).join(', ');
    lines.push(`작업 공간 모양 ${cfg.schema} → ${SCHEMA}: ${titles}`);
  }
  const version = pluginVersion();
  if (cfg.plugin !== version) lines.push(`규칙 블록과 안내 문서를 ${version}에 맞출 수 있습니다`);
  return lines;
}
