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

// 텍스트에서 "라벨...숫자" 패턴 찾기 (라벨과 숫자 사이에 조사/공백이 있어도 인식)
function extractFlat(text, label) {
  if (!text) return 0;
  const regex = new RegExp(label + '[^\\d%]{0,6}([\\d,]+)(?!\\s*[%.\\d])');
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

// arkpassive 응답에서 특정 카테고리(예: '깨달음')의 레벨을 "N랭크 M레벨" 텍스트에서 추출
function getArkPassiveLevelFromData(arkpassiveData, category) {
  if (!arkpassiveData || !arkpassiveData.Points) return 0;
  const point = arkpassiveData.Points.find((p) => p.Name === category);
  if (!point || !point.Description) return 0;
  const match = point.Description.match(/(\d+)레벨/);
  return match ? parseInt(match[1], 10) : 0;
}

// 깨달음 레벨 → 무기 공격력 % 증가 (n * 0.1%)
function enlightenmentWeaponAttackPercent(level) {
  return level * 0.1;
}

// 팔찌 텍스트에서 무기 공격력 관련 고정 수치 합산 (스택형 옵션 포함)
function getBraceletWeaponAttackFlat(braceletText) {
  if (!braceletText) return 0;
  let total = 0;
  let text = braceletText.replace(/무력화 상태의[^.]*\./g, ''); // 무력화 옵션은 없는 것으로 간주

  // 매 초 스택형 (최대 6중첩): 무기공격력 N * 6
  let m = text.match(/무기\s*공격력이\s*([\d,]+)[^()]*\(최대\s*6\s*중첩\)/);
  if (m) total += parseFloat(m[1].replace(/,/g, '')) * 6;

  // 30초마다 스택형 (최대 30중첩): 무기공격력 N * 30
  m = text.match(/무기\s*공격력이\s*([\d,]+)\s*증가한다\s*\(최대\s*30\s*중첩\)/);
  if (m) total += parseFloat(m[1].replace(/,/g, '')) * 30;

  // 생명력 50% 이상 조건부 추가 무기공격력 (항상 활성으로 가정)
  m = text.match(/생명력이\s*50%[^무]*무기\s*공격력이\s*([\d,]+)/);
  if (m) total += parseFloat(m[1].replace(/,/g, ''));

  // 나머지 "무기공격력이 N 증가한다" 단독 문장들 (위에서 처리한 스택형/조건부는 제외)
  const remaining = text
    .replace(/무기\s*공격력이\s*[\d,]+[^()]*\(최대\s*6\s*중첩\)/g, '')
    .replace(/무기\s*공격력이\s*[\d,]+\s*증가한다\s*\(최대\s*30\s*중첩\)/g, '')
    .replace(/생명력이\s*50%[^.]*\./g, '');
  const plainMatches = remaining.matchAll(/무기\s*공격력이\s*([\d,]+)\s*증가한다/g);
  for (const pm of plainMatches) {
    total += parseFloat(pm[1].replace(/,/g, ''));
  }

  return total;
}

// 팔찌 텍스트를 한 번에 파싱해서, 모든 옵션을 구조화된 객체로 반환
// (무기 공격력뿐 아니라 다른 계산식에서도 이 결과를 재사용)
function parseBraceletOptions(braceletText) {
  const result = {
    weaponAttackFlat: 0,
    critRatePercent: 0,
    critDamagePercent: 0,
    critHitExtraDamagePercent: 0,
    enemyDamagePercent: 0,
    additionalDamagePercent: 0,
    demonDamagePercent: 0,
    cooldownPenaltyPercent: 0,
    backAttackDamagePercent: 0,
    headAttackDamagePercent: 0,
    nonDirectionalDamagePercent: 0,
    defenseReductionPercent: 0,
    critResistReductionPercent: 0,
    critDmgResistReductionPercent: 0,
    protectedTargetDamagePercent: 0,
    allyShieldHealPercent: 0,
    allyAttackBuffPercent: 0,
    allyDamageBuffPercent: 0,
  };
  if (!braceletText) return result;

  const text = braceletText.replace(/무력화 상태의[^.]*\./g, ''); // 무력화 옵션은 없는 것으로 간주

  result.weaponAttackFlat = getBraceletWeaponAttackFlat(text);
  result.critRatePercent = extractPercent(text, '치명타 적중률');
  result.critDamagePercent = extractPercent(text, '치명타 피해');
  result.enemyDamagePercent = extractPercent(text, '적에게 주는 피해');
  result.additionalDamagePercent = extractPercent(text, '추가 피해');

  let m;
  m = text.match(/치명타로 적중 시 적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.critHitExtraDamagePercent = parseFloat(m[1]);

  m = text.match(/악마 및 대악마 계열 피해량이\s*([\d.]+)\s*%/);
  if (m) result.demonDamagePercent = parseFloat(m[1]);

  m = text.match(/재사용 대기시간이\s*([\d.]+)\s*%\s*증가/);
  if (m) result.cooldownPenaltyPercent = parseFloat(m[1]);

  m = text.match(/백어택 스킬이 적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.backAttackDamagePercent = parseFloat(m[1]);

  m = text.match(/헤드어택 스킬이 적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.headAttackDamagePercent = parseFloat(m[1]);

  m = text.match(/방향성 공격이 아닌 스킬이 적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.nonDirectionalDamagePercent = parseFloat(m[1]);

  m = text.match(/방어력을\s*([\d.]+)\s*%\s*감소/);
  if (m) result.defenseReductionPercent = parseFloat(m[1]);

  m = text.match(/치명타 저항력을\s*([\d.]+)\s*%\s*감소/);
  if (m) result.critResistReductionPercent = parseFloat(m[1]);

  m = text.match(/치명타 피해 저항력을\s*([\d.]+)\s*%\s*감소/);
  if (m) result.critDmgResistReductionPercent = parseFloat(m[1]);

  m = text.match(/보호 효과가 적용된 대상이[^%]*적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.protectedTargetDamagePercent = parseFloat(m[1]);

  m = text.match(/파티원 보호 및 회복효과가\s*([\d.]+)\s*%/);
  if (m) result.allyShieldHealPercent = parseFloat(m[1]);

  m = text.match(/아군 공격력 강화 효과(?:가|이)\s*([\d.]+)\s*%/);
  if (m) result.allyAttackBuffPercent = parseFloat(m[1]);

  m = text.match(/아군 피해량 강화 효과(?:가|이)\s*([\d.]+)\s*%/);
  if (m) result.allyDamageBuffPercent = parseFloat(m[1]);

  return result;
}