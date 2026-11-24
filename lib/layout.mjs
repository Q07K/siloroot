// 작업 공간의 자리표. 역할(공부 노트, 결정, 뷰어 댓글 ...)마다 문서가 있는 경로를 낸다.
// 스크립트, 뷰어, 훅은 폴더 이름을 직접 쓰지 않고 이 표를 본다. 모양(schema)과 종류(mode)에 따라 표가 다르다.
// - 경로는 문서 뿌리(docsRoot) 기준이고 '/'로 잇는다. 폴더는 끝 '/' 없이, 파일은 '.md'까지 적는다.
// - 다른 작업 공간에 있는 자리는 'home:' 접두사를 붙인다. 이 작업 공간에 없는 역할은 null이다.

// 역할 이름. 스킬과 관리 블록이 사람에게 보일 때 쓴다
export const ROLE_LABELS = Object.freeze({
  log: '작업 기록', study: '공부 노트', issues: '이슈', ideas: '제품 아이디어', personalIdeas: '개인 아이디어',
  decisions: '결정', design: '설계', roadmap: '로드맵', conventions: '컨벤션', sources: '원자료', notes: '프로젝트 메모',
  discussions: '논의', feedback: '뷰어 댓글', candidates: '후보', profile: '사용자 정보', aiComment: '"나" 코멘트', writingGuide: '글쓰기 규칙',
});

const isV3 = (cfg) => (cfg.schema ?? 0) >= 3;
const isHome = (cfg) => isV3(cfg) && cfg.mode === 'home';
const allNull = () => Object.fromEntries(Object.keys(ROLE_LABELS).map((k) => [k, null]));

export function placesOf(cfg) {
  const p = allNull();
  if (isHome(cfg)) {
    return Object.assign(p, {
      log: 'log', study: 'study', personalIdeas: 'ideas', feedback: 'feedback', candidates: 'feedback',
      profile: 'profile.md', aiComment: 'ai-comment.md', writingGuide: 'writing-guide.md',
    });
  }
  if (isV3(cfg)) {
    return Object.assign(p, {
      log: 'private/log', study: 'home:study', issues: 'shared/issues', ideas: 'shared/ideas', personalIdeas: 'home:ideas',
      decisions: 'shared/decisions', design: 'shared/design', roadmap: 'shared/roadmap', conventions: 'shared/conventions',
      sources: 'private/sources', notes: 'private/notes', discussions: 'private/discussions',
      feedback: 'private/feedback', candidates: 'home:feedback',
      profile: 'home:profile.md', aiComment: 'home:ai-comment.md', writingGuide: 'home:writing-guide.md',
    });
  }
  const d = cfg.dirs;
  return Object.assign(p, {
    log: d.log, study: d.study, ideas: d.ideas, decisions: d.ideas, feedback: d.feedback, candidates: d.feedback,
    profile: `${d.profile}/profile.md`, aiComment: `${d.profile}/ai-comment.md`, writingGuide: 'writing-guide.md',
  });
}

// 이 작업 공간 안의 자리면 그 경로, 다른 작업 공간(home: 등)이나 없는 자리면 null
export const localPlace = (p) => (p && !p.includes(':') ? p : null);

// 폴더마다 들어갈 수 있는 type. 뷰어의 속성 점검이 쓴다. 폴더의 README.md는 목록(index)이라 빠진다
export function folderRules(cfg) {
  const r = (prefix, ...types) => ({ prefix, types });
  if (isHome(cfg)) {
    return [r('study/', 'study'), r('ideas/', 'idea', 'decision', 'design', 'roadmap'), r('feedback/', 'feedback', 'rule', 'trait'), r('log/', 'log', 'ledger')];
  }
  if (isV3(cfg)) {
    return [
      r('shared/issues/', 'issue'), r('shared/ideas/', 'idea'), r('shared/decisions/', 'decision'), r('shared/design/', 'design'),
      r('shared/roadmap/', 'roadmap'), r('shared/conventions/', 'convention'), r('private/sources/', 'source'),
      r('private/notes/', 'note'), r('private/discussions/', 'note'), r('private/feedback/', 'feedback'), r('private/log/', 'log', 'ledger'),
    ];
  }
  const d = cfg.dirs;
  return [r(d.ideas + '/', 'idea', 'decision'), r(d.study + '/', 'study'), r(d.feedback + '/', 'feedback', 'rule', 'trait')];
}

// 뷰어에서 문서를 묶는 이름. 모양 3 프로젝트는 shared/와 private/ 아래를 한 마디 더 나눈다
export function groupOf(rel, cfg) {
  const parts = rel.split('/');
  if (parts.length < 2) return '(맨 위)';
  if (isV3(cfg) && !isHome(cfg) && (parts[0] === 'shared' || parts[0] === 'private') && parts.length >= 3) return parts[0] + '/' + parts[1];
  return parts[0];
}
