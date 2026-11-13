// ===== 좀비 수학 대작전 설정 =====
// 파이어베이스 설정: 비어 있으면 '체험 모드'(이 컴퓨터 한 대의 브라우저 탭끼리만 연결)로 동작합니다.
export const firebaseConfig = null;

// 접속할 수 있는 학생 번호 (이 번호만 들어올 수 있어요)
export const ALLOWED_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
];

export const GROUP_COUNT = 6;      // 모둠 수
export const PER_ROUND = 3;        // 라운드마다 한 사람이 맞힐 문제 수
export const BONUS_PER_ITEM = 3;   // 보너스 몇 개 맞히면 아이템 1개
export const MAX_ITEMS_PER_ROUND = 2;
export const WRONG_DAMAGE = 2;     // 틀리면 줄어드는 하트
export const MAX_HEARTS = 10;

// 보스 체력 = 모둠 인원 × 아래 값
export const RAVAGER_HP_PER_MEMBER = 150;
export const DRAGON_HP_PER_MEMBER = 400;
