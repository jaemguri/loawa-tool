// 무기 강화 표 (재련 단계 → 무기 공격력)
// 무기 강화 표 (재련 단계 → 무기 공격력)
const WEAPON_LEVEL_TABLE = {
  1: 128059, 2: 131439, 3: 134936, 4: 138556, 5: 142303,
  6: 146182, 7: 150196, 8: 154350, 9: 158649, 10: 163099,
  11: 167706, 12: 172473, 13: 177406, 14: 182514, 15: 187799,
  16: 193270, 17: 198101, 18: 203054, 19: 208130, 20: 213333,
  21: 218667, 22: 224133, 23: 229737, 24: 235480, 25: 241367,
};

// 퍼센트 합(예: 8, 3, 2)을 배수(1.13 같은 값)로 변환
function toMultiplier(percentSum) {
  return 1 + (percentSum || 0) / 100;
}

// 무기 공격력 계산
// flatBonuses: {coreFixed, braceletFlat, feast} 같은 고정 수치들의 합
// percentBonuses: {earring, coreMulti, arkPassive} 같은 퍼센트들의 합
function calculateWeaponAttack(weaponLevel, flatBonusSum, percentBonusSum) {
  const base = WEAPON_LEVEL_TABLE[weaponLevel] ?? 0;
  const flatTotal = base + (flatBonusSum || 0);
  const multiplier = toMultiplier(percentBonusSum);
  return flatTotal * multiplier;
}

// 오차율 계산 (실제 API 값과 우리 계산값 비교)
function calculateErrorRate(calculated, actual) {
  if (!actual) return null;
  return (((calculated - actual) / actual) * 100).toFixed(2);
}

// 텍스트에서 "라벨 +숫자%" 패턴 찾기 (예: "무기 공격력 +1.9%")
function extractPercent(text, label) {
  if (!text) return 0;
  const regex = new RegExp(label + '\\s*\\+?([\\d.]+)\\s*%');
  const match = text.match(regex);
  return match ? parseFloat(match[1]) : 0;
}

// 텍스트에서 "라벨 +숫자" (퍼센트 아닌 고정값) 패턴 찾기 (예: "무기 공격력 +195")
function extractFlat(text, label) {
  if (!text) return 0;
  const regex = new RegExp(label + '\\s*\\+?([\\d,]+)(?!\\s*[%.])');
  const match = text.match(regex);
  return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
}

// 아크그리드 코어 옵션 텍스트에서, 현재 투자한 포인트(currentPoint) 이하로
// 활성화된 [XXP] 구간의 효과 텍스트만 모아서 반환
function getActivatedCoreEffects(coreOptionText, currentPoint) {
  if (!coreOptionText) return '';
  const parts = coreOptionText.split(/\[(\d+)P\]/);
  let combined = '';
  for (let i = 1; i < parts.length; i += 2) {
    const threshold = parseInt(parts[i], 10);
    const text = parts[i + 1] || '';
    if (threshold <= currentPoint) combined += ' ' + text;
  }
  return combined;
}