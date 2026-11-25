// 작업 공간의 자리표. 역할(공부 노트, 결정, 뷰어 댓글 ...)마다 문서가 있는 경로를 낸다.
// 스크립트, 뷰어, 훅은 폴더 이름을 직접 쓰지 않고 이 표를 본다. 모양(schema)과 종류(mode)에 따라 표가 다르다.
// - 경로는 문서 뿌리(docsRoot) 기준이고 '/'로 잇는다. 폴더는 끝 '/' 없이, 파일은 '.md'까지 적는다.
// - 다른 작업 공간에 있는 자리는 'home:' 접두사를 붙인다. 이 작업 공간에 없는 역할은 null이다.

// 역할 이름. 스킬과 관리 블록이 사람에게 보일 때 쓴다
export const ROLE_LABELS = Object.freeze({
  log: '작업 기록', study: '공부 노트', issues: '이슈', ideas: '제품 아이디어', personalIdeas: '개인 아이디어',
  decisions: '결정', design: '설계', roadmap: '로드맵', conventions: '컨벤션', sources: '원자료', notes: '프로젝트 메모',
  discussions: '논의', feedback: '뷰어 댓글', candidates: '후보', profile: '사용자 정보', aiComment: '"나" 코멘트', writingGuide: '글쓰기 규칙',
  worklog: '작업 일지', openQuestions: '확인할 것', requirements: '요구사항', plans: '구현 계획', architecture: '시스템 개요', glossary: '용어집',
});

const isV3 = (cfg) => (cfg.schema ?? 0) >= 3;
// 모양 4: 작업 기록(log/changelog.md)을 날짜별 작업 일지(worklog/)와 확인할 것(open-questions.md)으로 나누고,
// 로드맵을 한 장(roadmap.md)으로 하고 구현 계획(plans/)과 요구사항(requirements/)을 따로 둔다
const isV4 = (cfg) => (cfg.schema ?? 0) >= 4;
const isHome = (cfg) => isV3(cfg) && cfg.mode === 'home';
const allNull = () => Object.fromEntries(Object.keys(ROLE_LABELS).map((k) => [k, null]));

export function placesOf(cfg) {
  const p = allNull();
  if (isHome(cfg)) {
    const base = {
      study: 'study', personalIdeas: 'ideas', feedback: 'feedback', candidates: 'feedback',
      profile: 'profile.md', aiComment: 'ai-comment.md', writingGuide: 'writing-guide.md',
    };
    return Object.assign(p, base, isV4(cfg)
      ? { worklog: 'worklog', openQuestions: 'open-questions.md' }
      : { log: 'log' });
  }
  if (isV3(cfg)) {
    const base = {
      study: 'home:study', issues: 'shared/issues', ideas: 'shared/ideas', personalIdeas: 'home:ideas',
      decisions: 'shared/decisions', design: 'shared/design', conventions: 'shared/conventions',
      sources: 'private/sources', notes: 'private/notes', discussions: 'private/discussions',
      feedback: 'private/feedback', candidates: 'home:feedback',
      profile: 'home:profile.md', aiComment: 'home:ai-comment.md', writingGuide: 'home:writing-guide.md',
    };
    return Object.assign(p, base, isV4(cfg)
      ? {
        worklog: 'private/worklog', openQuestions: 'private/open-questions.md', roadmap: 'shared/roadmap.md',
        plans: 'shared/plans', requirements: 'shared/requirements', architecture: 'shared/architecture.md',
        glossary: 'shared/conventions/glossary.md',
      }
      : { log: 'private/log', roadmap: 'shared/roadmap' });
  }
  const d = cfg.dirs;
  return Object.assign(p, {
    log: d.log, study: d.study, ideas: d.ideas, decisions: d.ideas,
    feedback: d.feedback, candidates: d.feedback,
    profile: `${d.profile}/profile.md`, aiComment: `${d.profile}/ai-comment.md`, writingGuide: 'writing-guide.md',
  });
}

// 이 작업 공간 안의 자리면 그 경로, 다른 작업 공간(home: 등)이나 없는 자리면 null
export const localPlace = (p) => (p && !p.includes(':') ? p : null);

// 폴더마다 들어갈 수 있는 type. 뷰어의 속성 점검이 쓴다. 폴더의 README.md는 목록(index)이라 빠진다.
// 접두어가 '.md'로 끝나면 그 파일 하나의 규칙이다
export function folderRules(cfg) {
  const r = (prefix, ...types) => ({ prefix, types });
  if (isHome(cfg)) {
    return [r('study/', 'study'), r('ideas/', 'idea', 'decision', 'design', 'roadmap'), r('feedback/', 'feedback', 'rule', 'trait'),
      isV4(cfg) ? r('worklog/', 'log') : r('log/', 'log', 'ledger')];
  }
  if (isV4(cfg)) {
    return [
      r('shared/requirements/', 'requirement'), r('shared/issues/', 'issue'), r('shared/ideas/', 'idea'), r('shared/decisions/', 'decision'),
      r('shared/design/', 'design'), r('shared/plans/', 'plan'), r('shared/roadmap.md', 'roadmap'), r('shared/architecture.md', 'architecture'),
      r('shared/conventions/', 'convention'), r('private/sources/', 'source'), r('private/notes/', 'note'),
      r('private/discussions/', 'note'), r('private/feedback/', 'feedback'), r('private/worklog/', 'log'),
    ];
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

// 모양 4 자리 폴더(README.md를 두고, 뷰어가 문서가 없어도 그리는 폴더). 문서 뿌리 기준
export function slotFolders(cfg) {
  if (!isV4(cfg)) return [];
  if (isHome(cfg)) return ['study', 'ideas', 'feedback', 'worklog'];
  return ['shared/requirements', 'shared/ideas', 'shared/decisions', 'shared/design', 'shared/plans', 'shared/issues', 'shared/conventions',
    'private/worklog', 'private/sources', 'private/notes', 'private/discussions', 'private/feedback'];
}

// 뷰어에서 문서를 묶는 이름. 모양 3 프로젝트는 shared/와 private/ 아래를 한 마디 더 나눈다
export function groupOf(rel, cfg) {
  const parts = rel.split('/');
  if (parts.length < 2) return '(맨 위)';
  if (isV3(cfg) && !isHome(cfg) && (parts[0] === 'shared' || parts[0] === 'private') && parts.length >= 3) return parts[0] + '/' + parts[1];
  return parts[0];
}
