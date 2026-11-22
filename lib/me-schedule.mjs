// "나" 화면 AI 코멘트를 언제 갱신할지. 훅(viewer/notify.mjs)과 빌더(viewer/build.mjs)가 같이 쓴다.
// 갱신 방식: 매일 이 시각이 지난 뒤 처음 여는 Claude Code 세션에서, 코멘트 파일이 그 시각보다 오래됐으면 갱신을 알린다.
// 코멘트 파일은 사용자 정보 폴더(기본 05-profile)의 ai-comment.md. 쓰는 법은 /siloroot:feedback F 절차.

export const AI_COMMENT_FILE = 'ai-comment.md';
export const AI_COMMENT_HOUR = 9; // 매일 9시

// now 기준으로 가장 최근에 지난 갱신 시각 (로컬 시간)
export function lastSlot(now = new Date()) {
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), AI_COMMENT_HOUR, 0, 0, 0);
  if (now < s) s.setDate(s.getDate() - 1);
  return s;
}

// 코멘트를 마지막으로 고친 시각(ms, 없으면 0)이 가장 최근 갱신 시각보다 이르면 갱신할 차례
export const commentDue = (mtimeMs, now = new Date()) => !mtimeMs || mtimeMs < lastSlot(now).getTime();
