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

// 문장 하나에서 숫자(고정값/퍼센트)를 전부 뽑아내는 헬퍼
function extractNumbersFromSentence(sentence) {
  const regex = /([\d][\d,]*(?:\.\d+)?)\s*(%)?/g;
  const result = [];
  let match;
  while ((match = regex.exec(sentence)) !== null) {
    result.push({
      value: parseFloat(match[1].replace(/,/g, '')),
      isPercent: !!match[2],
    });
  }
  return result;
}

// 문장 하나에서 숫자(고정값/퍼센트)를 전부 뽑아내는 헬퍼
function extractNumbersFromSentence(sentence) {
  const regex = /([\d][\d,]*(?:\.\d+)?)\s*(%)?/g;
  const result = [];
  let match;
  while ((match = regex.exec(sentence)) !== null) {
    result.push({
      value: parseFloat(match[1].replace(/,/g, '')),
      isPercent: !!match[2],
    });
  }
  return result;
}

// 라벨 바로 근처(가까운 거리)에 있는 고정값만 전부 찾아 합산 (다른 스탯과 안 섞임)
function extractFlat(text, label) {
  if (!text) return 0;
  const regex = new RegExp(label + '[^\\d%]{0,6}([\\d,]+)(?!\\s*[%.\\d])', 'g');
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    total += parseFloat(m[1].replace(/,/g, ''));
  }
  return total;
}

// 라벨 바로 근처에 있는 퍼센트만 전부 찾아 합산
function extractPercent(text, label) {
  if (!text) return 0;
  const regex = new RegExp(label + '[^\\d%]{0,6}([\\d.]+)\\s*%', 'g');
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    total += parseFloat(m[1]);
  }
  return total;
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

// 아크그리드 코어 옵션 텍스트에서, 활성화된 [XXP] 구간들을 "배열"로 반환 (합치지 않음)
function getActivatedCoreSegments(coreOptionText, currentPoint) {
  if (!coreOptionText) return [];
  const parts = coreOptionText.split(/\[(\d+)P\]/);
  const segments = [];
  for (let i = 1; i < parts.length; i += 2) {
    const threshold = parseInt(parts[i], 10);
    const segText = parts[i + 1] || '';
    if (threshold <= currentPoint) segments.push(segText);
  }
  return segments;
}

// 코어 구간 배열에서, 라벨이 포함된 구간의 고정값/퍼센트를 각각 합산
function sumCoreSegments(segments, label) {
  let flat = 0;
  let percent = 0;
  segments.forEach((seg) => {
    if (seg.includes(label)) {
      extractNumbersFromSentence(seg).forEach((n) => {
        if (n.isPercent) percent += n.value;
        else flat += n.value;
      });
    }
  });
  return { flat, percent };
}
// 특정 라벨은 포함하되 다른 라벨(예: "무기 공격력")은 제외하고 고정값 찾기
function extractFlatExcluding(text, includeLabel, excludeLabel) {
  if (!text) return 0;
  const cleaned = text.replace(new RegExp(excludeLabel + '[^\\d%]{0,6}[\\d,]+(?!\\s*[%.\\d])', 'g'), '');
  return extractFlat(cleaned, includeLabel);
}

// 특정 라벨은 포함하되 다른 라벨은 제외하고 퍼센트 찾기
function extractPercentExcluding(text, includeLabel, excludeLabel) {
  if (!text) return 0;
  const cleaned = text.replace(new RegExp(excludeLabel + '[^\\d%]{0,6}[\\d.]+\\s*%', 'g'), '');
  return extractPercent(cleaned, includeLabel);
}

// 라벨 뒤에 "14.0%, 28.0%, 42.0%"처럼 쉼표로 나열된 단계별 값이 있으면 그중 최댓값만 사용
// (조건부 다단계 버프는 최댓값 달성을 가정하는 기존 관례와 동일), 값이 하나면 그 값 그대로 사용.
// labelPattern은 그대로 정규식 소스 문자열로 들어감(라벨 자체가 정규식이어도 됨).
function extractPercentMaxSequence(text, labelPattern) {
  if (!text) return 0;
  const regex = new RegExp(labelPattern + '[^\\d%]{0,6}((?:[\\d.]+\\s*%[,\\s]*)+)', 'g');
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const numbers = m[1].match(/[\d.]+/g).map(Number);
    total += Math.max(...numbers);
  }
  return total;
}

// extractPercentMaxSequence의 "다른 라벨 제외" 버전 (extractPercentExcluding과 동일한 제외 방식)
function extractPercentMaxSequenceExcluding(text, includeLabel, excludeLabel) {
  if (!text) return 0;
  const cleaned = text.replace(new RegExp(excludeLabel + '[^\\d%]{0,6}[\\d.]+\\s*%', 'g'), '');
  return extractPercentMaxSequence(cleaned, includeLabel);
}

// 코어 구간에서 특정 라벨은 포함, 다른 라벨은 제외하고 합산
function sumCoreSegmentsExcluding(segments, includeLabel, excludeLabel) {
  let flat = 0;
  let percent = 0;
  segments.forEach((seg) => {
    if (seg.includes(includeLabel) && !seg.includes(excludeLabel)) {
      extractNumbersFromSentence(seg).forEach((n) => {
        if (n.isPercent) percent += n.value;
        else flat += n.value;
      });
    }
  });
  return { flat, percent };
}

// 악세서리(목걸이/귀걸이/반지) 연마옵션의 "공격력" 고정값 합산 (무기 공격력 제외)
function getAccessoryAttackFlat(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => ['목걸이', '귀걸이', '반지'].includes(it.Type)).forEach((it) => {
    const text = parseTooltip(it.Tooltip).join(' ');
    total += extractFlatExcluding(text, '공격력', '무기 공격력');
  });
  return total;
}

// 귀걸이 연마옵션의 "공격력 %" 합산 (무기 공격력 제외)
function getEarringAttackPercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '귀걸이').forEach((it) => {
    const text = parseTooltip(it.Tooltip).join(' ');
    total += extractPercentExcluding(text, '공격력', '무기 공격력');
  });
  return total;
}

// 귀걸이 연마옵션의 "무기 공격력 %" 합산 (무기 공격력 계산에 쓰이는 별도 값, 위 공격력%와는 다른 옵션)
function getEarringWeaponAttackPercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '귀걸이').forEach((it) => {
    const text = parseTooltip(it.Tooltip).join(' ');
    total += extractPercent(text, '무기 공격력');
  });
  return total;
}

// 혼돈의 별 코어의 "공격력" 고정값/%값 (무기 공격력 제외)
function getChaosStarCoreAttack(arkgridData) {
  let flat = 0;
  let percent = 0;
  if (arkgridData && arkgridData.Slots) {
    const slot = arkgridData.Slots.find((s) => s.Name.includes('혼돈의 별 코어'));
    if (slot) {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      const sums = sumCoreSegmentsExcluding(segments, '공격력', '무기 공격력');
      flat = sums.flat;
      percent = sums.percent;
    }
  }
  return { flat, percent };
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[공격력] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsAttackLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[공격력\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.0367% = 정확한 공격력 % (API 표시값의 반올림 오차 제거)
function getAllArkgridGemsAttackPercent(arkgridData) {
  const level = getAllArkgridGemsAttackLevel(arkgridData);
  return level * 0.0367;
}

// 스탯창 공격력 = (기본공격력 + 악세공격력고정 + 코어공격력고정) × (1 + (코어%+귀걸이%+젬%)/100)
function calculateStatWindowAttackPower(basePower, accessoryFlat, coreFlat, corePercent, earringPercent, gemPercent) {
  const flatTotal = basePower + accessoryFlat + coreFlat;
  const percentSum = corePercent + earringPercent + gemPercent;
  return flatTotal * toMultiplier(percentSum);
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

// 팔찌 텍스트에서 "조건부/스택형이 아닌" 순수 무기 공격력 고정값만 합산 (역산용)
function getBraceletWeaponAttackFlatBase(braceletText) {
  if (!braceletText) return 0;
  const text = braceletText.replace(/무력화 상태의[^.]*\./g, '');

  const remaining = text
    .replace(/무기\s*공격력이\s*[\d,]+[^()]*\(최대\s*6\s*중첩\)/g, '')
    .replace(/무기\s*공격력이\s*[\d,]+\s*증가한다\.?\s*\(최대\s*30\s*중첩\)/g, '')
    .replace(/생명력이\s*50%[^.]*\./g, '');

  let total = 0;
  const plainMatches = remaining.matchAll(/무기\s*공격력이\s*([\d,]+)\s*증가한다/g);
  for (const pm of plainMatches) {
    total += parseFloat(pm[1].replace(/,/g, ''));
  }
  return total;
}

// 팔찌 텍스트의 조건부/스택형 "고정 무기공격력" 옵션들을 종류별로 감지해서
// [{ variantKey, rawValue(칸당 값), multiplier }] 로 반환 (실제로는 팔찌 하나에 보통 최대 1개).
// getBraceletWeaponAttackFlatConditional과 팔찌 효율표(계산·표시 양쪽)가 이 결과를 공유해서 쓴다.
function getBraceletWeaponAttackConditionalBreakdown(braceletText) {
  if (!braceletText) return [];
  const text = braceletText.replace(/무력화 상태의[^.]*\./g, '');
  const found = [];

  let m = text.match(/무기\s*공격력이\s*([\d,]+)[^()]*\(최대\s*6\s*중첩\)/);
  if (m) found.push({ variantKey: 'weaponAttackFlatStack6', rawValue: parseFloat(m[1].replace(/,/g, '')), multiplier: 6 });

  m = text.match(/무기\s*공격력이\s*([\d,]+)\s*증가한다\.?\s*\(최대\s*30\s*중첩\)/);
  if (m) found.push({ variantKey: 'weaponAttackFlatStack30', rawValue: parseFloat(m[1].replace(/,/g, '')), multiplier: 30 });

  m = text.match(/생명력이\s*50%[^무]*무기\s*공격력이\s*([\d,]+)/);
  if (m) found.push({ variantKey: 'weaponAttackFlatLife50', rawValue: parseFloat(m[1].replace(/,/g, '')), multiplier: 1 });

  return found;
}

// 팔찌 텍스트에서 조건부/스택형 무기 공격력만 합산 (실제 효율용, 최대치 가정)
function getBraceletWeaponAttackFlatConditional(braceletText) {
  return getBraceletWeaponAttackConditionalBreakdown(braceletText)
    .reduce((sum, v) => sum + v.rawValue * v.multiplier, 0);
}

// 기존 함수는 base + conditional 합(=실제 총합)으로 유지
function getBraceletWeaponAttackFlat(braceletText) {
  return getBraceletWeaponAttackFlatBase(braceletText) + getBraceletWeaponAttackFlatConditional(braceletText);
}

// 팔찌 텍스트를 한 번에 파싱해서, 모든 옵션을 구조화된 객체로 반환
// (무기 공격력뿐 아니라 다른 계산식에서도 이 결과를 재사용)
function parseBraceletOptions(braceletText) {
  const result = {
    weaponAttackFlat: 0,
    weaponAttackFlatBase: 0,
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
    incapacitatedDamagePercent: 0,
    allyShieldHealPercent: 0,
    allyAttackBuffPercent: 0,
    allyDamageBuffPercent: 0,
  };
  if (!braceletText) return result;

  const text = braceletText;

  result.weaponAttackFlat = getBraceletWeaponAttackFlat(text);
  result.weaponAttackFlatBase = getBraceletWeaponAttackFlatBase(text);
  result.critRatePercent = extractPercent(text, '치명타 적중률');
  result.critDamagePercent = extractPercent(text, '치명타 피해');
  result.additionalDamagePercent = extractPercent(text, '추가 피해');

  // "적에게 주는 피해"는 아래 조건부 문구들(치명타 적중 시/백어택/헤드어택/비방향성/보호효과대상/무력화)에도
  // 전부 부분 문자열로 포함되어 있어, 그대로 extractPercent를 돌리면 그 수치들까지 중복 합산된다.
  // 해당 문구들을 먼저 지운 텍스트로 순수 "적에게 주는 피해 N%" 옵션만 집계한다.
  const enemyDamageOnlyText = text
    .replace(/치명타로 적중 시 적에게 주는 피해가\s*[\d.]+\s*%/g, '')
    .replace(/백어택 스킬이 적에게 주는 피해가\s*[\d.]+\s*%/g, '')
    .replace(/헤드어택 스킬이 적에게 주는 피해가\s*[\d.]+\s*%/g, '')
    .replace(/방향성 공격이 아닌 스킬이 적에게 주는 피해가\s*[\d.]+\s*%/g, '')
    .replace(/보호 효과가 적용된 대상이[^%]*적에게 주는 피해가\s*[\d.]+\s*%/g, '')
    .replace(/무력화 상태의 적에게 주는 피해가\s*[\d.]+\s*%/g, '');
  result.enemyDamagePercent = extractPercent(enemyDamageOnlyText, '적에게 주는 피해');

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

  m = text.match(/치명타 저항(?:력)?(?:을|이)\s*(?:감소\s*)?([\d.]+)\s*%(?:\s*감소)?/);
  if (m) result.critResistReductionPercent = parseFloat(m[1]);

  m = text.match(/치명타 피해 저항(?:력)?(?:을|이)\s*(?:감소\s*)?([\d.]+)\s*%(?:\s*감소)?/);
  if (m) result.critDmgResistReductionPercent = parseFloat(m[1]);

  m = text.match(/보호 효과가 적용된 대상이[^%]*적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.protectedTargetDamagePercent = parseFloat(m[1]);

  m = text.match(/무력화 상태의 적에게 주는 피해가\s*([\d.]+)\s*%/);
  if (m) result.incapacitatedDamagePercent = parseFloat(m[1]);

  m = text.match(/파티원 보호 및 회복효과가\s*([\d.]+)\s*%/);
  if (m) result.allyShieldHealPercent = parseFloat(m[1]);

  // "효과가 N% 증가한다" / "효과 +N%" (연마 효과 표기) 두 형태 모두 대응
  m = text.match(/아군 공격력 강화 효과\s*(?:가|이)?\s*\+?\s*([\d.]+)\s*%/);
  if (m) result.allyAttackBuffPercent = parseFloat(m[1]);

  m = text.match(/아군 피해량 강화 효과\s*(?:가|이)?\s*\+?\s*([\d.]+)\s*%/);
  if (m) result.allyDamageBuffPercent = parseFloat(m[1]);

  return result;
}

// 툴팁 JSON에서 "코어 옵션" 이름표가 붙은 항목을 번호(Element_006 등)와 상관없이 찾아서 반환
function getCoreOptionText(tooltipStr) {
  try {
    const obj = JSON.parse(tooltipStr);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.value && typeof el.value === 'object' && el.value.Element_000) {
        const label = stripHtml(el.value.Element_000);
        if (label.includes('코어 옵션')) {
          return stripHtml(el.value.Element_001 || '');
        }
      }
    }
  } catch (e) {}
  return '';
}

// 모든 장비(팔찌 제외)의 "기본 효과"에서 특정 스탯(힘/민첩/지능)을 다 더해서 총합 계산
// (팔찌는 별도로 계산해서 더하므로 여기서 제외해 중복 방지)
// 방어구 5종(머리장식/견장/상의/하의/장갑)은 텍스트 파싱 대신 ARMOR_LEVEL_TABLE로 별도 계산하므로
// (getArmorPrimaryStatFlat 참고) 여기서는 제외해서 중복 합산을 막는다.
const ARMOR_EQUIPMENT_TYPES = ['투구', '어깨', '상의', '하의', '장갑'];

function getStatTotalFromEquipment(equipmentList, statName) {
  let total = 0;
  (equipmentList || [])
    .filter((item) => item.Type !== '팔찌' && !ARMOR_EQUIPMENT_TYPES.includes(item.Type))
    .forEach((item) => {
      const text = parseTooltip(item.Tooltip).join(' ');
      total += extractFlat(text, statName);
    });
  return total;
}

// 방어구 5종 레벨(10~25)별 힘/민첩/지능 고정 테이블 — 완갑/무기처럼 텍스트 파싱 대신 레벨→수치 고정
// 테이블로 관리(레벨별 수치가 게임 데이터 그대로라 텍스트 파싱보다 표가 더 정확하고 안전함).
// API의 실제 Type 값은 '투구'/'어깨'(모자/견장이 아님).
const ARMOR_LEVEL_TABLE = {
  '투구': { 10: 94140, 11: 96801, 12: 99554, 13: 102404, 14: 105353, 15: 108406, 16: 111565, 17: 114358, 18: 117218, 19: 120150, 20: 123155, 21: 126236, 22: 129393, 23: 132629, 24: 135946, 25: 139346 },
  '어깨': { 10: 100193, 11: 103023, 12: 105954, 13: 108987, 14: 112126, 15: 115375, 16: 118738, 17: 121709, 18: 124754, 19: 127874, 20: 131072, 21: 134351, 22: 137711, 23: 141155, 24: 144686, 25: 148304 },
  '상의': { 10: 75313, 11: 77441, 12: 79644, 13: 81924, 14: 84283, 15: 86725, 16: 89253, 17: 91486, 18: 93775, 19: 96120, 20: 98524, 21: 100989, 22: 103514, 23: 106103, 24: 108757, 25: 111477 },
  '하의': { 10: 81364, 11: 83664, 12: 86043, 13: 88506, 14: 91056, 15: 93693, 16: 96424, 17: 98838, 18: 101310, 19: 103844, 20: 106441, 21: 109104, 22: 111833, 23: 114630, 24: 117497, 25: 120435 },
  '장갑': { 10: 112969, 11: 116161, 12: 119465, 13: 122885, 14: 126425, 15: 130087, 16: 133879, 17: 137229, 18: 140662, 19: 144180, 20: 147786, 21: 151483, 22: 155271, 23: 159155, 24: 163136, 25: 167216 },
};

// 방어구 아이템 이름의 "+N"에서 강화 레벨 추출 (무기/완갑과 동일한 패턴)
function getArmorLevel(item) {
  if (!item) return 0;
  const levelMatch = stripHtml(item.Name).match(/\+(\d+)/);
  return levelMatch ? parseInt(levelMatch[1], 10) : 0;
}

// 방어구 5종 각각의 실제 착용 레벨을 ARMOR_LEVEL_TABLE에서 찾아 합산한 힘/민첩/지능 고정치.
// (부위별 상세는 getArmorBreakdown 참고 — 장비 탭 표시용)
function getArmorPrimaryStatFlat(equipmentList) {
  return getArmorBreakdown(equipmentList).reduce((sum, row) => sum + row.statFlat, 0);
}

// 장비 탭/디버그 표시용 — 방어구 5종 부위별 [type, item, level, statFlat] 나열
function getArmorBreakdown(equipmentList) {
  return ARMOR_EQUIPMENT_TYPES.map((apiType) => {
    const item = (equipmentList || []).find((it) => it.Type === apiType);
    const level = getArmorLevel(item);
    const statFlat = (ARMOR_LEVEL_TABLE[apiType] && ARMOR_LEVEL_TABLE[apiType][level]) || 0;
    return { type: apiType, item, level, statFlat };
  });
}

// API Type -> 화면 표시용 한글 이름 (장비 탭 UI용)
const ARMOR_TYPE_LABELS = { '투구': '머리장식', '어깨': '견장', '상의': '상의', '하의': '하의', '장갑': '장갑' };

// 장비 시뮬레이터: 방어구 5종 레벨을 가상으로 바꿨을 때(실제 착용 레벨 대신) 전체 딜 변화율을 계산.
// 방어구는 primaryStat(purePower=sqrt(주스탯×무기공격력/6) 경로) 하나에만 영향을 주므로, 팔찌처럼
// 텍스트를 재구성할 필요 없이 getMaxPrimaryStat에 넘기는 extraStatFlat만 갈아끼우면 된다.
// levelSelections = { 투구: level, 어깨: level, ... } — 값이 없는(0/undefined) 부위는 실제 착용 레벨을
// 그대로 사용(안 바꾼 것으로 취급).
function calculateHypotheticalArmorEfficiency(dealerData, dealerStats, ctx, levelSelections) {
  const braceletItem = (dealerData.equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const gemPercent = getGemsBaseAttackPercent(dealerData.gems);
  const stonePercent = getAbilityStoneBaseAttackPercent(dealerData.equipment);

  function totalWithArmorFlat(armorFlat) {
    const primaryStat = getMaxPrimaryStat(dealerData.equipment, braceletText, dealerData.avatars, dealerStats.wanjibStats.primaryStatFlat + armorFlat);
    const purePower = calculatePureAttackPower(primaryStat, dealerStats.weaponAttack);
    const basePower = calculateBaseAttackPower(purePower, gemPercent, stonePercent + dealerStats.wanjibStats.baseAttackPercent) + dealerStats.wanjibStats.baseAttackFlat;
    const finalDamage = calculateFinalDamage(
      basePower, dealerStats.accessoryAttackFlat, dealerStats.chaosCoreAttack.flat, ctx.supportBuffPower,
      dealerStats.chaosCoreAttack.percent, dealerStats.earringAttackPercent, dealerStats.arkgridGemsAttackPercent,
      ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
    );
    return finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  }

  const realBreakdown = getArmorBreakdown(dealerData.equipment);
  const perPieceFlat = {};
  let hypotheticalArmorFlat = 0;
  ARMOR_EQUIPMENT_TYPES.forEach((apiType) => {
    const level = levelSelections[apiType];
    const realStatFlat = realBreakdown.find((b) => b.type === apiType).statFlat;
    const statFlat = level ? ((ARMOR_LEVEL_TABLE[apiType] && ARMOR_LEVEL_TABLE[apiType][level]) || 0) : realStatFlat;
    perPieceFlat[apiType] = statFlat;
    hypotheticalArmorFlat += statFlat;
  });

  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const hypotheticalTotal = totalWithArmorFlat(hypotheticalArmorFlat);
  const totalChangePercent = ((hypotheticalTotal / realTotal) - 1) * 100;

  const rows = ARMOR_EQUIPMENT_TYPES.filter((apiType) => levelSelections[apiType]).map((apiType) => {
    const realStatFlat = realBreakdown.find((b) => b.type === apiType).statFlat;
    const withoutThisFlat = hypotheticalArmorFlat - perPieceFlat[apiType] + realStatFlat;
    const withoutThisTotal = totalWithArmorFlat(withoutThisFlat);
    const efficiencyPercent = ((hypotheticalTotal / withoutThisTotal) - 1) * 100;
    return { key: apiType, label: ARMOR_TYPE_LABELS[apiType], value: `Lv.${levelSelections[apiType]}`, efficiencyPercent };
  });

  return { rows, totalChangePercent };
}

// equipmentList(팔찌 제외)에서 힘/민첩/지능 중 가장 큰 stat 이름을 반환 — 클래스의 "주스탯"을
// 클래스명 테이블이 아니라 실제 장비 데이터(무기의 주스탯 고정 보너스가 압도적으로 커서 신뢰 가능)로
// 판별한다. 팔찌 시뮬레이터에서 힘/민첩/지능을 따로 고르게 하지 않고 "주스탯" 하나로 통합해
// 자동으로 이 stat에 적용할 때 사용.
function getPrimaryStatName(equipmentList) {
  const str = getStatTotalFromEquipment(equipmentList, '힘');
  const dex = getStatTotalFromEquipment(equipmentList, '민첩');
  const int_ = getStatTotalFromEquipment(equipmentList, '지능');
  if (str >= dex && str >= int_) return '힘';
  if (dex >= int_) return '민첩';
  return '지능';
}

// 아바타 중 실제 적용되는(덧입기에 가려지지 않은) 것들의 힘/민첩/지능 % 합산, 최대 8%
function getAvatarPrimaryStatPercent(avatarsData) {
  let total = 0;
  (avatarsData || []).forEach((item) => {
    const text = parseTooltip(item.Tooltip).join(' ');
    if (text.includes('적용되지 않는 상태')) return; // 덧입기에 가려짐
    const m = text.match(/(힘|민첩|지능)\s*\+?([\d.]+)\s*%/);
    if (m) total += parseFloat(m[2]);
  });
  return Math.min(total, 8);
}

// 힘/민첩/지능 = (장비합산 + 팔찌옵션 + 완갑 힘민첩지능 + 카드240 + 물약원정대1850 + 기본스탯476) × (1 + (펫도감1% + 아바타%)/100)
function getMaxPrimaryStat(equipmentList, braceletText, avatarsData, extraStatFlat = 0) {
  const CARD_BONUS = 240;
  const POTION_EXPEDITION = 1850;
  const BASE_STAT = 476;
  const PET_DOGAM_PERCENT = 1;

  const eqStr = getStatTotalFromEquipment(equipmentList, '힘');
  const eqDex = getStatTotalFromEquipment(equipmentList, '민첩');
  const eqInt = getStatTotalFromEquipment(equipmentList, '지능');

  const brStr = extractFlat(braceletText, '힘');
  const brDex = extractFlat(braceletText, '민첩');
  const brInt = extractFlat(braceletText, '지능');

  const totalStr = eqStr + brStr + extraStatFlat + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;
  const totalDex = eqDex + brDex + extraStatFlat + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;
  const totalInt = eqInt + brInt + extraStatFlat + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;

  const avatarPercent = getAvatarPrimaryStatPercent(avatarsData);
  const multiplier = 1 + (PET_DOGAM_PERCENT + avatarPercent) / 100;
  return Math.max(totalStr, totalDex, totalInt) * multiplier;
}

// 완갑(신규 장비) 레벨(1~25)별 [무기공격력, 힘/민첩/지능, 기본공격력(고정값)] 테이블
// 무기공격력/힘·민첩·지능은 다른 장비처럼 툴팁 텍스트 파싱이 아니라 레벨→수치 고정 테이블로 관리
// (레벨별 수치가 게임 데이터 그대로라 텍스트 파싱보다 표가 더 정확하고 안전함)
const WANJIB_TABLE = {
  1: { weaponAttack: 10500, primaryStat: 10500, baseAttackFlat: 0 },
  2: { weaponAttack: 5350, primaryStat: 16500, baseAttackFlat: 0 },
  3: { weaponAttack: 7210, primaryStat: 16500, baseAttackFlat: 0 },
  4: { weaponAttack: 7210, primaryStat: 22530, baseAttackFlat: 0 },
  5: { weaponAttack: 7210, primaryStat: 22530, baseAttackFlat: 850 },
  6: { weaponAttack: 9077, primaryStat: 22530, baseAttackFlat: 850 },
  7: { weaponAttack: 9077, primaryStat: 28608, baseAttackFlat: 850 },
  8: { weaponAttack: 10969, primaryStat: 28608, baseAttackFlat: 850 },
  9: { weaponAttack: 10969, primaryStat: 34746, baseAttackFlat: 850 },
  10: { weaponAttack: 10969, primaryStat: 34746, baseAttackFlat: 2030 },
  11: { weaponAttack: 12873, primaryStat: 34746, baseAttackFlat: 2030 },
  12: { weaponAttack: 12873, primaryStat: 40962, baseAttackFlat: 2030 },
  13: { weaponAttack: 14817, primaryStat: 40962, baseAttackFlat: 2030 },
  14: { weaponAttack: 14817, primaryStat: 47268, baseAttackFlat: 2030 },
  15: { weaponAttack: 14817, primaryStat: 47268, baseAttackFlat: 3690 },
  16: { weaponAttack: 16778, primaryStat: 47268, baseAttackFlat: 3690 },
  17: { weaponAttack: 16778, primaryStat: 52682, baseAttackFlat: 3690 },
  18: { weaponAttack: 18794, primaryStat: 52682, baseAttackFlat: 3690 },
  19: { weaponAttack: 18794, primaryStat: 60216, baseAttackFlat: 3690 },
  20: { weaponAttack: 18794, primaryStat: 60216, baseAttackFlat: 5980 },
  21: { weaponAttack: 20832, primaryStat: 60216, baseAttackFlat: 5980 },
  22: { weaponAttack: 20832, primaryStat: 66888, baseAttackFlat: 5980 },
  23: { weaponAttack: 22940, primaryStat: 66888, baseAttackFlat: 5980 },
  24: { weaponAttack: 22940, primaryStat: 73710, baseAttackFlat: 5980 },
  25: { weaponAttack: 22940, primaryStat: 73710, baseAttackFlat: 9050 },
};

// 완갑 레벨 구간별 "기본 공격력 %" (보석/스톤 등 기본 공격력 % 풀에 합산)
function getWanjibBaseAttackPercent(level) {
  if (!level) return 0;
  if (level <= 10) return 0;
  if (level <= 15) return 1;
  if (level <= 20) return 2;
  return 3; // 21~25
}

// 완갑 아이템에서 레벨(+N)을 추출 (미착용 시 0)
// Type/레벨 표기 형식은 신규 아이템이라 실제 API 데이터로 아직 검증 전 — 무기와 동일하게 이름의 "+N"으로 가정
function getWanjibLevel(equipmentList) {
  const item = (equipmentList || []).find((it) => it.Type === '완갑');
  if (!item) return 0;
  const m = stripHtml(item.Name).match(/\+(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// 완갑 레벨 → {무기공격력, 힘민첩지능, 기본공격력 고정값, 기본공격력 %} 전부 반환
function getWanjibStats(equipmentList) {
  const level = getWanjibLevel(equipmentList);
  const row = WANJIB_TABLE[level];
  return {
    level,
    weaponAttackFlat: row ? row.weaponAttack : 0,
    primaryStatFlat: row ? row.primaryStat : 0,
    baseAttackFlat: row ? row.baseAttackFlat : 0,
    baseAttackPercent: getWanjibBaseAttackPercent(level),
  };
}

// 순수 공격력 = sqrt(힘/민첩/지능(최댓값) × 무기 공격력 / 6)
function calculatePureAttackPower(primaryStat, weaponAttack) {
  return Math.sqrt((primaryStat * weaponAttack) / 6);
}

// 전투 스킬 보석들의 "기본 공격력 N% 증가" 효과를 전부 합산
function getGemsBaseAttackPercent(gemsData) {
  if (!gemsData || !gemsData.Gems) return 0;
  let total = 0;
  gemsData.Gems.forEach((gem) => {
    const text = parseTooltip(gem.Tooltip).join(' ');
    total += extractPercent(text, '기본 공격력');
  });
  return total;
}

// 어빌리티 스톤의 "무작위 각인 효과" 안 "레벨 보너스"에서 기본 공격력 % 추출
function getAbilityStoneBaseAttackPercent(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return 0;

  try {
    const obj = JSON.parse(stone.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'IndentStringGroup' && el.value) {
        for (const groupKey of Object.keys(el.value)) {
          const group = el.value[groupKey];
          const contentStr = group.contentStr;
          if (!contentStr) continue;
          for (const itemKey of Object.keys(contentStr)) {
            const line = stripHtml(contentStr[itemKey].contentStr || '');
            if (line.includes('레벨 보너스')) {
              const match = line.match(/기본\s*공격력\s*\+?([\d.]+)\s*%/);
              if (match) return parseFloat(match[1]);
            }
          }
        }
      }
    }
  } catch (e) {}

  return 0;
}

// 어빌리티 스톤의 "무작위 각인 효과" 슬롯을 이름/레벨 그대로 나열 (표시용).
// "[돌격대장] Lv.3", "[아드레날린] Lv.2", "[방어력 감소] Lv.0"처럼 스톤마다 어떤 각인이 걸렸는지 다르므로
// 치명타피해 등 특정 스탯을 고정으로 찾지 않고 실제로 들어있는 각인 효과를 그대로 반환한다.
// "레벨 보너스"(기본 공격력 %, getAbilityStoneBaseAttackPercent가 별도 처리) 줄은 제외.
function getAbilityStoneEngravingEffects(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return [];

  const effects = [];
  try {
    const obj = JSON.parse(stone.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'IndentStringGroup' && el.value) {
        for (const groupKey of Object.keys(el.value)) {
          const contentStr = el.value[groupKey].contentStr;
          if (!contentStr) continue;
          for (const itemKey of Object.keys(contentStr)) {
            const line = stripHtml(contentStr[itemKey].contentStr || '');
            if (line.includes('레벨 보너스')) continue;
            const match = line.match(/\[\s*(.+?)\s*\]\s*Lv\.(\d+)/);
            if (match) effects.push({ name: match[1], level: Number(match[2]) });
          }
        }
      }
    }
  } catch (e) {}

  return effects;
}

// 기본 공격력 = 순수 공격력 × (1 + (보석% + 세공%)/100)
function calculateBaseAttackPower(purePower, gemPercent, stonePercent) {
  return purePower * (1 + (gemPercent + stonePercent) / 100);
}

// 소수점 부동소수점 오차 제거용 - 원하는 자릿수로 반올림
function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// 클래스별 "공증 버프" 스킬 보석 이름 목록 (둘 중 레벨 높은 것만 사용)
const SUPPORT_BUFF_GEM_NAMES = {
  '도화가': ['묵법: 해그리기', '묵법: 해우물'],
  '바드': ['음파 진동', '천상의 연주'],
  '홀리나이트': ['신의 분노', '천상의 축복'],
  '발키리': ['숭고한 도약', '숭고한 맹세'],
};

// 공증 버프 스킬(도화가: 묵법:해그리기/해우물 등)의 "지원 효과 N%"를 gems.Effects.Skills에서 찾기 (둘 중 최댓값)
function getSupportBuffGemPercent(gemsData, className) {
  const targets = SUPPORT_BUFF_GEM_NAMES[className];
  if (!targets || !gemsData || !gemsData.Effects || !gemsData.Effects.Skills) return 0;

  let maxPercent = 0;
  gemsData.Effects.Skills.forEach((skill) => {
    const name = (skill.Name || '').replace(/\s+/g, '');
    const matched = targets.some((t) => name.includes(t.replace(/\s+/g, '')));
    if (!matched) return;

    (skill.Description || []).forEach((desc) => {
      const m = desc.match(/지원\s*효과\s*([\d.]+)\s*%/);
      if (m) {
        const value = parseFloat(m[1]);
        if (value > maxPercent) maxPercent = value;
      }
    });
  });

  return maxPercent;
}

// 악세서리(목걸이/귀걸이/반지)의 "아군 공격력 강화" % 합산
function getAccessoryAllyAttackBuffPercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => ['목걸이', '귀걸이', '반지'].includes(it.Type)).forEach((it) => {
    const text = parseTooltip(it.Tooltip).join(' ');
    total += extractPercent(text, '아군 공격력 강화');
  });
  return total;
}

// 6개 코어 전체의 "아군 공격력 강화" % 합산 (활성화된 [XXP] 구간만)
function getAllyAttackBuffFromArkgridCores(arkgridData) {
  let total = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      total += sumCoreSegments(segments, '아군 공격력 강화').percent;
    });
  }
  return total;
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[아군 공격 강화] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsAllyAttackBuffLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[아군\s*공격\s*강화\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.13% = 아크그리드 젬의 아군 공격력 강화 % (API 표시값의 절삭 오차 제거)
function getAllArkgridGemsAllyAttackBuffPercent(arkgridData) {
  return getAllArkgridGemsAllyAttackBuffLevel(arkgridData) * 0.13;
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[아군 피해 강화] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsAllyDamageBuffLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[아군\s*피해\s*강화\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.0525% = 아크그리드 젬의 아군 피해량 강화 % (API 표시값의 절삭 오차 제거)
function getAllArkgridGemsAllyDamageBuffPercent(arkgridData) {
  return getAllArkgridGemsAllyDamageBuffLevel(arkgridData) * 0.0525;
}

// 팔찌+악세+아크그리드(코어/젬)+아크패시브(선각자22+기원22, 고정) 전체의 아군 공격력 강화 % 총합
function getTotalAllyAttackBuffPercent(equipmentList, braceletOptions, arkgridData) {
  const ARKPASSIVE_FIXED = 44; // 선각자 22 + 기원 22
  return (
    (braceletOptions?.allyAttackBuffPercent || 0) +
    getAccessoryAllyAttackBuffPercent(equipmentList) +
    getAllyAttackBuffFromArkgridCores(arkgridData) +
    getAllArkgridGemsAllyAttackBuffPercent(arkgridData) +
    ARKPASSIVE_FIXED
  );
}


// 서포터 버프력 = 기본공격력 × 0.22 × (1 + (아공강% + 겁화보석%)/100) × 공증유효율
function calculateSupportBuffPower(basePower, allyAttackBuffPercent, buffGemPercent, effectiveRatio) {
  return basePower * 0.22 * (1 + (allyAttackBuffPercent + buffGemPercent) / 100) * effectiveRatio;
}

// 최종 데미지 = (기본공격력 + 악세공격력고정 + 코어공격력고정 + 서포터버프력) × (1+(코어%+귀걸이%+젬%+아드레날린보너스+아크패시브상시버프공격력%)/100) × (1+시너지_공격력증가%/100)
// 시너지_공격력증가(기공사/스카우터 6%)는 딜러 본인 직업이 해당될 때만 자동 반영되는 값 — SYNERGY_ATTACK_POWER_CLASSES 참고
function calculateFinalDamage(basePower, accessoryFlat, coreFlat, supportBuffPower, corePercent, earringPercent, gemPercent, adrenalineBonus, classSynergyAttackPercent, arkPassiveAttackPercent) {
  const flatTotal = basePower + accessoryFlat + coreFlat + supportBuffPower;
  const percentSum = corePercent + earringPercent + gemPercent + (adrenalineBonus || 0) + (arkPassiveAttackPercent || 0);
  return flatTotal * toMultiplier(percentSum) * toMultiplier(classSynergyAttackPercent || 0);
}

// 캐릭터 데이터(profiles, equipment, arkgrid, arkpassive, gems, avatars) 하나를 받아서
// 무기공격력 → 순수공격력 → 기본공격력 → 스탯창공격력까지 전부 계산해서 객체로 반환
function calculateCharacterStats(data) {
  const weaponItem = (data.equipment || []).find((item) => item.Type === '무기');
  if (!weaponItem) return null;

  const levelMatch = stripHtml(weaponItem.Name).match(/\+(\d+)/);
  const weaponLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;

  const braceletItem = (data.equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const braceletOptions = parseBraceletOptions(braceletText);
  const braceletFlat = braceletOptions.weaponAttackFlat;

  const earringWeaponPercent = getEarringWeaponAttackPercent(data.equipment);

  let coreFlat = 0;
  let corePercentWeapon = 0;
  if (data.arkgrid && data.arkgrid.Slots) {
    const chaosStarSlot = data.arkgrid.Slots.find((s) => s.Name.includes('혼돈의 별 코어'));
    if (chaosStarSlot) {
      const raw = getCoreOptionText(chaosStarSlot.Tooltip);
      const segments = getActivatedCoreSegments(raw, chaosStarSlot.Point);
      const sums = sumCoreSegments(segments, '무기 공격력');
      coreFlat = sums.flat;
      corePercentWeapon = sums.percent;
    }
  }

  const enlightenmentLevel = getArkPassiveLevelFromData(data.arkpassive, '깨달음');
  const enlightenmentPercent = enlightenmentWeaponAttackPercent(enlightenmentLevel);

  const wanjibStats = getWanjibStats(data.equipment);

  const flatBonusSum = braceletFlat + coreFlat + wanjibStats.weaponAttackFlat;
  const percentBonusSum = earringWeaponPercent + corePercentWeapon + enlightenmentPercent;
  const weaponAttack = calculateWeaponAttack(weaponLevel, flatBonusSum, percentBonusSum);
  const weaponAttackBreakdown = {
    무기_강화단계: weaponLevel,
    강화단계_기본값: WEAPON_LEVEL_TABLE[weaponLevel] || 0,
    팔찌_고정: braceletFlat,
    아크그리드코어_고정: coreFlat,
    완갑_고정: wanjibStats.weaponAttackFlat,
    귀걸이_퍼센트: earringWeaponPercent,
    아크그리드코어_퍼센트: corePercentWeapon,
    깨달음_퍼센트: enlightenmentPercent,
  };

  const armorPrimaryStatFlat = getArmorPrimaryStatFlat(data.equipment);
  const primaryStat = getMaxPrimaryStat(data.equipment, braceletText, data.avatars, wanjibStats.primaryStatFlat + armorPrimaryStatFlat);
  const purePower = calculatePureAttackPower(primaryStat, weaponAttack);

  const gemPercent = getGemsBaseAttackPercent(data.gems);
  const stonePercent = getAbilityStoneBaseAttackPercent(data.equipment);
  const basePower = calculateBaseAttackPower(purePower, gemPercent, stonePercent + wanjibStats.baseAttackPercent) + wanjibStats.baseAttackFlat;

  const accessoryAttackFlat = getAccessoryAttackFlat(data.equipment);
  const chaosCoreAttack = getChaosStarCoreAttack(data.arkgrid);
  const earringAttackPercent = getEarringAttackPercent(data.equipment);
  const arkgridGemsAttackPercent = getAllArkgridGemsAttackPercent(data.arkgrid);
  const statWindowAttack = calculateStatWindowAttackPower(
    basePower, accessoryAttackFlat, chaosCoreAttack.flat, chaosCoreAttack.percent,
    earringAttackPercent, arkgridGemsAttackPercent
  );

  return {
    characterName: data.profiles.CharacterName,
    serverName: data.profiles.ServerName,
    className: data.profiles.CharacterClassName,
    weaponAttack, weaponAttackBreakdown, primaryStat, purePower, basePower,
    accessoryAttackFlat, chaosCoreAttack, earringAttackPercent, arkgridGemsAttackPercent,
    statWindowAttack,
    wanjibStats, armorPrimaryStatFlat,
    braceletOptions,
  };
}

// 각인 목록(engravings 응답) 안에 "아드레날린" 각인이 있는지 확인
function hasAdrenalineEngraving(engravingsData) {
  if (!engravingsData) return false;
  return JSON.stringify(engravingsData).includes('아드레날린');
}

// 어빌리티 스톤 "아드레날린" 효과의 1중첩당 공격력 증가% (사용자 실측표) — 실제로는 최대 6중첩까지
// 쌓이므로(다른 어빌리티 스톤 각인 효과들이 "상시 발동" 가정으로 최댓값을 쓰는 것과 같은 컨벤션),
// 최종적으로 쓰는 ADRENALINE_STONE_BONUS는 이 값에 ×6을 적용한 최대 중첩 기준 수치다.
const ADRENALINE_STONE_BONUS_PER_STACK = { 1: 0.48, 2: 0.60, 3: 0.83, 4: 0.95 };
const ADRENALINE_STONE_MAX_STACK = 6;
const ADRENALINE_STONE_BONUS = Object.fromEntries(
  Object.entries(ADRENALINE_STONE_BONUS_PER_STACK).map(([level, v]) => [level, v * ADRENALINE_STONE_MAX_STACK])
);

// 어빌리티 스톤의 "무작위 각인 효과"에서 "아드레날린 Lv.N"을 찾아 대응하는 보너스 % 반환
function getAdrenalineStoneBonus(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return 0;

  try {
    const obj = JSON.parse(stone.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'IndentStringGroup' && el.value) {
        for (const groupKey of Object.keys(el.value)) {
          const group = el.value[groupKey];
          const contentStr = group.contentStr;
          if (!contentStr) continue;
          for (const itemKey of Object.keys(contentStr)) {
            const line = stripHtml(contentStr[itemKey].contentStr || '');
            if (line.includes('아드레날린')) {
              const match = line.match(/Lv\.(\d)/);
              if (match) return ADRENALINE_STONE_BONUS[parseInt(match[1], 10)] || 0;
            }
          }
        }
      }
    }
  } catch (e) {}

  return 0;
}

// "치명타(로/론)? (적중)? 시 적에게 주는 피해가 X%" 패턴 합산 (곱연산용)
function extractCritOnHitDamagePercent(text) {
  if (!text) return 0;
  const regex = /치명타(?:로|론)?\s*(?:적중\s*)?시\s*적에게\s*주는\s*피해가\s*([\d.]+)\s*%/g;
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    total += parseFloat(m[1]);
  }
  return total;
}

// arkpassive Effects 배열에서 특정 카테고리(진화/깨달음)의 텍스트를 전부 이어붙여 반환
function getArkPassiveEffectsText(arkpassiveData, category) {
  if (!arkpassiveData || !arkpassiveData.Effects) return '';
  return arkpassiveData.Effects
    .filter((e) => e.Name === category)
    .map((e) => {
      try {
        const obj = JSON.parse(e.ToolTip);
        return obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
      } catch (err) {
        return '';
      }
    })
    .join(' ');
}

// arkpassive Effects 배열에서 특정 카테고리 텍스트를 이어붙이되, 이름에 특정 단어가 포함된 항목은 제외
function getArkPassiveEffectsTextExcluding(arkpassiveData, category, excludeWord) {
  if (!arkpassiveData || !arkpassiveData.Effects) return '';
  return arkpassiveData.Effects
    .filter((e) => e.Name === category && !(e.Description || '').includes(excludeWord))
    .map((e) => {
      try {
        const obj = JSON.parse(e.ToolTip);
        return obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
      } catch (err) {
        return '';
      }
    })
    .join(' ');
}

// arkpassive Effects 배열에서 특정 카테고리 텍스트를 전부 이어붙여 반환 (조건부/시간제한 텍스트도 일단 포함 —
// 어떤 노드를 예외로 뺄지는 사용자가 클래스별로 직접 정리해서 알려줄 예정이라, 그 전까지는 전부 포함해서 계산)
function getArkPassivePersistentEffectsText(arkpassiveData, category, excludeWord) {
  if (!arkpassiveData || !arkpassiveData.Effects) return '';
  return arkpassiveData.Effects
    .filter((e) => e.Name === category && !(excludeWord && (e.Description || '').includes(excludeWord)))
    .map((e) => {
      try {
        const obj = JSON.parse(e.ToolTip);
        return obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
      } catch (err) {
        return '';
      }
    })
    .join(' ');
}

// 아크패시브(진화+깨달음)의 공격력 % 합산 ("무기 공격력"과는 별개). 조건부/시간제한 노드도 일단 포함 —
// 클래스별 제외 목록이 정리되면 excludeWord 등으로 빼는 방식으로 다듬을 예정.
function getArkPassivePersistentAttackPercent(arkpassiveData) {
  const evo = getArkPassivePersistentEffectsText(arkpassiveData, '진화');
  const real = getArkPassivePersistentEffectsText(arkpassiveData, '깨달음');
  return extractPercentMaxSequenceExcluding(evo, '공격력', '무기 공격력') + extractPercentMaxSequenceExcluding(real, '공격력', '무기 공격력');
}

// 아크패시브(진화+깨달음)의 "적에게 주는 피해" % 합산. 조건부/시간제한 노드도 일단 포함.
function getArkPassivePersistentEnemyDamagePercent(arkpassiveData) {
  const evo = getArkPassivePersistentEffectsText(arkpassiveData, '진화');
  const real = getArkPassivePersistentEffectsText(arkpassiveData, '깨달음');
  return extractEnemyDamageAllPercent(evo) + extractEnemyDamageAllPercent(real);
}

// 아크패시브(진화+깨달음)의 추가 피해 % 합산 ('달인'은 이미 getMasterExtraDamagePercent에서
// 고정 8.5%로 별도 처리되므로 중복 방지를 위해 '진화'에서 제외). 조건부/시간제한 노드도 일단 포함.
function getArkPassivePersistentExtraDamagePercent(arkpassiveData) {
  const evo = getArkPassivePersistentEffectsText(arkpassiveData, '진화', '달인');
  const real = getArkPassivePersistentEffectsText(arkpassiveData, '깨달음');
  return extractPercentMaxSequence(evo, '추가 피해') + extractPercentMaxSequence(real, '추가 피해');
}

// arkpassive Effects 배열에 특정 단어가 포함된 효과를 채용했는지 확인
function hasArkPassiveEffect(arkpassiveData, word) {
  if (!arkpassiveData || !arkpassiveData.Effects) return false;
  return arkpassiveData.Effects.some((e) => (e.Description || '').includes(word));
}

// 아크패시브(진화+깨달음)의 치명타 적중률 % 합산 ('달인'은 최대 5중첩 고정 7%로 별도 처리)
function getArkPassiveCritRatePercent(arkpassiveData) {
  const evo = getArkPassiveEffectsTextExcluding(arkpassiveData, '진화', '달인');
  const real = getArkPassiveEffectsText(arkpassiveData, '깨달음');
  const masterBonus = hasArkPassiveEffect(arkpassiveData, '달인') ? 7 : 0;
  return extractPercent(evo, '치명타 적중률') + extractPercent(real, '치명타 적중률') + masterBonus;
}

// 아크패시브(진화)의 치명타 피해 % 합산
function getArkPassiveCritDamagePercent(arkpassiveData) {
  return extractPercent(getArkPassiveEffectsText(arkpassiveData, '진화'), '치명타 피해');
}

// 아크패시브(진화/깨달음)의 "치명타 시 적에게 주는 피해" 곱연산 %(각각 반환)
function getArkPassiveCritOnHitPercent(arkpassiveData) {
  return {
    evolution: extractCritOnHitDamagePercent(getArkPassiveEffectsText(arkpassiveData, '진화')),
    realization: extractCritOnHitDamagePercent(getArkPassiveEffectsText(arkpassiveData, '깨달음')),
  };
}

// 치명 스탯값 → 치명타 적중률 %로 환산 (27.9440당 1%)
function critStatToRatePercent(critStat) {
  return (critStat || 0) / 27.9440;
}

// profiles.Stats 배열에서 특정 Type(예: '치명')의 Value를 찾아 반환
function getStatValueFromProfile(profilesData, statType) {
  if (!profilesData || !profilesData.Stats) return 0;
  const stat = profilesData.Stats.find((s) => s.Type === statType);
  return stat ? parseFloat(stat.Value) || 0 : 0;
}

// 반지의 치명타 적중률 / 치명타 피해 % 합산 (목걸이·귀걸이 제외, 반지만)
function getRingCritRatePercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '반지').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '치명타 적중률');
  });
  return total;
}
function getRingCritDamagePercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '반지').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '치명타 피해');
  });
  return total;
}

// engravings(ArkPassiveEffects)에서 "예리한 둔기" 기본 효과의 치명타 피해 % 추출
function getSharpWeaponCritDamagePercent(engravingsData) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return 0;
  const eng = engravingsData.ArkPassiveEffects.find((e) => e.Name === '예리한 둔기');
  return eng ? extractPercent(stripHtml(eng.Description), '치명타 피해량') : 0;
}

// 예리한 둔기 어빌리티 스톤 장착 효과 고정표
const SHARP_WEAPON_STONE_BONUS = { 1: 7.5, 2: 9.4, 3: 13.2, 4: 15.0 };
function getSharpWeaponStoneBonus(engravingsData) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return 0;
  const eng = engravingsData.ArkPassiveEffects.find((e) => e.Name === '예리한 둔기');
  if (!eng || !eng.AbilityStoneLevel) return 0;
  return SHARP_WEAPON_STONE_BONUS[eng.AbilityStoneLevel] || 0;
}

// 어빌리티 스톤 "무작위 각인 효과"의 각인별 레벨(1~4)당 추가 보너스 — 사용자가 실측해서 정리해준 표
// (아드레날린/예리한 둔기는 위의 ADRENALINE_STONE_BONUS/SHARP_WEAPON_STONE_BONUS와 동일 수치로 이미
// 반영 중이라 여기서는 제외 — 중복 방지). method:
// - 'enemyDamage': 적주피%(곱연산, 조건부인 것들은 기존 컨벤션대로 "상시 발동" 가정)
// - 'critRate': 치명타 적중률%(합연산)
// 돌격대장은 "이동속도 증가량의 X%" → 적주피 전환 공식(이동속도 40% 고정 가정, getChargeCaptainEnemyDamagePercent
// 참고)을 거쳐야 하므로, 원래 값(7.5/9.4/13.2/15)에 미리 ×0.4를 적용해서 적주피% 단위로 저장.
const ABILITY_STONE_ENGRAVING_CATALOG = {
  '결투의 대가': { method: 'enemyDamage', levels: [2.7, 3.4, 4.7, 5.4] },
  '기습의 대가': { method: 'enemyDamage', levels: [2.7, 3.4, 4.7, 5.4] },
  '달인의 저력': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '바리케이드': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '속전속결': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '슈퍼 차지': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '안정된 상태': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '원한': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '저주받은 인형': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '질량 증가': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '타격의 대가': { method: 'enemyDamage', levels: [3, 3.75, 5.25, 6] },
  '마나 효율 증가': { method: 'enemyDamage', levels: [3.0, 3.75, 5.25, 6.0] },
  '돌격대장': { method: 'enemyDamage', levels: [3.0, 3.76, 5.28, 6.0] },
  '정밀 단도': { method: 'critRate', levels: [3, 3.75, 5.25, 6] },
};

// 실제 착용 중인 어빌리티 스톤의 각인 효과(ArkPassiveEffects의 AbilityStoneLevel)를 ABILITY_STONE_ENGRAVING_CATALOG로
// 환산해서 method별로 합산 — 아드레날린/예리한 둔기는 별도 함수로 이미 처리되므로 여기선 제외.
function getAbilityStoneOtherEngravingBonus(engravingsData) {
  const result = { enemyDamagePercent: 0, critRatePercent: 0 };
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return result;
  engravingsData.ArkPassiveEffects.forEach((eng) => {
    const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG[eng.Name];
    if (!catalogEntry || !eng.AbilityStoneLevel) return;
    const value = catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0;
    if (catalogEntry.method === 'enemyDamage') result.enemyDamagePercent += value;
    if (catalogEntry.method === 'critRate') result.critRatePercent += value;
  });
  return result;
}

// 어빌리티 스톤 "레벨 보너스"의 치명타 피해 % (기존 getAbilityStoneBaseAttackPercent와 같은 구조)
function getAbilityStoneCritDamagePercent(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return 0;
  try {
    const obj = JSON.parse(stone.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'IndentStringGroup' && el.value) {
        for (const groupKey of Object.keys(el.value)) {
          const contentStr = el.value[groupKey].contentStr;
          if (!contentStr) continue;
          for (const itemKey of Object.keys(contentStr)) {
            const line = stripHtml(contentStr[itemKey].contentStr || '');
            if (line.includes('레벨 보너스')) {
              const match = line.match(/치명타\s*피해\s*\+?([\d.]+)\s*%/);
              if (match) return parseFloat(match[1]);
            }
          }
        }
      }
    }
  } catch (e) {}
  return 0;
}

// 6개 코어 전체(활성화된 구간만)에서 치명타 적중률/피해/곱연산% 각각 합산
function getArkgridCritOptions(arkgridData) {
  const result = { critRatePercent: 0, critDamagePercent: 0, critOnHitPercent: 0 };
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      segments.forEach((seg) => {
        result.critRatePercent += extractPercent(seg, '치명타 적중률');
        result.critDamagePercent += extractPercent(seg, '치명타 피해');
        result.critOnHitPercent += extractCritOnHitDamagePercent(seg);
      });
    });
  }
  return result;
}

// 어빌리티 스톤의 "아드레날린 Lv.N" 레벨만 반환 (getAdrenalineStoneBonus와 같은 파싱, 레벨 자체가 필요할 때 사용)
function getAdrenalineStoneLevel(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return 0;
  try {
    const obj = JSON.parse(stone.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'IndentStringGroup' && el.value) {
        for (const groupKey of Object.keys(el.value)) {
          const contentStr = el.value[groupKey].contentStr;
          if (!contentStr) continue;
          for (const itemKey of Object.keys(contentStr)) {
            const line = stripHtml(contentStr[itemKey].contentStr || '');
            if (line.includes('아드레날린')) {
              const match = line.match(/Lv\.(\d)/);
              if (match) return parseInt(match[1], 10);
            }
          }
        }
      }
    }
  } catch (e) {}
  return 0;
}

// engravings.ArkPassiveEffects 배열에서 특정 각인 이름의 정보를 찾아 반환
function getArkPassiveEffectByName(engravingsData, name) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return null;
  return engravingsData.ArkPassiveEffects.find((e) => e.Name === name) || null;
}

// 아드레날린 각인 자체의 Level(1~4)을 반환 (어빌리티 스톤 레벨 아님)
function getAdrenalineEngravingLevel(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '아드레날린');
  return eng ? (eng.Level || 0) : 0;
}

// 아드레날린 레벨 → 치명타 적중률 보너스 (14 + 레벨×1.5, 최대 20)
function adrenalineCritRateBonus(level) {
  if (!level) return 0;
  return Math.min(14 + level * 1.5, 20);
}

// 딜러+서포터 데이터를 받아 치명타 적중률/피해/평균 피해 배율까지 전부 계산 (항목별 breakdown 포함)
function calculateCritMultiplier(dealerData, supportData, options) {
  const equipment = dealerData.equipment;
  const className = dealerData.profiles ? dealerData.profiles.CharacterClassName : '';
  const partyClassNames = [className, ...((options && options.partyClassNames) || [])];
  const autoSameolType = getAutoSameolType(dealerData.arkpassive);
  const braceletItem = (equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const dealerBracelet = parseBraceletOptions(braceletText);

  const supportBraceletItem = (supportData.equipment || []).find((it) => it.Type === '팔찌');
  const supportBraceletText = supportBraceletItem ? parseTooltip(supportBraceletItem.Tooltip).join(' ') : '';
  const supportBracelet = parseBraceletOptions(supportBraceletText);

  const adrenalineLevel = getAdrenalineEngravingLevel(dealerData.engravings);
  const adrenalineCritRate = adrenalineCritRateBonus(adrenalineLevel);

  const arkPassiveCritRate = getArkPassiveCritRatePercent(dealerData.arkpassive);
  const ringCritRate = getRingCritRatePercent(equipment);
  const critStatRate = critStatToRatePercent(getStatValueFromProfile(dealerData.profiles, '치명'));

  const critRateBreakdown = {
    아드레날린: adrenalineCritRate,
    아크패시브: arkPassiveCritRate,
    반지: ringCritRate,
    딜러팔찌: dealerBracelet.critRatePercent,
    서폿팔찌_치적저항감소: supportBracelet.critResistReductionPercent,
    치명스탯: critStatRate,
    백사멸: autoSameolType === 'back' ? 10 : 0,
    시너지_파티직업: sumPartySynergyPercent(partyClassNames, SYNERGY_CRIT_RATE_CLASSES, SYNERGY_CRIT_RATE_PERCENT),
    어빌리티스톤_각인보너스_정밀단도: getAbilityStoneOtherEngravingBonus(dealerData.engravings).critRatePercent,
  };
  const critRatePercent = Object.values(critRateBreakdown).reduce((a, b) => a + b, 0);

  const arkgridCrit = getArkgridCritOptions(dealerData.arkgrid);
  const arkPassiveCritDmg = getArkPassiveCritDamagePercent(dealerData.arkpassive);
  const sharpWeaponDmg = getSharpWeaponCritDamagePercent(dealerData.engravings);
  const ringCritDmg = getRingCritDamagePercent(equipment);
  const stoneLevelBonusDmg = getAbilityStoneCritDamagePercent(equipment);
  const sharpWeaponStoneDmg = getSharpWeaponStoneBonus(dealerData.engravings);

  const critDamageBreakdown = {
    아크패시브: arkPassiveCritDmg,
    예리한둔기_각인_최종값: sharpWeaponDmg,
    반지: ringCritDmg,
    스톤_레벨보너스: stoneLevelBonusDmg,
    스톤_예리한둔기_전용보너스: sharpWeaponStoneDmg,
    딜러팔찌: dealerBracelet.critDamagePercent,
    아크그리드: arkgridCrit.critDamagePercent,
  };
  const critDamagePercent = Object.values(critDamageBreakdown).reduce((a, b) => a + b, 0);

  const arkPassiveOnHit = getArkPassiveCritOnHitPercent(dealerData.arkpassive);
  const onHitBreakdown = {
    아크패시브_진화: arkPassiveOnHit.evolution,
    아크패시브_깨달음: arkPassiveOnHit.realization,
    딜러팔찌: dealerBracelet.critHitExtraDamagePercent,
    서폿팔찌: supportBracelet.critDmgResistReductionPercent,
    아크그리드: arkgridCrit.critOnHitPercent,
  };
  let onHitMultiplier = 1;
  Object.values(onHitBreakdown).forEach((p) => { onHitMultiplier *= toMultiplier(p); });

  // '뭉툭한 가시' 채용 시 표시용 치명타 적중률(critRatePercent)은 그대로 두되, 실제 치명타 발동
  // 기댓값 계산에는 임계값(보통 80%) 상한을 적용 — 초과분은 진화형 피해로 전환되어 이미 반영되므로
  // (calculateEnemyDamageMultiplier의 뭉툭한가시_전환보너스 참고) 여기서 그대로 쓰면 이중 반영된다.
  const bluntThornCritRateCapPercent = getBluntThornCritRateCapPercent(dealerData.arkpassive);
  const effectiveCritRatePercent = bluntThornCritRateCapPercent !== null
    ? Math.min(critRatePercent, bluntThornCritRateCapPercent)
    : critRatePercent;
  const rate = Math.min(effectiveCritRatePercent, 100) / 100;
  const critDamageMultiplier = (1 - rate) + rate * toMultiplier(critDamagePercent) * onHitMultiplier;
  const sharpWeaponPenalty = getSharpWeaponDamagePenaltyMultiplier(dealerData.engravings);
  const classSynergyCritDamagePercent = sumPartySynergyPercent(partyClassNames, SYNERGY_CRIT_DAMAGE_CLASSES, SYNERGY_CRIT_DAMAGE_PERCENT);
  const avgDamageMultiplier = critDamageMultiplier * sharpWeaponPenalty * toMultiplier(classSynergyCritDamagePercent);

  return {
    critRatePercent, critDamagePercent, avgDamageMultiplier,
    critRateBreakdown, critDamageBreakdown, onHitBreakdown,
    sharpWeaponPenalty,
    시너지_치명타시피해량: classSynergyCritDamagePercent,
    자동감지_사멸타입: autoSameolType,
    뭉툭한가시_치명타발동상한: bluntThornCritRateCapPercent,
  };
}


// 무기 품질(70~100) → 추가 피해 % 변환표
const WEAPON_QUALITY_EXTRA_DAMAGE_TABLE = {
  70: 19.80, 71: 20.08, 72: 20.37, 73: 20.66, 74: 20.95,
  75: 21.25, 76: 21.55, 77: 21.86, 78: 22.17, 79: 22.48,
  80: 22.80, 81: 23.12, 82: 23.45, 83: 23.78, 84: 24.11,
  85: 24.45, 86: 24.79, 87: 25.14, 88: 25.49, 89: 25.84,
  90: 26.20, 91: 26.56, 92: 26.93, 93: 27.30, 94: 27.67,
  95: 28.05, 96: 28.43, 97: 28.82, 98: 29.21, 99: 29.60,
  100: 30.00,
};

// 무기 아이템 Tooltip에서 qualityValue(품질) 추출
function getWeaponQuality(equipmentList) {
  const weapon = (equipmentList || []).find((it) => it.Type === '무기');
  if (!weapon) return null;
  try {
    const obj = JSON.parse(weapon.Tooltip);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.type === 'ItemTitle' && el.value && el.value.qualityValue !== undefined) {
        return el.value.qualityValue;
      }
    }
  } catch (e) {}
  return null;
}

// 무기 품질 → 추가 피해 % (70 미만이면 null 반환, "표시 불가" 처리용)
function getWeaponQualityExtraDamagePercent(equipmentList) {
  const quality = getWeaponQuality(equipmentList);
  if (quality === null || quality < 70) return null;
  return WEAPON_QUALITY_EXTRA_DAMAGE_TABLE[quality] ?? null;
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[추가 피해] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsExtraDamageLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[추가\s*피해\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.080834% = 아크그리드 젬의 추가 피해 %
function getAllArkgridGemsExtraDamagePercent(arkgridData) {
  const level = getAllArkgridGemsExtraDamageLevel(arkgridData);
  return level * 0.080834;
}

// 악세서리(목걸이)의 "추가 피해" % 합산
function getNecklaceExtraDamagePercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '목걸이').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '추가 피해');
  });
  return total;
}

// engravings(ArkPassiveEffects)에서 "기습의 대가"/"결투의 대가"의
// "백/헤드어택 성공 시 피해량이 추가로 Y% 증가" 부분만 합산 (적에게 주는 피해 X%는 제외)
function getBackHeadAttackExtraDamagePercent(engravingsData) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return 0;
  const targets = ['기습의 대가', '결투의 대가'];
  let total = 0;
  engravingsData.ArkPassiveEffects.forEach((eng) => {
    if (!targets.includes(eng.Name)) return;
    const text = stripHtml(eng.Description || '');
    const match = text.match(/(?:백어택|헤드어택)[^.]*성공\s*시\s*피해량이\s*추가로\s*([\d.]+)\s*%\s*증가/);
    if (match) total += parseFloat(match[1]);
  });
  return total;
}

// 아크패시브(진화)에 '달인'을 채용했는지 확인해 추가 피해 8.5% 반환
function getMasterExtraDamagePercent(arkpassiveData) {
  return hasArkPassiveEffect(arkpassiveData, '달인') ? 8.5 : 0;
}

// 추가 피해 배율 = 1(펫도감 고정) + Σ(각 출처 %)/100, breakdown 포함
function calculateExtraDamageMultiplier(dealerData) {
  const equipment = dealerData.equipment;
  const braceletItem = (equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const dealerBracelet = parseBraceletOptions(braceletText);

  const weaponQuality = getWeaponQualityExtraDamagePercent(equipment);

  const extraDamageBreakdown = {
    펫도감: 1,
    무기품질: weaponQuality,
    목걸이: getNecklaceExtraDamagePercent(equipment),
    아크그리드젬: getAllArkgridGemsExtraDamagePercent(dealerData.arkgrid),
    딜러팔찌: dealerBracelet.additionalDamagePercent,
    달인: getMasterExtraDamagePercent(dealerData.arkpassive),
    각인_기습결투: getBackHeadAttackExtraDamagePercent(dealerData.engravings),
    아크패시브_상시버프: getArkPassivePersistentExtraDamagePercent(dealerData.arkpassive),
  };

  const qualityTooLow = weaponQuality === null;
  const sumPercent = Object.values(extraDamageBreakdown).reduce((a, b) => a + (b || 0), 0);
  const multiplier = 1 + sumPercent / 100;

  return { multiplier, extraDamageBreakdown, qualityTooLow };
}

// 예리한 둔기 채용 시 "일정 확률(10%)로 20% 감소된 피해"의 기댓값 배율
// 확률과 감소율은 고정값으로 가정 (실제 각인 효과는 확률 표기가 없어 10%로 고정)
function getSharpWeaponDamagePenaltyMultiplier(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '예리한 둔기');
  if (!eng) return 1;
  const PROBABILITY = 0.10;
  const REDUCTION = 0.20;
  return 1 - PROBABILITY * REDUCTION;
}

// 각인 Description에서 적에게 주는 피해 증가 % 추출 (범용)
// - "받는 피해" 문구는 제외 (패널티이므로)
// - 백/헤드어택 성공 시 추가 보너스 문구는 제외 (추가 피해 쪽에서 이미 사용)
// - 이동속도 기반(돌격대장) 문구는 제외 (별도 공식으로 처리)
function extractEngravingEnemyDamagePercent(description) {
  if (!description) return 0;
  let text = stripHtml(description);

  text = text.replace(/받는\s*피해가\s*[\d.]+\s*%\s*(증가|감소)/g, '');
  text = text.replace(/(?:백어택|헤드어택)[^.]*성공\s*시\s*피해량이\s*추가로\s*[\d.]+\s*%\s*증가/g, '');
  text = text.replace(/이동속도\s*증가량의\s*[\d.]+\s*%[^.]*\./g, '');
  text = text.replace(/치명타\s*피해량이\s*[\d.]+\s*%[^.]*\./g, '');

  let total = 0;
  const matches = text.matchAll(/(?:주는\s*피해|피해량|피해)(?:가|이)?\s*([\d.]+)\s*%\s*증가/g);
  for (const m of matches) {
    total += parseFloat(m[1]);
  }
  return total;
}

// 딜러의 모든 각인(ArkPassiveEffects)을 이름별로 그룹핑해서 적에게 주는 피해 % 합산 (같은 이름끼리 합연산)
// 돌격대장은 별도 공식(이동속도 기반)으로 처리하므로 여기선 제외
function getEngravingEnemyDamageByName(engravingsData) {
  const result = {};
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return result;

  engravingsData.ArkPassiveEffects.forEach((eng) => {
    if (eng.Name === '돌격대장') return;
    const percent = extractEngravingEnemyDamagePercent(eng.Description);
    if (percent > 0) {
      result[eng.Name] = (result[eng.Name] || 0) + percent;
    }
  });
  return result;
}

// 돌격대장의 "이동속도 증가량의 X%" → 실제 적주피 % (이동속도 40% 고정 가정)
function getChargeCaptainEnemyDamagePercent(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '돌격대장');
  if (!eng) return 0;
  const text = stripHtml(eng.Description || '');
  const m = text.match(/이동속도\s*증가량의\s*([\d.]+)\s*%/);
  if (!m) return 0;
  const MOVE_SPEED_FIXED = 40;
  return (parseFloat(m[1]) * MOVE_SPEED_FIXED) / 100;
}

// 각인 전체(돌격대장 포함)의 적에게 주는 피해 곱연산 배율
// 같은 이름 각인끼리는 이미 합산되어 있고(그룹별), 이름이 다른 각인끼리는 여기서 곱연산
function getEngravingEnemyDamageMultiplier(engravingsData) {
  const byName = getEngravingEnemyDamageByName(engravingsData);
  let multiplier = 1;
  Object.values(byName).forEach((p) => { multiplier *= toMultiplier(p); });

  const chargeCaptainPercent = getChargeCaptainEnemyDamagePercent(engravingsData);
  multiplier *= toMultiplier(chargeCaptainPercent);

  return { multiplier, byName, chargeCaptainPercent };
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[보스 피해] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsBossDamageLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[보스\s*피해\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.08334% = 아크그리드 젬의 보스 피해 %
function getAllArkgridGemsBossDamagePercent(arkgridData) {
  const level = getAllArkgridGemsBossDamageLevel(arkgridData);
  return level * 0.08334;
}

// 툴팁 JSON에서 "코어 타입" 이름표가 붙은 항목(예: "혼돈 - 해")을 찾아서 반환
function getCoreTypeText(tooltipStr) {
  try {
    const obj = JSON.parse(tooltipStr);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (el && el.value && typeof el.value === 'object' && el.value.Element_000) {
        const label = stripHtml(el.value.Element_000);
        if (label.includes('코어 타입')) {
          return stripHtml(el.value.Element_001 || '');
        }
      }
    }
  } catch (e) {}
  return '';
}

// 코어 구간 텍스트에서 "치명타 시 적에게 주는 피해" 문구를 제외하고
// 순수 "적에게 주는 피해" %만 추출 (혼돈 코어 적주피 계산 전용)
function extractChaosCoreEnemyDamagePercent(segmentText) {
  if (!segmentText) return 0;
  const cleaned = segmentText.replace(/치명타\s*시\s*적에게\s*주는\s*피해가\s*[\d.]+\s*%[^.]*\./g, '');
  return extractPercent(cleaned, '적에게 주는 피해');
}

// 혼돈 코어들 각각의 "적에게 주는 피해" % (활성화된 구간만, 치명타 조건부 제외), 코어 이름별로 반환
function getChaosCoreEnemyDamageByCore(arkgridData) {
  const result = {};
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const typeText = getCoreTypeText(slot.Tooltip);
      if (!typeText.includes('혼돈')) return;
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      let percent = 0;
      segments.forEach((seg) => {
        percent += extractChaosCoreEnemyDamagePercent(seg);
      });
      if (percent > 0) result[slot.Name] = (result[slot.Name] || 0) + percent;
    });
  }
  return result;
}

// 혼돈 코어들의 적에게 주는 피해 곱연산 배율
function getChaosCoreEnemyDamageMultiplier(arkgridData) {
  const byCore = getChaosCoreEnemyDamageByCore(arkgridData);
  let multiplier = 1;
  Object.values(byCore).forEach((p) => { multiplier *= toMultiplier(p); });
  return { multiplier, byCore };
}

// 질서 코어를 해/달/별 그룹별로 찾아, 18P/19P/20P 각 구간을 넘을 때마다 고정 0.15%씩 합산
function getOrderCoreEnemyDamageByGroup(arkgridData) {
  const result = { 해: 0, 달: 0, 별: 0 };
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const typeText = getCoreTypeText(slot.Tooltip);
      if (!typeText.includes('질서')) return;
      const point = slot.Point || 0;
      let percent = 0;
      if (point >= 18) percent += 0.15;
      if (point >= 19) percent += 0.15;
      if (point >= 20) percent += 0.15;
      if (percent === 0) return;
      if (typeText.includes('해')) result.해 += percent;
      else if (typeText.includes('달')) result.달 += percent;
      else if (typeText.includes('별')) result.별 += percent;
    });
  }
  return result;
}

// 질서 코어 해/달/별 그룹간 곱연산 배율
function getOrderCoreEnemyDamageMultiplier(arkgridData) {
  const byGroup = getOrderCoreEnemyDamageByGroup(arkgridData);
  const multiplier = toMultiplier(byGroup.해) * toMultiplier(byGroup.달) * toMultiplier(byGroup.별);
  return { multiplier, byGroup };
}

// 목걸이의 "적에게 주는 피해" % 합산
function getNecklaceEnemyDamagePercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '목걸이').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '적에게 주는 피해');
  });
  return total;
}

// "진화형 피해(가) X% 증가" 형태만 정확히 잡는 전용 추출 함수 (조사 생략 대응)
// ("~최대 X%까지 적용" 같은 다른 문구는 제외)
function extractEvolutionDamageIncreasePercent(text) {
  if (!text) return 0;
  const regex = /진화형\s*피해(?:가|이)?\s*([\d.]+)\s*%\s*증가/g;
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    total += parseFloat(m[1]);
  }
  return total;
}

// "적에게 주는 (모든 )?피해(가) X[, Y, Z]% 증가" 형태를 잡는 전용 추출 함수
// (아크패시브 노드 문구가 "적에게 주는 모든 피해가 21.0% 증가"처럼 "모든"이 끼어 있어
// extractPercent의 6자 이내 근접 매칭 규칙으로는 못 잡아서 별도 정규식으로 처리)
// "14.0%, 28.0%, 42.0% 증가"처럼 조건부 단계값이 나열된 경우 최댓값만 사용(최대 달성 가정).
function extractEnemyDamageAllPercent(text) {
  if (!text) return 0;
  const regex = /적에게\s*주는\s*(?:모든\s*)?피해(?:가|이)?\s*((?:[\d.]+\s*%[,\s]*)+)증가/g;
  let total = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const numbers = m[1].match(/[\d.]+/g).map(Number);
    total += Math.max(...numbers);
  }
  return total;
}

// '입식 타격가' 채용 시 기본 진화형 피해 + 스택(입식 타격 II, 항상 최대 중첩 가정)당 진화형 피해
// (낙인력 보너스는 서포터 시뮬레이터 제작 시 별도 반영 예정 — 여기서는 다루지 않음)
function getStandingStrikerEvolutionDamagePercent(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return 0;
  const eng = arkpassiveData.Effects.find((e) => (e.Description || '').includes('입식 타격가'));
  if (!eng) return 0;

  let text = '';
  try {
    const obj = JSON.parse(eng.ToolTip);
    text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
  } catch (e) {
    return 0;
  }

  const baseMatch = text.match(/진화형\s*피해가\s*([\d.]+)\s*%\s*,\s*낙인력/);
  const stackMatch = text.match(/진화형\s*피해\s*\+([\d.]+)\s*%[^]*?최대\s*(\d+)\s*중첩/);

  const base = baseMatch ? parseFloat(baseMatch[1]) : 0;
  const perStack = stackMatch ? parseFloat(stackMatch[1]) : 0;
  const maxStack = stackMatch ? parseFloat(stackMatch[2]) : 0;

  return base + perStack * maxStack;
}

// '음속 돌파' 채용 시, 실제 공격속도/이동속도 증가량 기반 계산 대신 이 노드의 상한치(최대 효율)로 가정하여 반환
// (추후 4노드 효율 분석기에서 이동속도를 직접 입력받아 정확히 계산할 예정 — 그 전까지는 최대치로 가정)
function getSonicBreakthroughEvolutionDamagePercent(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return 0;
  const eng = arkpassiveData.Effects.find((e) => (e.Description || '').includes('음속 돌파'));
  if (!eng) return 0;

  let text = '';
  try {
    const obj = JSON.parse(eng.ToolTip);
    text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
  } catch (e) {
    return 0;
  }

  const maxMatch = text.match(/진화형\s*피해는\s*최대\s*([\d.]+)\s*%\s*까지/);
  return maxMatch ? parseFloat(maxMatch[1]) : 0;
}

// '마나 용광로' 채용 시, 실제 스킬별 기본 마나 소모량 기반 계산 대신 이 노드의 상한치(최대 효율)로 가정하여 반환
// (문구에 "진화형 피해 0.5% 증가" 같은 계수가 들어있어 제너릭 추출기가 오탐하므로, 해당 노드는 제너릭에서 제외하고 여기서만 처리)
// (낙인력 보너스는 서포터 시뮬레이터 제작 시 별도 반영 예정 — 여기서는 다루지 않음)
function getManaFurnaceEvolutionDamagePercent(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return 0;
  const eng = arkpassiveData.Effects.find((e) => (e.Description || '').includes('마나 용광로'));
  if (!eng) return 0;

  let text = '';
  try {
    const obj = JSON.parse(eng.ToolTip);
    text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
  } catch (e) {
    return 0;
  }

  const maxMatch = text.match(/진화형\s*피해\s*([\d.]+)\s*%\s*증가,?\s*최대\s*([\d.]+)\s*%/);
  return maxMatch ? parseFloat(maxMatch[2]) : 0;
}

// '진화' 카테고리 전체 포인트 레벨(arkpassiveData.Points, 1~30) 구간별 보너스 % 테이블
// (깨달음 레벨 → 무기 공격력 0.1%/레벨 하던 것과 같은 개념 — enlightenmentWeaponAttackPercent 참고.
//  다만 이건 선형이 아니라 구간별 고정값이고, 딜러는 진화형 피해, 서포터는 낙인력에 적용됨)
function getEvolutionKarmaBonusPercent(level) {
  if (!level) return 0;
  if (level <= 4) return 1;
  if (level <= 8) return 2;
  if (level <= 12) return 3;
  if (level <= 16) return 4;
  if (level <= 21) return 5;
  return 6; // 22~30
}

// '진화' 카테고리 포인트 레벨 구간에 해당하는 보너스 % (딜러: 진화형 피해, 서포터: 낙인력)
function getArkPassiveEvolutionKarmaBonusPercent(arkpassiveData) {
  const level = getArkPassiveLevelFromData(arkpassiveData, '진화');
  return getEvolutionKarmaBonusPercent(level);
}

// 아크패시브(진화)의 "진화형 피해" % 합산 + 항목별 breakdown (디버깅용)
function getArkPassiveEvolutionDamagePercent(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return 0;
  let total = 0;
  arkpassiveData.Effects
    .filter((e) => e.Name === '진화' && !(e.Description || '').includes('마나 용광로'))
    .forEach((e) => {
      try {
        const obj = JSON.parse(e.ToolTip);
        const text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
        total += extractEvolutionDamageIncreasePercent(text);
      } catch (err) {}
    });
  total += getStandingStrikerEvolutionDamagePercent(arkpassiveData);
  total += getSonicBreakthroughEvolutionDamagePercent(arkpassiveData);
  total += getManaFurnaceEvolutionDamagePercent(arkpassiveData);
  total += getArkPassiveEvolutionKarmaBonusPercent(arkpassiveData);
  return total;
}

// 디버깅용: 아크패시브(진화) 각 노드별 "진화형 피해" 값을 개별로 반환
function getArkPassiveEvolutionDamageBreakdown(arkpassiveData) {
  const result = {};
  if (!arkpassiveData || !arkpassiveData.Effects) return result;
  arkpassiveData.Effects
    .filter((e) => e.Name === '진화' && !(e.Description || '').includes('마나 용광로'))
    .forEach((e) => {
      try {
        const obj = JSON.parse(e.ToolTip);
        const nameObj = obj.Element_000 ? stripHtml(obj.Element_000.value) : '이름없음';
        const text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
        const percent = extractEvolutionDamageIncreasePercent(text);
        if (percent > 0) result[nameObj] = (result[nameObj] || 0) + percent;
      } catch (err) {}
    });
  const standingStrikerPercent = getStandingStrikerEvolutionDamagePercent(arkpassiveData);
  if (standingStrikerPercent > 0) result['입식 타격가'] = (result['입식 타격가'] || 0) + standingStrikerPercent;
  const sonicBreakthroughPercent = getSonicBreakthroughEvolutionDamagePercent(arkpassiveData);
  if (sonicBreakthroughPercent > 0) result['음속 돌파'] = (result['음속 돌파'] || 0) + sonicBreakthroughPercent;
  const manaFurnacePercent = getManaFurnaceEvolutionDamagePercent(arkpassiveData);
  if (manaFurnacePercent > 0) result['마나 용광로'] = (result['마나 용광로'] || 0) + manaFurnacePercent;
  const karmaPercent = getArkPassiveEvolutionKarmaBonusPercent(arkpassiveData);
  if (karmaPercent > 0) result['카르마(진화 포인트 레벨)'] = (result['카르마(진화 포인트 레벨)'] || 0) + karmaPercent;
  return result;
}

// '뭉툭한 가시' 노드 원문에서 임계값(threshold, 보통 80%)/전환율(rate, 보통 150%)/진화형 피해 상한(maxTotal)/
// 기본 고정 증가분(baseFlat)을 파싱 — 채용하지 않았으면 null. getBluntThornConversionBonusPercent(진화형 피해
// 전환량)와 getBluntThornCritRateCapPercent(실제 치명타 발동률 상한)가 공유하는 파싱 로직.
function getBluntThornConfig(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return null;
  const eng = arkpassiveData.Effects.find((e) => (e.Description || '').includes('뭉툭한 가시'));
  if (!eng) return null;

  let text = '';
  try {
    const obj = JSON.parse(eng.ToolTip);
    text = obj.Element_002 ? stripHtml(obj.Element_002.value) : '';
  } catch (e) {
    return null;
  }

  const thresholdMatch = text.match(/확률[을이]\s*최대\s*([\d.]+)\s*%\s*로\s*제한/);
  const rateMatch = text.match(/확률의\s*([\d.]+)\s*%\s*[가를]?\s*진화형\s*피해로\s*전환/);
  const maxTotalMatch = text.match(/진화형\s*피해는\s*최대\s*([\d.]+)\s*%\s*까지/);
  const baseFlatMatch = text.match(/진화형\s*피해(?:가|이)?\s*([\d.]+)\s*%\s*증가/);

  if (!thresholdMatch || !rateMatch || !maxTotalMatch) return null;

  return {
    threshold: parseFloat(thresholdMatch[1]),
    rate: parseFloat(rateMatch[1]),
    maxTotal: parseFloat(maxTotalMatch[1]),
    baseFlat: baseFlatMatch ? parseFloat(baseFlatMatch[1]) : 0,
  };
}

// '뭉툭한 가시' 채용 시, 치명타 적중률이 임계값(보통 80%)을 넘는 초과분을 전환율(보통 150%)로
// 추가 진화형 피해로 전환 (최대 한도 - 기본 15%는 이미 위 함수에서 잡히므로 초과분만 반환)
function getBluntThornConversionBonusPercent(arkpassiveData, critRatePercent) {
  const debug = {
    뭉툭한가시_디버그_받은치명타적중률: critRatePercent,
    엔그레이빙_찾음: false,
    원문: '',
    threshold매치: false,
    rate매치: false,
    maxTotal매치: false,
  };

  const config = getBluntThornConfig(arkpassiveData);
  if (!config) return { bonus: 0, debug };
  debug.엔그레이빙_찾음 = true;
  debug.threshold매치 = true;
  debug.rate매치 = true;
  debug.maxTotal매치 = true;

  const excess = Math.max((critRatePercent || 0) - config.threshold, 0);
  const converted = (excess * config.rate) / 100;
  const maxBonus = config.maxTotal - config.baseFlat;

  return { bonus: Math.min(converted, maxBonus), debug };
}

// '뭉툭한 가시' 채용 시 실제로 치명타가 발동하는 확률의 상한(보통 80) — 채용하지 않았으면 null.
// 화면에 표시하는 치명타 적중률(critRatePercent)은 그대로 두고, 데미지 계산(치명타 피해 기댓값)에만
// 이 상한을 적용해야 한다(임계값을 넘는 초과분은 대신 진화형 피해로 전환되므로 이미 반영됨 —
// getBluntThornConversionBonusPercent 참고, 이중 반영 방지).
function getBluntThornCritRateCapPercent(arkpassiveData) {
  const config = getBluntThornConfig(arkpassiveData);
  return config ? config.threshold : null;
}

// 백/헤드 사멸 체크박스의 적에게 주는 피해 보너스 %
function getSameolEnemyDamagePercent(backChecked, headChecked) {
  return (backChecked ? 5 : 0) + (headChecked ? 20 : 0);
}

// 서포터의 '혼돈의 달 코어 : 낙인의 흔적' 등급에 따른 적에게 주는 피해 배율
// 유물 (1+0.3)×낙인유효율, 고대 (1+0.5)×낙인유효율, 코어 미보유/그 외 등급이면 영향 없음(1배)
function getSupportBrandTraceCoreEnemyDamageMultiplier(supportArkgridData, brandEffectiveRatio) {
  const slot = (supportArkgridData?.Slots || []).find((s) => s.Name && s.Name.includes('낙인의 흔적'));
  if (!slot) return 1;
  if (slot.Grade === '유물') return (1 + 0.3) * brandEffectiveRatio;
  if (slot.Grade === '고대') return (1 + 0.5) * brandEffectiveRatio;
  return 1;
}

// 서포터가 '정열의 춤사위'(아크패시브 진화) 노드를 채용했으면 진화형 피해 14%를 조건 없이 추가
function getSupportPassionateDanceEvolutionDamageBonus(supportArkpassiveData) {
  return hasArkPassiveEffect(supportArkpassiveData, '정열의 춤사위') ? 14 : 0;
}

// 딜러 데이터(+ 서포터의 낙인의 흔적 코어/정열의 춤사위)를 받아 "적에게 주는 피해" 전체 배율 계산 (breakdown 포함)
// 백/헤드 사멸은 더 이상 체크박스 입력이 아니라, 딜러가 채용한 직업각인(빌드) 노드로 자동 판정된다
// (getAutoSameolType 참고).
function calculateEnemyDamageMultiplier(dealerData, critRatePercent, supportData, brandEffectiveRatio, options) {
  const equipment = dealerData.equipment;
  const className = dealerData.profiles ? dealerData.profiles.CharacterClassName : '';
  const partyClassNames = [className, ...((options && options.partyClassNames) || [])];
  const braceletItem = (equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const dealerBracelet = parseBraceletOptions(braceletText);

  const autoSameolType = getAutoSameolType(dealerData.arkpassive);
  const backSameolChecked = autoSameolType === 'back';
  const headSameolChecked = autoSameolType === 'head';

  const necklacePercent = getNecklaceEnemyDamagePercent(equipment);
  const engravingResult = getEngravingEnemyDamageMultiplier(dealerData.engravings);
  const bossGemPercent = getAllArkgridGemsBossDamagePercent(dealerData.arkgrid);
  const chaosCoreResult = getChaosCoreEnemyDamageMultiplier(dealerData.arkgrid);
  const orderCoreResult = getOrderCoreEnemyDamageMultiplier(dealerData.arkgrid);
  const evolutionDamagePercent = getArkPassiveEvolutionDamagePercent(dealerData.arkpassive);
  const bluntThornResult = getBluntThornConversionBonusPercent(dealerData.arkpassive, critRatePercent);
  const bluntThornBonus = bluntThornResult.bonus;
  const sameolPercent = getSameolEnemyDamagePercent(backSameolChecked, headSameolChecked);
  const synergyDamageIncreasePercent = sumPartySynergyPercent(partyClassNames, SYNERGY_DAMAGE_INCREASE_CLASSES, SYNERGY_DAMAGE_INCREASE_PERCENT);
  const synergyEnemyDamageTakenTierPercent = (backSameolChecked || headSameolChecked)
    ? SYNERGY_ENEMY_DAMAGE_TAKEN_SAMEOL_PERCENT
    : SYNERGY_ENEMY_DAMAGE_TAKEN_BASE_PERCENT;
  const synergyEnemyDamageTakenPercent = sumPartySynergyPercent(partyClassNames, SYNERGY_ENEMY_DAMAGE_TAKEN_CLASSES, synergyEnemyDamageTakenTierPercent);
  const supportPassionateDanceBonus = getSupportPassionateDanceEvolutionDamageBonus(supportData?.arkpassive);
  const supportBrandTraceCoreMultiplier = getSupportBrandTraceCoreEnemyDamageMultiplier(supportData?.arkgrid, brandEffectiveRatio ?? 1);
  const arkPassivePersistentEnemyDamagePercent = getArkPassivePersistentEnemyDamagePercent(dealerData.arkpassive);
  const abilityStoneOtherBonus = getAbilityStoneOtherEngravingBonus(dealerData.engravings);

  const multiplier =
    toMultiplier(necklacePercent) *
    engravingResult.multiplier *
    toMultiplier(bossGemPercent) *
    chaosCoreResult.multiplier *
    orderCoreResult.multiplier *
    toMultiplier(dealerBracelet.enemyDamagePercent) *
    toMultiplier(evolutionDamagePercent + bluntThornBonus + supportPassionateDanceBonus) *
    toMultiplier(arkPassivePersistentEnemyDamagePercent) *
    toMultiplier(abilityStoneOtherBonus.enemyDamagePercent) *
    toMultiplier(sameolPercent) *
    toMultiplier(synergyDamageIncreasePercent) *
    toMultiplier(synergyEnemyDamageTakenPercent) *
    supportBrandTraceCoreMultiplier;

  return {
    multiplier,
    breakdown: {
      목걸이: necklacePercent,
      각인: engravingResult.byName,
      돌격대장: engravingResult.chargeCaptainPercent,
      아크그리드젬_보스피해: bossGemPercent,
      아크그리드코어_혼돈: chaosCoreResult.byCore,
      아크그리드코어_질서: orderCoreResult.byGroup,
      딜러팔찌: dealerBracelet.enemyDamagePercent,
      아크패시브_진화형피해: evolutionDamagePercent,
      아크패시브_진화형피해_상세: getArkPassiveEvolutionDamageBreakdown(dealerData.arkpassive),
      아크패시브_상시버프_적주피: arkPassivePersistentEnemyDamagePercent,
      어빌리티스톤_각인보너스_적주피: abilityStoneOtherBonus.enemyDamagePercent,
      뭉툭한가시_전환보너스: bluntThornBonus,
      뭉툭한가시_디버그: bluntThornResult.debug,
      사멸옵션: sameolPercent,
      자동감지_사멸타입: autoSameolType,
      시너지_피해증가: synergyDamageIncreasePercent,
      시너지_주는피해증가: synergyEnemyDamageTakenPercent,
      서폿_정열의춤사위_진화형피해: supportPassionateDanceBonus,
      서폿_낙인의흔적_코어배율: supportBrandTraceCoreMultiplier,
    },
  };
}

// 방어율 배율 = 방어율상수 / (방어율상수 + 유효 적 방어력)
// 유효 적 방어력 = 적의 방어력 × (1-암흑수류탄%) × (1-서폿팔찌 방어력감소%) × (1-(시너지A+B+C))
// 방어율상수/적의 방어력은 현재 각각 6500으로 고정(레이드별로 다를 수 있어 추후 조정 예정).
// 암흑수류탄(배틀 아이템, 방어력감소 20%)과 시너지A/B/C는 아직 미구현 — 기본값 0(미적용)으로 자리만 잡아둠.
function calculateDefenseMultiplier(options) {
  const {
    defenseConstant = 6500,
    enemyDefense = 6500,
    darkGrenadeActive = false,
    supportBraceletDefenseReductionPercent = 0,
    synergyAPercent = 0,
    synergyBPercent = 0,
    synergyCPercent = 0,
  } = options || {};

  const darkGrenadeReductionPercent = darkGrenadeActive ? 20 : 0;
  const synergyTotalPercent = synergyAPercent + synergyBPercent + synergyCPercent;

  const effectiveEnemyDefense =
    enemyDefense *
    (1 - darkGrenadeReductionPercent / 100) *
    (1 - supportBraceletDefenseReductionPercent / 100) *
    (1 - synergyTotalPercent / 100);

  const multiplier = defenseConstant / (defenseConstant + effectiveEnemyDefense);

  return {
    multiplier,
    breakdown: {
      방어율상수: defenseConstant,
      적의방어력: enemyDefense,
      암흑수류탄_방어력감소: darkGrenadeReductionPercent,
      서폿팔찌_방어력감소: supportBraceletDefenseReductionPercent,
      시너지A: synergyAPercent,
      시너지B: synergyBPercent,
      시너지C: synergyCPercent,
      유효적방어력: effectiveEnemyDefense,
    },
  };
}

// 아크패시브(진화)의 "낙인력" % 합산 (입식 타격가 등 진화 노드 문구에 포함된 값도 함께 잡힘)
// + '진화' 카테고리 포인트 레벨 구간별 카르마 보너스(getArkPassiveEvolutionKarmaBonusPercent)
function getArkPassiveEvolutionBrandPowerPercent(arkpassiveData) {
  const generic = extractPercent(getArkPassiveEffectsText(arkpassiveData, '진화'), '낙인력');
  return generic + getArkPassiveEvolutionKarmaBonusPercent(arkpassiveData);
}

// 6개 코어 전체에 박힌 아크그리드 젬들의 "[낙인력] Lv.X" 레벨을 전부 합산
function getAllArkgridGemsBrandPowerLevel(arkgridData) {
  let totalLevel = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        const matches = text.matchAll(/\[낙인력\]\s*Lv\.(\d+)/g);
        for (const m of matches) {
          totalLevel += parseInt(m[1], 10);
        }
      });
    });
  }
  return totalLevel;
}

// 합산 레벨 × 0.1667% = 아크그리드 젬의 낙인력 %
function getAllArkgridGemsBrandPowerPercent(arkgridData) {
  const level = getAllArkgridGemsBrandPowerLevel(arkgridData);
  return level * 0.1667;
}

// 6개 코어 전체의 "낙인력" % 합산 (활성화된 [XXP] 구간만)
// sumCoreSegments는 라벨이 포함된 구간 전체의 숫자를 다 더하는데, "낙인력이 2.40% 증가하며,
// 낙인 효과 적용 시 ... 받는 피해가 0.20% 증가한다" 처럼 한 구간에 다른 스탯(%) 이 같이 섞여
// 나오는 경우 그 값까지 오합산되므로, 라벨과 가까운 값만 잡는 extractPercent를 구간별로 사용한다.
function getBrandPowerFromArkgridCores(arkgridData) {
  let total = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      segments.forEach((seg) => {
        total += extractPercent(seg, '낙인력');
      });
    });
  }
  return total;
}

// 악세서리(목걸이)의 "낙인력" % 합산
function getNecklaceBrandPowerPercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '목걸이').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '낙인력');
  });
  return total;
}

// 낙인 배율 = (1 + 10% × (1 + 낙인력 / 100)) × 낙인 유효율
// (낙인력 0%일 때도 기본 10%는 붙고, 낙인력이 그 10%를 배율로 키워주는 구조 — 예: 낙인력 50% → 10%×1.5 = 15%)
// 낙인력 = 아크패시브(진화) + 아크그리드(코어) + 아크그리드(젬) + 악세(목걸이) + 그외 기타(수동 입력)
// 그외 기타 소스는 아직 실제 파싱 연결 전이라 기본값 0으로 자리만 잡아둠 — 필요해지면 이어서 채울 예정.
function calculateBrandMultiplier(supportData, options) {
  const { etcBrandPowerPercent = 0, brandEffectiveRatio = 1 } = options || {};

  const arkPassiveBrandPower = getArkPassiveEvolutionBrandPowerPercent(supportData?.arkpassive);
  const arkgridCoreBrandPower = getBrandPowerFromArkgridCores(supportData?.arkgrid);
  const arkgridGemBrandPower = getAllArkgridGemsBrandPowerPercent(supportData?.arkgrid);
  const necklaceBrandPower = getNecklaceBrandPowerPercent(supportData?.equipment);

  const totalBrandPowerPercent =
    arkPassiveBrandPower + arkgridCoreBrandPower + arkgridGemBrandPower + necklaceBrandPower + etcBrandPowerPercent;

  const multiplier = (1 + 0.1 * (1 + totalBrandPowerPercent / 100)) * brandEffectiveRatio;

  return {
    multiplier,
    breakdown: {
      아크패시브_진화: arkPassiveBrandPower,
      아크그리드_코어: arkgridCoreBrandPower,
      아크그리드_젬: arkgridGemBrandPower,
      목걸이: necklaceBrandPower,
      기타: etcBrandPowerPercent,
      낙인력_합계: totalBrandPowerPercent,
      낙인_유효율: brandEffectiveRatio,
    },
  };
}

// 속성 피해 증가율(카드 세트 각성, 성/암/화/수/토/뇌 6속성 공통 테이블) — 18/24/30각성별 %
const CARD_ELEMENT_DAMAGE_TABLE = { 18: 7, 24: 11, 30: 14 };

// 서폿카드 받는 피해 증가율(서폿 카드 세트 각성) — 티어별/각성별 %
// 1티어(남바절류), 2티어(대사부류)는 18/24/30각성만, 3티어(너/계획, 전 속성 적용 가능)는 12각성부터 존재
const CARD_SUPPORT_DAMAGE_TAKEN_TABLE = {
  1: { 18: 1, 24: 2, 30: 3.5 },
  2: { 18: 0.5, 24: 1.5, 30: 2.5 },
  3: { 12: 0.5, 18: 1, 24: 1.25, 30: 1.5 },
};

// 카드 추가피해 배율 = (1 + 속성 피해 증가율%) × (1 + 계열 피해 증가율%) × (1 + 서폿카드 받는 피해 증가율%)
// - 속성 피해 증가율(카드 세트 각성)과 서폿카드 받는 피해 증가율(서폿 카드 세트 각성)은 어떤 속성/카드를
//   쓰는지가 레이드마다 달라서, 나중에 시뮬레이터에서 리스트박스로 직접 고르게 할 예정.
//   기본 계산식(시뮬레이터 아님)에서는 각각 최대치로 가정: 속성 30각성(14%), 서폿카드 1티어 30각성(3.5%).
// - 계열 피해 증가율(카드 도감)은 API로 가져올 수 없어 기본 계산식에서는 0으로 가정,
//   추후 시뮬레이터에서 직접 입력받을 예정.
function calculateCardExtraDamageMultiplier(options) {
  const {
    elementAwakening = 30,
    seriesDamagePercent = 0,
    supportCardTier = 1,
    supportCardAwakening = 30,
  } = options || {};

  const elementDamagePercent = CARD_ELEMENT_DAMAGE_TABLE[elementAwakening] || 0;
  const supportCardDamagePercent = (CARD_SUPPORT_DAMAGE_TAKEN_TABLE[supportCardTier] || {})[supportCardAwakening] || 0;

  const multiplier =
    (1 + elementDamagePercent / 100) *
    (1 + seriesDamagePercent / 100) *
    (1 + supportCardDamagePercent / 100);

  return {
    multiplier,
    breakdown: {
      속성_피해_증가율: elementDamagePercent,
      계열_피해_증가율: seriesDamagePercent,
      서폿카드_받는피해_증가율: supportCardDamagePercent,
      서폿카드_티어: supportCardTier,
      서폿카드_각성: supportCardAwakening,
      속성_각성: elementAwakening,
    },
  };
}

// 직업별 시너지 테이블. 시너지는 직업마다 다르고 파티에 같은 직업이 있어도 중복 적용되지 않는데,
// 그건 추후 파티 구성을 직접 고르는 시뮬레이터에서 다룰 부분. 여기서는 그중 "본인(딜러) 직업이
// 마침 시너지 제공 직업인 경우" 딱 그 한 건만 API로 확인 가능하므로 최종 계산식에 자동 반영한다.
// (예: 딜러 직업이 '건슬링어'면 치명타 적중률에 자동으로 10% 추가)
// '심판자 홀나'/'딜홀리나이트'는 홀리나이트의 딜러 빌드를 가리키는 커뮤니티 명칭인데,
// API가 반환하는 CharacterClassName은 빌드 구분 없이 '홀리나이트' 하나뿐이라 그걸로 매칭한다
// (이 툴에서 딜러 슬롯에 들어간 홀리나이트는 정의상 딜러 빌드이므로).
const SYNERGY_CRIT_RATE_CLASSES = ['기상술사', '건슬링어', '데빌헌터', '아르카나', '배틀마스터', '스트라이커'];
const SYNERGY_CRIT_RATE_PERCENT = 10; // 치명타 적중률 증가 → 치명타 적중률에 가산

const SYNERGY_CRIT_DAMAGE_CLASSES = ['창술사', '홀리나이트'];
const SYNERGY_CRIT_DAMAGE_PERCENT = 8; // 치명타 시 피해량 증가 → 치명타 배율에 곱연산 (1+시너지)

const SYNERGY_DAMAGE_INCREASE_CLASSES = ['데모닉', '버서커', '브레이커', '소서리스', '소울이터', '슬레이어', '인파이터', '호크아이', '가디언나이트'];
const SYNERGY_DAMAGE_INCREASE_PERCENT = 6; // 피해 증가 → 적에게 주는 피해에 곱연산 (1+시너지)

const SYNERGY_ENEMY_DAMAGE_TAKEN_CLASSES = ['워로드', '블레이드'];
const SYNERGY_ENEMY_DAMAGE_TAKEN_BASE_PERCENT = 4;
const SYNERGY_ENEMY_DAMAGE_TAKEN_SAMEOL_PERCENT = 9; // 주는피해 증가(기본4%/백·헤드 사멸 9%) → 적에게 주는 피해에 곱연산

const SYNERGY_ATTACK_POWER_CLASSES = ['기공사', '스카우터'];
const SYNERGY_ATTACK_POWER_PERCENT = 6; // 공격력 증가 → 최종 데미지에 곱연산 (1+시너지)

const SYNERGY_DEFENSE_REDUCTION_CLASSES = ['서머너', '워로드', '디스트로이어', '블래스터', '리퍼', '차원술사', '환수사'];
const SYNERGY_DEFENSE_REDUCTION_PERCENT = 12; // 방어력 감소 → calculateDefenseMultiplier의 시너지A/B/C에 사용

// 위 6개 시너지 직업 목록의 합집합 = 딜러 전체 직업 로스터 (이 코드베이스는 "직업 1개당 시너지 1개"
// 규칙을 반영해 목록을 만들어왔으므로, 합집합이 곧 전체 딜러 직업 27종이 됨). 파티 시너지 직업
// 선택 드롭다운(index.html)을 채우는 용도.
const ALL_DEALER_CLASSES = Array.from(new Set([
  ...SYNERGY_CRIT_RATE_CLASSES,
  ...SYNERGY_CRIT_DAMAGE_CLASSES,
  ...SYNERGY_DAMAGE_INCREASE_CLASSES,
  ...SYNERGY_ENEMY_DAMAGE_TAKEN_CLASSES,
  ...SYNERGY_ATTACK_POWER_CLASSES,
  ...SYNERGY_DEFENSE_REDUCTION_CLASSES,
]));

// 파티(본인 포함 최대 3명) 직업 목록 중 주어진 시너지 직업 목록에 속하는 인원 수 × percent를 반환.
// 같은 직업이 중복 선택될 일은 없다고 가정하고 종류 구분 없이 매치되는 만큼 그냥 더한다.
function sumPartySynergyPercent(classNames, classList, percent) {
  return (classNames || []).filter((c) => classList.includes(c)).length * percent;
}

// 백/헤드 사멸: 예전엔 체크박스로 수동 입력했지만, 실제로는 캐릭터가 채용한 직업각인(빌드)
// 아크패시브 노드 이름으로 정해지는 값이라 API로 자동 판정 가능. 노드는 클래스별 전용 풀이라
// 캐릭터 한 명의 Effects에는 다른 클래스의 노드 이름이 섞여 나올 수 없음 — 카테고리(진화/깨달음)
// 구분 없이 Description 전체에서 이름 매치.
const BACK_SAMEOL_CLASS_ENGRAVING_NODES = [
  '비기', '심판자', '체술', '충격 단련', '오의 강화', '핸드거너', '전술 탄환',
  '오의난무', '일격', '잔재된 기운', '버스트', '갈증', '달의소리',
  '공간검사', '초심',
];
const HEAD_SAMEOL_CLASS_ENGRAVING_NODES = [
  '고독한 기사', '전투 태세', '수라', '분노의 망치', '중력 수련',
];

// 딜러의 아크패시브 Effects에서 채용한 직업각인(빌드) 노드로 백/헤드 사멸 여부를 자동 판정
// 반환값: 'back' | 'head' | null (해당 표에 없는 직업/노드는 사멸 없음)
function getAutoSameolType(arkpassiveData) {
  if (!arkpassiveData || !arkpassiveData.Effects) return null;
  const hasNode = (nodeName) => arkpassiveData.Effects.some((e) => (e.Description || '').includes(nodeName));
  if (BACK_SAMEOL_CLASS_ENGRAVING_NODES.some(hasNode)) return 'back';
  if (HEAD_SAMEOL_CLASS_ENGRAVING_NODES.some(hasNode)) return 'head';
  return null;
}

// 서포터 "피해량 증가" 버프에서 스킬명이 명시된 코어 옵션(예: "미르 새김의 아군 피해량 강화 효과가 N% 증가한다")
// 목록. 전체 아군 피해량 강화 합산(generic pool)에서는 이 스킬들을 제외해야 이중 합산되지 않는다.
const SUPPORT_DAMAGE_BUFF_SKILL_NAMES = [
  '저무는 달', '미르 새김', '세레나데', '아리아',
  '신성한 정의', '신성의 오라', '빛의 해방', '신의 증명',
];

// 클래스별 "피해량 증가" 버프 설정값
// - 도화가는 히유시 실제 데이터로 검증 완료. 바드/홀리나이트/발키리는 아직 실제 캐릭터로
//   검증 전 — 스킬명/코어 문구가 실제 API와 다를 수 있음.
const SUPPORT_DAMAGE_BUFF_CLASS_CONFIG = {
  도화가: {
    adenkiSkillName: '저무는 달', adenkiBaseRate: 10,
    hyperSkillName: '미르 새김', hyperBaseRate: 10,
    gemSkillName: '음양',
    specializationCoefficient: 0.0600,
  },
  바드: {
    adenkiSkillName: '세레나데', adenkiBaseRate: 15,
    hyperSkillName: '아리아', hyperBaseRate: 10,
    gemSkillName: '세레나데',
    specializationCoefficient: 0.0500,
  },
  홀리나이트: {
    adenkiSkillName: '신성한 정의', adenkiBaseRate: 10,
    hyperSkillName: '신성의 오라', hyperBaseRate: 10,
    gemSkillName: '신앙',
    specializationCoefficient: 0.0901,
  },
  발키리: {
    adenkiSkillName: '빛의 해방', adenkiBaseRate: 10,
    hyperSkillName: '신의 증명', hyperBaseRate: 10,
    gemSkillName: '신앙',
    specializationCoefficient: 0.0858,
  },
};

// 텍스트에서 "스킬명의 아군 피해량 강화 효과가 N% 증가한다" 형태의 스킬-전용 문구를 전부 제거
// (전체 합산 풀에 이중 합산되지 않도록)
function stripSkillSpecificAllyDamageBuffText(text) {
  let cleaned = text;
  SUPPORT_DAMAGE_BUFF_SKILL_NAMES.forEach((skillName) => {
    const re = new RegExp(skillName + '\\s*의\\s*아군\\s*피해량\\s*강화[^%]*%', 'g');
    cleaned = cleaned.replace(re, '');
  });
  return cleaned;
}

// 악세서리(반지만)의 "아군 피해량 강화" % 합산 (목걸이·귀걸이 제외)
function getRingAllyDamageBuffPercent(equipmentList) {
  let total = 0;
  (equipmentList || []).filter((it) => it.Type === '반지').forEach((it) => {
    total += extractPercent(parseTooltip(it.Tooltip).join(' '), '아군 피해량 강화');
  });
  return total;
}

// 6개 코어 전체의 "아군 피해량 강화" % 합산 (활성화된 [XXP] 구간만, 스킬-전용 문구는 제외한 일반 풀)
function getGenericAllyDamageBuffFromArkgridCores(arkgridData) {
  let total = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      segments.forEach((seg) => {
        total += extractPercent(stripSkillSpecificAllyDamageBuffText(seg), '아군 피해량 강화');
      });
    });
  }
  return total;
}

// 반지+아크그리드(코어 일반 풀)+아크그리드(젬) 전체의 "아군 피해량 효과 증가" % 총합
function getTotalAllyDamageBuffPercent(equipmentList, arkgridData, braceletOptions) {
  return (
    (braceletOptions?.allyDamageBuffPercent || 0) +
    getRingAllyDamageBuffPercent(equipmentList) +
    getGenericAllyDamageBuffFromArkgridCores(arkgridData) +
    getAllArkgridGemsAllyDamageBuffPercent(arkgridData)
  );
}

// 특정 스킬명이 명시된 "운명" 코어 옵션의 아군 피해량 강화 % 합산 (해당 스킬 전용, 활성화된 구간만)
// '운명' 발동 조건은 항상 발동되어 있다고 가정 (요청사항)
function getSkillSpecificAllyDamageBuffFromArkgridCores(arkgridData, skillName) {
  let total = 0;
  if (arkgridData && arkgridData.Slots) {
    const re = new RegExp(skillName + '\\s*의\\s*아군\\s*피해량\\s*강화[^\\d%]*?([\\d.]+)\\s*%', 'g');
    arkgridData.Slots.forEach((slot) => {
      const raw = getCoreOptionText(slot.Tooltip);
      const segments = getActivatedCoreSegments(raw, slot.Point);
      segments.forEach((seg) => {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(seg)) !== null) total += parseFloat(m[1]);
      });
    });
  }
  return total;
}

// 보석(gems) 목록에서 특정 스킬명이 명시된 "지원 효과" 보석의 레벨을 찾아 반환 (없으면 0)
// 같은 스킬이라도 재사용 대기시간 감소형 보석이 꽂혀있을 수 있어 "지원 효과" 문구도 함께 확인해야
// 정확한 보석(지원형)만 걸러진다 (심빛장전 데이터에서 "신성한 보호" 쿨감 보석 오탐으로 발견된 문제).
function getSkillGemLevel(gemsData, skillName) {
  if (!gemsData || !gemsData.Gems) return 0;
  const gem = gemsData.Gems.find((g) => {
    try {
      const obj = JSON.parse(g.Tooltip);
      const el6 = obj.Element_006 ? obj.Element_006.value : null;
      const text = el6 ? stripHtml(el6.Element_001 || '') : '';
      return text.includes(skillName) && text.includes('지원 효과');
    } catch (e) {
      return false;
    }
  });
  return gem ? gem.Level : 0;
}

// 팔찌 아이템을 찾아 parseBraceletOptions로 파싱해서 반환 (미착용 시 기본값 객체)
function getBraceletOptionsFromEquipment(equipmentList) {
  const braceletItem = (equipmentList || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  return parseBraceletOptions(braceletText);
}

// parseBraceletOptions의 % 필드 중 "실제 계산식에 값이 꽂히는" 6개 필드 → 그 값을 넣었을 때
// 다시 parseBraceletOptions가 똑같이 읽어낼 수 있는 합성 문장. calculateBraceletEfficiencyTable에서
// "이 옵션 하나만 없는 팔찌"를 텍스트 레벨로 재구성할 때 사용.
const BRACELET_HOOKED_FIELD_SENTENCES = {
  weaponAttackFlat: (v) => `무기 공격력이 ${v} 증가한다.`,
  critRatePercent: (v) => `치명타 적중률이 ${v}% 증가한다.`,
  critDamagePercent: (v) => `치명타 피해가 ${v}% 증가한다.`,
  critHitExtraDamagePercent: (v) => `치명타로 적중 시 적에게 주는 피해가 ${v}% 증가한다.`,
  additionalDamagePercent: (v) => `추가 피해가 ${v}% 증가한다.`,
  enemyDamagePercent: (v) => `적에게 주는 피해가 ${v}% 증가한다.`,
};

// dealerData를 복제하고, 팔찌 Tooltip을 "힘/민첩/지능(원래 값 그대로 보존) + 6개 훅필드 중 excludeKey를 뺀 나머지"
// 만으로 이루어진 합성 텍스트로 통째로 교체해서 반환. primaryStat 계산이 braceletText의 힘/민첩/지능도
// 같이 읽기 때문에, 이걸 빼먹으면 excludeKey와 무관하게 힘/민첩/지능 손실분까지 효율에 섞여버림.
function buildDealerDataWithoutBraceletField(dealerData, braceletOptions, primaryStatFlat, excludeKey) {
  const sentences = Object.keys(BRACELET_HOOKED_FIELD_SENTENCES)
    .filter((key) => key !== excludeKey && braceletOptions[key])
    .map((key) => BRACELET_HOOKED_FIELD_SENTENCES[key](braceletOptions[key]));

  ['힘', '민첩', '지능'].forEach((stat) => {
    if (stat !== excludeKey && primaryStatFlat[stat]) sentences.push(`${stat} +${primaryStatFlat[stat]} 증가한다.`);
  });

  const equipment = (dealerData.equipment || []).map((item) => ({ ...item }));
  const braceletIdx = equipment.findIndex((it) => it.Type === '팔찌');
  if (braceletIdx === -1) return { ...dealerData, equipment };

  const syntheticTooltip = {};
  sentences.forEach((s, i) => { syntheticTooltip['S' + i] = { value: s }; });
  equipment[braceletIdx] = { ...equipment[braceletIdx], Tooltip: JSON.stringify(syntheticTooltip) };
  return { ...dealerData, equipment };
}

// dealerData.profiles.Stats에서 '치명' 스탯 Value에 delta를 더한(음수면 뺀, 0 미만으로는 안 내려감) 사본 반환.
// 치명 스탯은 팔찌 텍스트가 아니라 profiles API가 이미 총합을 구워서 내려주기 때문에(다른 주스탯/특화/신속과
// 다른 경로), 팔찌 텍스트 합성이 아니라 profiles를 직접 조작해서 민감도를 계산해야 한다.
function buildDealerDataWithCritStatDelta(dealerData, delta) {
  const stats = ((dealerData.profiles && dealerData.profiles.Stats) || []).map((s) => ({ ...s }));
  const idx = stats.findIndex((s) => s.Type === '치명');
  const currentValue = idx !== -1 ? (parseFloat(stats[idx].Value) || 0) : 0;
  const newValue = Math.max(0, currentValue + delta);
  if (idx !== -1) {
    stats[idx] = { ...stats[idx], Value: String(newValue) };
  } else if (delta > 0) {
    stats.push({ Type: '치명', Value: String(newValue) });
  }
  return { ...dealerData, profiles: { ...dealerData.profiles, Stats: stats } };
}

// 팔찌 옵션 각각이 "적에게 주는 피해" 기준으로 몇 %의 가치를 갖는지 환산한 표(딜러용) — 실제 착용 팔찌용과
// 팔찌 시뮬레이터(가상 조합)용이 공유하는 핵심 엔진. finalDamage/extraDamageMultiplier/baseTotal은 호출부에서
// (실제 팔찌 기준인지, 시뮬레이터의 가상 팔찌 기준인지에 맞게) 미리 계산해서 넘긴다.
//
// 방법: 그 옵션 "하나만 빠졌다고 가정"한 팔찌로 다시 계산해서 baseTotal과 비교한 비율을 쓴다. 적주피 자체가
// 이 곱연산 체인의 한 항이라, 이 비율이 곧 "적주피 몇 %와 동급인가"가 된다 (예: 적주피 옵션 자체는 항상
// 정확히 자기 자신의 값이 나옴).
// - 주스탯(힘/민첩/지능)/치명(스탯): purePower/치명타 적중률에 직접 들어가므로 같은 "옵션 하나만 빠졌다고
//   가정" 방식으로 환산.
// - 특화/신속: 사용자가 지정한 고정 환산치(1당 0.03%/0.02%)를 그대로 사용 — 재계산하지 않음.
// - 재사용대기 증가(페널티): 항상 2%인 고정 옵션이라, 신속 46.511 상당(=신속 환산율 0.02%를 곱한
//   46.511×0.02%)을 고정치로 뺀다. 재사용대기 증가는 페널티라 부호가 음수.
// - 백어택/헤드어택/비방향성/보호효과 대상 피해%: 조건부지만 "상시 발동"을 가정(이 코드베이스의 기존
//   컨벤션과 동일)하면 적주피와 수학적으로 동치라 1:1로 취급.
// - 무력화 상태 적에게 주는 피해%: 무력화 상태가 상시 유지되지 않으므로 1:1이 아니라 15/100 효율로 환산
//   (사용자 지정 고정치).
// - 악마 피해%/치명타(적)저항감소%(딜러 자신의 팔찌)/아군 버프 계열: 현재 엔진에
//   딜러 자신에게 적용되는 계산식이 없어 0으로 처리 (필요해지면 나중에 보강 대상).
const BRACELET_SPECIALIZATION_RATE = 0.03; // 특화 1당 0.03% (사용자 지정 고정치)
const BRACELET_SWIFTNESS_RATE = 0.02; // 신속 1당 0.02% (사용자 지정 고정치)
// 재사용대기 증가(2%) 옵션의 고정 페널티 — 신속 스탯 46.511 상당(=2% 재사용대기 감소의 스탯 환산치)을
// 신속 환산율로 적용. 재사용대기%에 정확히 비례하는 공식이 아니라 "우선은 고정치"로 사용자가 지정.
const BRACELET_COOLDOWN_PENALTY_FLAT = 46.511 * BRACELET_SWIFTNESS_RATE;
// 무력화 상태 적주피는 실전에서 무력화 상태가 상시 유지되지 않으므로, 값 그대로(1:1)가 아니라
// 15/100 효율로 환산 (사용자 지정 고정치)
const BRACELET_INCAPACITATED_EFFICIENCY_RATE = 0.15;

function calculateBraceletOptionEfficiencies(dealerData, supportData, dealerStats, inputs, finalDamage, extraDamageMultiplier, ctx, baseTotal) {
  const { braceletOptions, primaryStatFlat, specStat, swiftStat, critStat } = inputs;

  function sensitivityPercent(excludeKey, value) {
    if (!value) return 0;
    const withoutData = buildDealerDataWithoutBraceletField(dealerData, braceletOptions, primaryStatFlat, excludeKey);
    const newStats = calculateCharacterStats(withoutData);
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames });
    const newExtra = calculateExtraDamageMultiplier(withoutData);
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });
    const newFinalDamage = calculateFinalDamage(
      newStats.basePower, dealerStats.accessoryAttackFlat, dealerStats.chaosCoreAttack.flat, ctx.supportBuffPower,
      dealerStats.chaosCoreAttack.percent, dealerStats.earringAttackPercent, dealerStats.arkgridGemsAttackPercent,
      ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
    );
    const withoutTotal = newFinalDamage * newCrit.avgDamageMultiplier * newExtra.multiplier * newEnemy.multiplier;
    return ((baseTotal / withoutTotal) - 1) * 100;
  }

  function critStatSensitivityPercent(value) {
    if (!value) return 0;
    const withoutData = buildDealerDataWithCritStatDelta(dealerData, -value);
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames });
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });
    const withoutTotal = finalDamage * newCrit.avgDamageMultiplier * extraDamageMultiplier * newEnemy.multiplier;
    return ((baseTotal / withoutTotal) - 1) * 100;
  }

  // 팔찌 주스탯(힘/민첩/지능)은 셋 중 하나만 값이 있다 — 있는 것 하나만 표에 넣는다
  const primaryStatName = ['힘', '민첩', '지능'].find((stat) => primaryStatFlat[stat]);

  return [
    ...(primaryStatName ? [{ key: 'primaryStat', label: `주스탯(${primaryStatName})`, value: primaryStatFlat[primaryStatName], method: '실스펙 환산', efficiencyPercent: sensitivityPercent(primaryStatName, primaryStatFlat[primaryStatName]) }] : []),
    { key: 'weaponAttackFlat', label: '고정 무기공격력', value: braceletOptions.weaponAttackFlat, method: '실스펙 환산', efficiencyPercent: sensitivityPercent('weaponAttackFlat', braceletOptions.weaponAttackFlat) },
    { key: 'critRatePercent', label: '치명타 적중률%', value: braceletOptions.critRatePercent, method: '실스펙 환산', efficiencyPercent: sensitivityPercent('critRatePercent', braceletOptions.critRatePercent) },
    { key: 'critDamagePercent', label: '치명타 피해%', value: braceletOptions.critDamagePercent, method: '실스펙 환산', efficiencyPercent: sensitivityPercent('critDamagePercent', braceletOptions.critDamagePercent) },
    { key: 'critHitExtraDamagePercent', label: '치명타 적중 시 추가 피해%', value: braceletOptions.critHitExtraDamagePercent, method: '실스펙 환산', efficiencyPercent: sensitivityPercent('critHitExtraDamagePercent', braceletOptions.critHitExtraDamagePercent) },
    { key: 'additionalDamagePercent', label: '추가 피해%', value: braceletOptions.additionalDamagePercent, method: '실스펙 환산', efficiencyPercent: sensitivityPercent('additionalDamagePercent', braceletOptions.additionalDamagePercent) },
    { key: 'enemyDamagePercent', label: '적에게 주는 피해%', value: braceletOptions.enemyDamagePercent, method: '기준값(1:1)', efficiencyPercent: braceletOptions.enemyDamagePercent || 0 },
    { key: 'backAttackDamagePercent', label: '백어택 시 주는 피해%', value: braceletOptions.backAttackDamagePercent, method: '1:1 (상시발동 가정)', efficiencyPercent: braceletOptions.backAttackDamagePercent || 0 },
    { key: 'headAttackDamagePercent', label: '헤드어택 시 주는 피해%', value: braceletOptions.headAttackDamagePercent, method: '1:1 (상시발동 가정)', efficiencyPercent: braceletOptions.headAttackDamagePercent || 0 },
    { key: 'nonDirectionalDamagePercent', label: '비방향성 스킬 주는 피해%', value: braceletOptions.nonDirectionalDamagePercent, method: '1:1 (상시발동 가정)', efficiencyPercent: braceletOptions.nonDirectionalDamagePercent || 0 },
    { key: 'protectedTargetDamagePercent', label: '보호효과 대상 주는 피해%', value: braceletOptions.protectedTargetDamagePercent, method: '1:1 (상시발동 가정)', efficiencyPercent: braceletOptions.protectedTargetDamagePercent || 0 },
    { key: 'incapacitatedDamagePercent', label: '무력화 상태 적에게 주는 피해%', value: braceletOptions.incapacitatedDamagePercent, method: '고정환산(15/100 효율)', efficiencyPercent: (braceletOptions.incapacitatedDamagePercent || 0) * BRACELET_INCAPACITATED_EFFICIENCY_RATE },
    { key: 'specialization', label: '특화(스탯)', value: specStat, method: '고정환산(1당 0.03%)', efficiencyPercent: (specStat || 0) * BRACELET_SPECIALIZATION_RATE },
    { key: 'swiftness', label: '신속(스탯)', value: swiftStat, method: '고정환산(1당 0.02%)', efficiencyPercent: (swiftStat || 0) * BRACELET_SWIFTNESS_RATE },
    { key: 'critStat', label: '치명(스탯)', value: critStat, method: '실스펙 환산', efficiencyPercent: critStatSensitivityPercent(critStat) },
    { key: 'demonDamagePercent', label: '악마 계열 피해%', value: braceletOptions.demonDamagePercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'cooldownPenaltyPercent', label: '재사용대기 증가(페널티)', value: braceletOptions.cooldownPenaltyPercent, method: '고정환산(-46.511×0.02%)', efficiencyPercent: braceletOptions.cooldownPenaltyPercent ? -BRACELET_COOLDOWN_PENALTY_FLAT : 0 },
    { key: 'defenseReductionPercent', label: '적 방어력 감소%', value: braceletOptions.defenseReductionPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'critResistReductionPercent', label: '치명타 저항 감소%', value: braceletOptions.critResistReductionPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'critDmgResistReductionPercent', label: '치명타 피해 저항 감소%', value: braceletOptions.critDmgResistReductionPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'allyShieldHealPercent', label: '아군 보호/회복 효과%', value: braceletOptions.allyShieldHealPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'allyAttackBuffPercent', label: '아군 공격력 강화 효과%', value: braceletOptions.allyAttackBuffPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
    { key: 'allyDamageBuffPercent', label: '아군 피해량 강화 효과%', value: braceletOptions.allyDamageBuffPercent, method: '미지원(0 처리)', efficiencyPercent: 0 },
  ];
}

// 실제 착용 중인 팔찌 기준 효율표("현재 정보"/"팔찌" 탭 상단에 표시)
function calculateBraceletEfficiencyTable(dealerData, supportData, dealerStats, braceletOptions, ctx) {
  const braceletItem = (dealerData.equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const inputs = {
    braceletOptions,
    primaryStatFlat: {
      힘: extractFlat(braceletText, '힘'),
      민첩: extractFlat(braceletText, '민첩'),
      지능: extractFlat(braceletText, '지능'),
    },
    specStat: extractFlat(braceletText, '특화'),
    swiftStat: extractFlat(braceletText, '신속'),
    critStat: extractFlat(braceletText, '치명'),
  };
  const baseTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const rows = calculateBraceletOptionEfficiencies(dealerData, supportData, dealerStats, inputs, ctx.finalDamage, ctx.extraDamageResult.multiplier, ctx, baseTotal);

  // "고정 무기공격력" 한 행을, 실제로 감지된 종류(일반/최대 6중첩/최대 30중첩/생명력 50% 이상)별
  // 행으로 바꿔서 어떤 옵션인지 구분되게 보여준다 (효율%는 동일 — 실제 팔찌엔 보통 한 종류만 있음).
  const weaponAttackRowIndex = rows.findIndex((r) => r.key === 'weaponAttackFlat');
  if (weaponAttackRowIndex !== -1) {
    const originalRow = rows[weaponAttackRowIndex];
    const variants = getBraceletWeaponAttackVariants(braceletText);
    if (variants.length) {
      const variantRows = variants.map((v) => ({
        key: v.variantKey, label: v.label, value: v.rawValue,
        method: originalRow.method, efficiencyPercent: originalRow.efficiencyPercent,
      }));
      rows.splice(weaponAttackRowIndex, 1, ...variantRows);
    }
  }

  return rows;
}

// "팔찌 기본 옵션" 드롭다운에 쓰이는 스탯 목록 (팔찌 시뮬레이터용). 힘/민첩/지능은 클래스마다 하나만
// 쓰이므로 "주스탯" 하나로 통합 — 실제로 어느 stat인지는 getPrimaryStatName으로 자동 판별한다.
const BRACELET_BASIC_OPTION_TYPES = ['주스탯', '특화', '신속', '치명'];

// 실제 팔찌 텍스트에 "고정 무기공격력" 계열 중 어떤 종류가 있는지 감지해서
// [{ variantKey, label, rawValue(칸당 값) }] 로 반환 (실제로는 보통 최대 1개).
const WEAPON_ATTACK_VARIANT_LABELS = {
  weaponAttackFlatPlain: '고정 무기공격력 (일반)',
  weaponAttackFlatStack6: '고정 무기공격력 (최대 6중첩)',
  weaponAttackFlatStack30: '고정 무기공격력 (최대 30중첩)',
  weaponAttackFlatLife50: '고정 무기공격력 (생명력 50% 이상)',
};
function getBraceletWeaponAttackVariants(braceletText) {
  const variants = getBraceletWeaponAttackConditionalBreakdown(braceletText).map((v) => ({
    variantKey: v.variantKey, rawValue: v.rawValue, label: WEAPON_ATTACK_VARIANT_LABELS[v.variantKey],
  }));
  const baseValue = getBraceletWeaponAttackFlatBase(braceletText);
  if (baseValue) {
    variants.push({ variantKey: 'weaponAttackFlatPlain', rawValue: baseValue, label: WEAPON_ATTACK_VARIANT_LABELS.weaponAttackFlatPlain });
  }
  return variants;
}

// 팔찌 실제 옵션 카탈로그(딜러/서폿/공용, 사용자가 정리해준 실제 게임 문구·수치 기준) — 팔찌 시뮬레이터의
// "부여 옵션" 드롭다운이 이 목록을 그대로 쓴다. 각 옵션은 등급 3단계(하늘색<보라색<주황색) 값을 가지며,
// 실제 게임에서 한 옵션 슬롯을 고르면 딸린 효과(1~2개)가 전부 같이 세팅되므로 effects 배열로 묶어서 표현.
// field는 parseBraceletOptions 결과 필드명과 동일. stackMultiplier가 있으면 tier 값(칸당 값)에 그 배수를
// 곱해서 field에 누적한다(스택형 무기공격력용).
const BRACELET_OPTION_CATALOG = [
  // 딜러 - 이중 효과
  { key: 'critRateDual', category: 'dealer', label: '치명타 적중률 + 치명타 적중 시 적주피',
    effects: [
      { field: 'critRatePercent', label: '치명타 적중률', tiers: [3.4, 4.2, 5.0], unit: '%' },
      { field: 'critHitExtraDamagePercent', label: '치명타 적중 시 적주피', tiers: [1.5, 1.5, 1.5], unit: '%' },
    ] },
  { key: 'critDamageDual', category: 'dealer', label: '치명타 피해 + 치명타 적중 시 적주피',
    effects: [
      { field: 'critDamagePercent', label: '치명타 피해', tiers: [6.8, 8.4, 10.0], unit: '%' },
      { field: 'critHitExtraDamagePercent', label: '치명타 적중 시 적주피', tiers: [1.5, 1.5, 1.5], unit: '%' },
    ] },
  { key: 'enemyDamageIncapDual', category: 'dealer', label: '적주피 + 무력화 상태 적주피',
    effects: [
      { field: 'enemyDamagePercent', label: '적주피', tiers: [2.0, 2.5, 3.0], unit: '%' },
      { field: 'incapacitatedDamagePercent', label: '무력화 상태 적주피', tiers: [4.0, 4.5, 5.0], unit: '%' },
    ] },
  { key: 'extraDamageDemonDual', category: 'dealer', label: '추가 피해 + 악마 계열 피해',
    effects: [
      { field: 'additionalDamagePercent', label: '추가 피해', tiers: [2.5, 3.0, 3.5], unit: '%' },
      { field: 'demonDamagePercent', label: '악마 계열 피해', tiers: [2.5, 2.5, 2.5], unit: '%' },
    ] },
  { key: 'cooldownEnemyDamageDual', category: 'dealer', label: '재사용대기 증가 + 적주피',
    effects: [
      { field: 'cooldownPenaltyPercent', label: '재사용대기 증가(페널티)', tiers: [2, 2, 2], unit: '%' },
      { field: 'enemyDamagePercent', label: '적주피', tiers: [4.5, 5.0, 5.5], unit: '%' },
    ] },

  // 딜러 - 단일 효과 (부가 문구 없음)
  { key: 'critRateSingle', category: 'dealer', label: '치명타 적중률 (단독)',
    effects: [{ field: 'critRatePercent', label: '치명타 적중률', tiers: [3.4, 4.2, 5.0], unit: '%' }] },
  { key: 'critDamageSingle', category: 'dealer', label: '치명타 피해 (단독)',
    effects: [{ field: 'critDamagePercent', label: '치명타 피해', tiers: [6.8, 8.4, 10.0], unit: '%' }] },
  { key: 'weaponAttackSingle', category: 'dealer', label: '무기 공격력 (단독)',
    effects: [{ field: 'weaponAttackFlat', label: '무기 공격력', tiers: [7200, 8100, 9000], unit: '' }] },
  { key: 'enemyDamageSingle', category: 'dealer', label: '적주피 (단독)',
    effects: [{ field: 'enemyDamagePercent', label: '적주피', tiers: [2.0, 2.5, 3.0], unit: '%' }] },
  { key: 'extraDamageSingle', category: 'dealer', label: '추가 피해 (단독)',
    effects: [{ field: 'additionalDamagePercent', label: '추가 피해', tiers: [3.0, 3.5, 4.0], unit: '%' }] },
  { key: 'backAttackSingle', category: 'dealer', label: '백어택',
    effects: [{ field: 'backAttackDamagePercent', label: '백어택 시 주는 피해', tiers: [2.5, 3.0, 3.5], unit: '%' }] },
  { key: 'headAttackSingle', category: 'dealer', label: '헤드어택',
    effects: [{ field: 'headAttackDamagePercent', label: '헤드어택 시 주는 피해', tiers: [2.5, 3.0, 3.5], unit: '%' }] },
  { key: 'nonDirectionalSingle', category: 'dealer', label: '비방향성 (각성기 제외)',
    effects: [{ field: 'nonDirectionalDamagePercent', label: '비방향성 스킬 주는 피해', tiers: [2.5, 3.0, 3.5], unit: '%' }] },

  // 공용 - 무기공격력 특수 3종 (딜러/서폿 동일)
  { key: 'weaponAttackStack6', category: 'both', label: '무기 공격력 (공격 적중 스택, 최대 6중첩)',
    effects: [{ field: 'weaponAttackFlat', label: '무기 공격력(칸당)', tiers: [1160, 1320, 1480], unit: '', stackMultiplier: 6 }] },
  { key: 'weaponAttackLife50', category: 'both', label: '무기 공격력 (생명력 50% 이상)',
    effects: [
      { field: 'weaponAttackFlat', label: '무기 공격력(기본)', tiers: [7200, 8100, 9000], unit: '' },
      { field: 'weaponAttackFlat', label: '무기 공격력(조건부 추가)', tiers: [2000, 2200, 2400], unit: '' },
    ] },
  { key: 'weaponAttackStack30', category: 'both', label: '무기 공격력 (시간차 스택, 최대 30중첩)',
    effects: [
      { field: 'weaponAttackFlat', label: '무기 공격력(기본)', tiers: [6900, 7800, 8700], unit: '' },
      { field: 'weaponAttackFlat', label: '무기 공격력(칸당)', tiers: [130, 140, 150], unit: '', stackMultiplier: 30 },
    ] },

  // 서폿 - 이중 효과 (모두 + 아군 공격력 강화)
  { key: 'defenseReductionAllyDual', category: 'support', label: '방어력 감소 + 아군 공격력 강화',
    effects: [
      { field: 'defenseReductionPercent', label: '방어력 감소', tiers: [1.8, 2.1, 2.5], unit: '%' },
      { field: 'allyAttackBuffPercent', label: '아군 공격력 강화', tiers: [2.0, 2.5, 3.0], unit: '%' },
    ] },
  { key: 'critResistReductionAllyDual', category: 'support', label: '치명타 저항 감소 + 아군 공격력 강화',
    effects: [
      { field: 'critResistReductionPercent', label: '치명타 저항 감소', tiers: [1.8, 2.1, 2.5], unit: '%' },
      { field: 'allyAttackBuffPercent', label: '아군 공격력 강화', tiers: [2.0, 2.5, 3.0], unit: '%' },
    ] },
  { key: 'protectedTargetAllyDual', category: 'support', label: '보호효과 대상 적주피 + 아군 공격력 강화',
    effects: [
      { field: 'protectedTargetDamagePercent', label: '보호효과 대상 적주피', tiers: [0.9, 1.1, 1.3], unit: '%' },
      { field: 'allyAttackBuffPercent', label: '아군 공격력 강화', tiers: [2.0, 2.5, 3.0], unit: '%' },
    ] },
  { key: 'critDmgResistReductionAllyDual', category: 'support', label: '치명타 피해 저항 감소 + 아군 공격력 강화',
    effects: [
      { field: 'critDmgResistReductionPercent', label: '치명타 피해 저항 감소', tiers: [3.6, 4.2, 4.8], unit: '%' },
      { field: 'allyAttackBuffPercent', label: '아군 공격력 강화', tiers: [2.0, 2.5, 3.0], unit: '%' },
    ] },

  // 서폿 - 단일 효과
  { key: 'allyAttackBuffSingle', category: 'support', label: '아군 공격력 강화 (단독)',
    effects: [{ field: 'allyAttackBuffPercent', label: '아군 공격력 강화', tiers: [4.0, 5.0, 6.0], unit: '%' }] },
  { key: 'allyDamageBuffSingle', category: 'support', label: '아군 피해량 강화 (단독)',
    effects: [{ field: 'allyDamageBuffPercent', label: '아군 피해량 강화', tiers: [6.0, 7.5, 9.0], unit: '%' }] },
];

// 3단계 등급 색상(낮음→높음: 하늘색/보라색/주황색)과 라벨 — 팔찌 시뮬레이터 UI에서 사용.
// calculateBraceletOptionEfficiencies에서 "1:1 (상시발동 가정)" 방식으로 처리하는 필드들 — recompute로는
// 안 잡히므로(어떤 계산식에도 안 꽂혀 있음) 팔찌 시뮬레이터에서도 값 그대로 더해준다.
// enemyDamagePercent는 여기 포함하지 않음 — BRACELET_HOOKED_FIELD_SENTENCES에 이미 있어서 recompute
// 경로로 정확히 잡히므로, 여기 넣으면 중복 합산된다.
const BRACELET_DIRECT_1TO1_FIELDS = new Set([
  'backAttackDamagePercent', 'headAttackDamagePercent',
  'nonDirectionalDamagePercent', 'protectedTargetDamagePercent',
]);

const BRACELET_TIER_COLORS = ['#4FC3F7', '#9C6ADE', '#FF9F40'];
const BRACELET_TIER_LABELS = ['1단계', '2단계', '3단계'];

// buildDealerDataWithoutBraceletField의 다중 필드 버전 — 팔찌 시뮬레이터에서 "이 옵션 슬롯(1~2개 필드에
// 걸칠 수 있음) 하나가 통째로 없다고 가정"한 dealerData를 만들 때 쓴다. excludeKeys에 넣은 필드는 값과
// 무관하게 "이 슬롯 말고는 아무도 이 필드를 안 쓴다"고 전제하므로, 다른 슬롯도 같은 필드를 건드리는 경우
// (예: "치명타 피해 단독"과 "치명타 피해+치명타 적중 시 적주피"를 동시에 골라 둘 다 critDamagePercent를
// 올리는 경우)에는 쓰면 안 된다 — 그럴 땐 buildDealerDataWithFieldDeltas를 쓸 것.
function buildDealerDataWithoutBraceletFields(dealerData, braceletOptions, primaryStatFlat, excludeKeys) {
  const excludeSet = new Set(excludeKeys);
  const sentences = Object.keys(BRACELET_HOOKED_FIELD_SENTENCES)
    .filter((key) => !excludeSet.has(key) && braceletOptions[key])
    .map((key) => BRACELET_HOOKED_FIELD_SENTENCES[key](braceletOptions[key]));

  ['힘', '민첩', '지능'].forEach((stat) => {
    if (!excludeSet.has(stat) && primaryStatFlat[stat]) sentences.push(`${stat} +${primaryStatFlat[stat]} 증가한다.`);
  });

  const equipment = (dealerData.equipment || []).map((item) => ({ ...item }));
  const braceletIdx = equipment.findIndex((it) => it.Type === '팔찌');
  if (braceletIdx === -1) return { ...dealerData, equipment };

  const syntheticTooltip = {};
  sentences.forEach((s, i) => { syntheticTooltip['S' + i] = { value: s }; });
  equipment[braceletIdx] = { ...equipment[braceletIdx], Tooltip: JSON.stringify(syntheticTooltip) };
  return { ...dealerData, equipment };
}

// buildDealerDataWithoutBraceletFields와 달리 필드를 통째로 지우지 않고, fieldDeltas에 들어있는 만큼만
// braceletOptions/primaryStatFlat 값에서 빼서(음수 delta) 재구성한다. 팔찌 시뮬레이터에서 같은 필드를
// 건드리는 슬롯을 여러 개 고른 경우, "이 슬롯 하나만 뺐을 때"를 정확히 계산하려면 이걸 써야 한다
// (다른 슬롯의 기여분은 그대로 남겨둬야 함).
function buildDealerDataWithFieldDeltas(dealerData, braceletOptions, primaryStatFlat, fieldDeltas) {
  const sentences = Object.keys(BRACELET_HOOKED_FIELD_SENTENCES)
    .map((key) => ({ key, value: (braceletOptions[key] || 0) + (fieldDeltas[key] || 0) }))
    .filter(({ value }) => value > 0)
    .map(({ key, value }) => BRACELET_HOOKED_FIELD_SENTENCES[key](value));

  ['힘', '민첩', '지능'].forEach((stat) => {
    const value = (primaryStatFlat[stat] || 0) + (fieldDeltas[stat] || 0);
    if (value > 0) sentences.push(`${stat} +${value} 증가한다.`);
  });

  const equipment = (dealerData.equipment || []).map((item) => ({ ...item }));
  const braceletIdx = equipment.findIndex((it) => it.Type === '팔찌');
  if (braceletIdx === -1) return { ...dealerData, equipment };

  const syntheticTooltip = {};
  sentences.forEach((s, i) => { syntheticTooltip['S' + i] = { value: s }; });
  equipment[braceletIdx] = { ...equipment[braceletIdx], Tooltip: JSON.stringify(syntheticTooltip) };
  return { ...dealerData, equipment };
}

// 팔찌 시뮬레이터: 사용자가 고른 가상 옵션 조합(기본 옵션 최대 2개 + 부여 옵션 최대 3개)을 실제 팔찌와
// "교체"했다고 가정하고 효율표 + 총 변화율을 계산.
// selections = { basic: [{type, value}], grant: [{catalogKey, tierIndex}] } — type은
// BRACELET_BASIC_OPTION_TYPES 값, catalogKey/tierIndex는 BRACELET_OPTION_CATALOG의 key와 등급(0~2).
// 부여 옵션 한 슬롯을 고르면 그 카탈로그 항목의 effects(1~2개)가 전부 같이 세팅된다.
// 치명 스탯은 실제 팔찌가 이미 가진 치명 스탯 기여분을 고려하지 않고(즉 실제 팔찌에 치명이 있었어도 무시하고)
// "이 가상 치명 스탯만큼 추가로 있다"고 가정 — 실제 팔찌에 치명 스탯이 있는 경우는 드물어서 일단 이렇게 단순화.
function calculateHypotheticalBraceletEfficiency(dealerData, supportData, ctx, selections) {
  const braceletOptions = { ...EMPTY_BRACELET_OPTIONS };
  const primaryStatFlat = { 힘: 0, 민첩: 0, 지능: 0 };
  let specStat = 0;
  let swiftStat = 0;
  let critStat = 0;

  (selections.basic || []).forEach(({ type, value }) => {
    if (!type || !value) return;
    if (type === '주스탯') primaryStatFlat[getPrimaryStatName(dealerData.equipment)] = value;
    else if (type === '특화') specStat = value;
    else if (type === '신속') swiftStat = value;
    else if (type === '치명') critStat = value;
  });

  const grantSlots = (selections.grant || [])
    .filter((s) => s.catalogKey != null && s.tierIndex != null)
    .map((s) => ({ ...s, catalogEntry: BRACELET_OPTION_CATALOG.find((c) => c.key === s.catalogKey) }))
    .filter((s) => s.catalogEntry);

  grantSlots.forEach(({ catalogEntry, tierIndex }) => {
    catalogEntry.effects.forEach((effect) => {
      braceletOptions[effect.field] += effect.tiers[tierIndex] * (effect.stackMultiplier || 1);
    });
  });

  let hypotheticalDealerData = buildDealerDataWithoutBraceletField(dealerData, braceletOptions, primaryStatFlat, null);
  if (critStat) hypotheticalDealerData = buildDealerDataWithCritStatDelta(hypotheticalDealerData, critStat);

  const hypotheticalStats = calculateCharacterStats(hypotheticalDealerData);
  const hypotheticalCrit = calculateCritMultiplier(hypotheticalDealerData, supportData, { partyClassNames: ctx.partyClassNames });
  const hypotheticalExtra = calculateExtraDamageMultiplier(hypotheticalDealerData);
  const hypotheticalEnemy = calculateEnemyDamageMultiplier(hypotheticalDealerData, hypotheticalCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });
  const hypotheticalFinalDamage = calculateFinalDamage(
    hypotheticalStats.basePower, hypotheticalStats.accessoryAttackFlat, hypotheticalStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    hypotheticalStats.chaosCoreAttack.percent, hypotheticalStats.earringAttackPercent, hypotheticalStats.arkgridGemsAttackPercent,
    ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );
  const hypotheticalTotal = hypotheticalFinalDamage * hypotheticalCrit.avgDamageMultiplier * hypotheticalExtra.multiplier * hypotheticalEnemy.multiplier;

  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const totalChangePercent = ((hypotheticalTotal / realTotal) - 1) * 100;

  // 슬롯 하나(1~2개 필드)가 통째로 없다고 가정하고 다시 계산해서 hypotheticalTotal과 비교한 비율.
  // cooldownPenaltyPercent는 어떤 계산식에도 안 꽂혀 있어 재계산으로는 0이 나오므로, 실제 팔찌 효율표와
  // 동일한 고정 환산치(-46.511×0.02%)를 별도로 빼준다. incapacitatedDamagePercent도 재계산 대상이 아니라서
  // 15/100 효율 고정치를 별도로 더해준다.
  function slotEfficiencyPercent(catalogEntry, tierIndex) {
    // 실제 계산식에 꽂혀서 recompute로 잡히는 필드(BRACELET_HOOKED_FIELD_SENTENCES)만 "이 슬롯이 기여한
    // 만큼만" 빼고 다시 계산 — 필드를 통째로 지우면(buildDealerDataWithoutBraceletFields) 다른 슬롯이 같은
    // 필드에 얹은 값까지 같이 사라져서, 같은 필드를 건드리는 슬롯을 2개 이상 고르면 각 슬롯의 효율이
    // 부풀려지는 버그가 났었음(예: "치명타 피해 단독"과 "치명타 피해+치명타 적중 시 적주피"를 동시에
    // 고르면 둘 다 서로의 크리티컬 피해까지 포함해서 계산됐음) — buildDealerDataWithFieldDeltas로 이 슬롯의
    // 기여분만 빼도록 수정. 백어택/헤드어택/비방향성/보호효과대상/무력화처럼 recompute로는 안 잡히는
    // "상시발동 가정 1:1" 필드나, 재사용대기 페널티(고정환산)는 실제 팔찌 효율표와 동일하게 별도로 더/빼준다.
    const fieldDeltas = {};
    catalogEntry.effects.forEach((e) => {
      if (!BRACELET_HOOKED_FIELD_SENTENCES[e.field]) return;
      fieldDeltas[e.field] = (fieldDeltas[e.field] || 0) - e.tiers[tierIndex] * (e.stackMultiplier || 1);
    });
    let percent = 0;
    if (Object.keys(fieldDeltas).length) {
      const withoutData = buildDealerDataWithFieldDeltas(hypotheticalDealerData, braceletOptions, primaryStatFlat, fieldDeltas);
      const newStats = calculateCharacterStats(withoutData);
      const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames });
      const newExtra = calculateExtraDamageMultiplier(withoutData);
      const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });
      const newFinalDamage = calculateFinalDamage(
        newStats.basePower, hypotheticalStats.accessoryAttackFlat, hypotheticalStats.chaosCoreAttack.flat, ctx.supportBuffPower,
        hypotheticalStats.chaosCoreAttack.percent, hypotheticalStats.earringAttackPercent, hypotheticalStats.arkgridGemsAttackPercent,
        ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
      );
      const withoutTotal = newFinalDamage * newCrit.avgDamageMultiplier * newExtra.multiplier * newEnemy.multiplier;
      percent = ((hypotheticalTotal / withoutTotal) - 1) * 100;
    }

    catalogEntry.effects.forEach((e) => {
      if (BRACELET_DIRECT_1TO1_FIELDS.has(e.field)) percent += e.tiers[tierIndex];
      if (e.field === 'incapacitatedDamagePercent') percent += e.tiers[tierIndex] * BRACELET_INCAPACITATED_EFFICIENCY_RATE;
      if (e.field === 'cooldownPenaltyPercent') percent -= BRACELET_COOLDOWN_PENALTY_FLAT;
    });

    return percent;
  }

  const rows = [];
  ['힘', '민첩', '지능'].forEach((stat) => {
    if (!primaryStatFlat[stat]) return;
    const excludeFields = [stat];
    const withoutData = buildDealerDataWithoutBraceletFields(hypotheticalDealerData, braceletOptions, primaryStatFlat, excludeFields);
    const newStats = calculateCharacterStats(withoutData);
    const newFinalDamage = calculateFinalDamage(
      newStats.basePower, hypotheticalStats.accessoryAttackFlat, hypotheticalStats.chaosCoreAttack.flat, ctx.supportBuffPower,
      hypotheticalStats.chaosCoreAttack.percent, hypotheticalStats.earringAttackPercent, hypotheticalStats.arkgridGemsAttackPercent,
      ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
    );
    const withoutTotal = newFinalDamage * hypotheticalCrit.avgDamageMultiplier * hypotheticalExtra.multiplier * hypotheticalEnemy.multiplier;
    rows.push({ key: 'primaryStat_' + stat, label: `주스탯(${stat})`, value: primaryStatFlat[stat], method: '실스펙 환산', efficiencyPercent: ((hypotheticalTotal / withoutTotal) - 1) * 100 });
  });
  if (specStat) rows.push({ key: 'specialization', label: '특화(스탯)', value: specStat, method: '고정환산(1당 0.03%)', efficiencyPercent: specStat * BRACELET_SPECIALIZATION_RATE });
  if (swiftStat) rows.push({ key: 'swiftness', label: '신속(스탯)', value: swiftStat, method: '고정환산(1당 0.02%)', efficiencyPercent: swiftStat * BRACELET_SWIFTNESS_RATE });
  if (critStat) {
    const withoutData = buildDealerDataWithCritStatDelta(hypotheticalDealerData, -critStat);
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames });
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });
    const withoutTotal = hypotheticalFinalDamage * newCrit.avgDamageMultiplier * hypotheticalExtra.multiplier * newEnemy.multiplier;
    rows.push({ key: 'critStat', label: '치명(스탯)', value: critStat, method: '실스펙 환산', efficiencyPercent: ((hypotheticalTotal / withoutTotal) - 1) * 100 });
  }

  grantSlots.forEach(({ catalogEntry, tierIndex }) => {
    const valueText = catalogEntry.effects.map((e) => `${e.label} ${e.tiers[tierIndex]}${e.unit}`).join(' + ');
    rows.push({
      key: catalogEntry.key, label: catalogEntry.label, value: valueText, tierIndex,
      method: '실스펙 환산', efficiencyPercent: slotEfficiencyPercent(catalogEntry, tierIndex),
    });
  });

  return { rows, totalChangePercent };
}

const EMPTY_BRACELET_OPTIONS = {
  weaponAttackFlat: 0, weaponAttackFlatBase: 0, critRatePercent: 0, critDamagePercent: 0,
  critHitExtraDamagePercent: 0, enemyDamagePercent: 0, additionalDamagePercent: 0, demonDamagePercent: 0,
  cooldownPenaltyPercent: 0, backAttackDamagePercent: 0, headAttackDamagePercent: 0, nonDirectionalDamagePercent: 0,
  defenseReductionPercent: 0, critResistReductionPercent: 0, critDmgResistReductionPercent: 0,
  protectedTargetDamagePercent: 0, incapacitatedDamagePercent: 0,
  allyShieldHealPercent: 0, allyAttackBuffPercent: 0, allyDamageBuffPercent: 0,
};

// 어빌리티 스톤 시뮬레이터/9-7 최적화용 통합 카탈로그(16종) — ABILITY_STONE_ENGRAVING_CATALOG(엔진 계산에
// 이미 반영된 14종)에 아드레날린/예리한 둔기(기존 ADRENALINE_STONE_BONUS/SHARP_WEAPON_STONE_BONUS와
// 동일 수치)를 더한 전체 목록. 드롭다운/9-7 최적화 후보 나열용.
const ABILITY_STONE_FULL_CATALOG = {
  ...ABILITY_STONE_ENGRAVING_CATALOG,
  '아드레날린': { method: 'attackPower', levels: [ADRENALINE_STONE_BONUS[1], ADRENALINE_STONE_BONUS[2], ADRENALINE_STONE_BONUS[3], ADRENALINE_STONE_BONUS[4]] },
  '예리한 둔기': { method: 'critDamage', levels: [SHARP_WEAPON_STONE_BONUS[1], SHARP_WEAPON_STONE_BONUS[2], SHARP_WEAPON_STONE_BONUS[3], SHARP_WEAPON_STONE_BONUS[4]] },
};

// engravingsData를 복제하고, 모든 항목의 AbilityStoneLevel을 일단 초기화(=실제 스톤 효과 제거)한 뒤
// selections([{name, level}])의 각인만 AbilityStoneLevel을 설정 — 실제 5개 각인 중 이름이 일치하면 그
// 항목을 쓰고, 없으면(가상 조합용) 새 항목을 추가한다(Description은 비워둠 — getEngravingEnemyDamageByName
// 등 다른 함수가 엉뚱한 각인 자체 효과를 잘못 집계하지 않도록). 아드레날린은 여기 포함하지 않음(다른
// 데이터 경로 — calculateAbilityStoneTotal에서 별도 처리).
function buildEngravingsWithAbilityStoneSelections(engravingsData, selections) {
  const effects = ((engravingsData && engravingsData.ArkPassiveEffects) || []).map((e) => ({ ...e, AbilityStoneLevel: null }));
  (selections || []).forEach(({ name, level }) => {
    if (!name || !level || name === '아드레날린') return;
    const existing = effects.find((e) => e.Name === name);
    if (existing) {
      existing.AbilityStoneLevel = level;
    } else {
      effects.push({ Name: name, AbilityStoneLevel: level, Level: 0, Description: '' });
    }
  });
  return { ...engravingsData, ArkPassiveEffects: effects };
}

// 어빌리티 스톤 시뮬레이터/9-7 최적화가 공유하는 핵심 계산 — selections(최대 2개, {name, level})를
// "실제 스톤과 교체"했다고 가정한 전체 딜(최종데미지×치명타×추가피해×적주피)을 반환.
// extraBaseAttackPercent: 9-7(3lv&2lv) 스톤 고정 보너스(기본 공격력 +1.5%)처럼, 스톤의 "레벨 보너스"
// 슬롯에 추가로 얹을 기본 공격력%(합연산, calculateAbilityStoneBaseAttackPercent와 같은 자리).
function calculateAbilityStoneTotal(dealerData, dealerStats, ctx, selections, overrideBaseAttackPercent) {
  const validSelections = (selections || []).filter((s) => s.name && s.level);
  const adrenalineSelection = validSelections.find((s) => s.name === '아드레날린');
  const adrenalineDelta = adrenalineSelection ? (ADRENALINE_STONE_BONUS[adrenalineSelection.level] || 0) : 0;
  const realAdrenalineStoneBonus = getAdrenalineStoneBonus(dealerData.equipment);
  const hypotheticalAdrenalineBonusBase = ctx.adrenalineBonusBase - realAdrenalineStoneBonus + adrenalineDelta;

  const modifiedDealerData = {
    ...dealerData,
    engravings: buildEngravingsWithAbilityStoneSelections(dealerData.engravings, validSelections),
  };

  const newCrit = calculateCritMultiplier(modifiedDealerData, ctx.supportData, { partyClassNames: ctx.partyClassNames });
  const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
  const newEnemy = calculateEnemyDamageMultiplier(modifiedDealerData, newCrit.critRatePercent, ctx.supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames });

  // overrideBaseAttackPercent가 주어지면(9-7 최적화용 — 모든 후보가 "새로 뽑은 3lv&2lv 스톤"이라는
  // 가정이라 실제 스톤의 레벨 보너스와 무관하게 고정 +1.5%로 교체) 그 값을 쓰고, 없으면(일반 시뮬레이터 —
  // 어떤 레벨 보너스가 나올지 모르므로 건드리지 않음) 실제 스톤의 레벨 보너스를 그대로 유지한다.
  // 실제 스톤의 레벨 보너스에 더하는 게 아니라 통째로 교체하는 것이 핵심 — 안 그러면 실제 스톤이 이미
  // 3lv&2lv라 레벨 보너스 1.5%를 갖고 있는 경우 이중으로 합산된다.
  const gemPercent = getGemsBaseAttackPercent(dealerData.gems);
  const stonePercent = overrideBaseAttackPercent !== undefined ? overrideBaseAttackPercent : getAbilityStoneBaseAttackPercent(dealerData.equipment);
  const basePower = calculateBaseAttackPower(
    dealerStats.purePower, gemPercent, stonePercent + dealerStats.wanjibStats.baseAttackPercent
  ) + dealerStats.wanjibStats.baseAttackFlat;

  const newFinalDamage = calculateFinalDamage(
    basePower, dealerStats.accessoryAttackFlat, dealerStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    dealerStats.chaosCoreAttack.percent, dealerStats.earringAttackPercent, dealerStats.arkgridGemsAttackPercent,
    hypotheticalAdrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );
  return newFinalDamage * newCrit.avgDamageMultiplier * newExtra.multiplier * newEnemy.multiplier;
}

// 어빌리티 스톤 시뮬레이터: 가상 각인 조합(최대 2개, 실제 스톤과 동일한 슬롯 수)을 실제 스톤과
// "교체"했다고 가정하고 효율표 + 총 변화율을 계산.
function calculateHypotheticalAbilityStoneEfficiency(dealerData, dealerStats, ctx, selections) {
  const validSelections = (selections || []).filter((s) => s.name && s.level);
  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const hypotheticalTotal = calculateAbilityStoneTotal(dealerData, dealerStats, ctx, validSelections);
  const totalChangePercent = ((hypotheticalTotal / realTotal) - 1) * 100;

  const rows = validSelections.map((sel) => {
    const withoutSelections = validSelections.filter((s) => s !== sel);
    const withoutTotal = calculateAbilityStoneTotal(dealerData, dealerStats, ctx, withoutSelections);
    const efficiencyPercent = ((hypotheticalTotal / withoutTotal) - 1) * 100;
    return { key: sel.name, label: sel.name, value: `Lv.${sel.level}`, efficiencyPercent };
  });

  return { rows, totalChangePercent };
}

// 현재 착용 중인 어빌리티 스톤의 실제 각인 효과(최대 2개) 각각의 환산 효율 + 스톤 전체의 총 환산 효율
// ("스톤이 아예 없었다면"과 비교) — 팔찌/장비 정보 표의 효율표·합산 행과 같은 성격.
function calculateCurrentAbilityStoneEfficiency(dealerData, dealerStats, ctx) {
  const realSelections = getAbilityStoneEngravingEffects(dealerData.equipment);
  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const noStoneTotal = calculateAbilityStoneTotal(dealerData, dealerStats, ctx, [], 0);
  const totalEfficiencyPercent = ((realTotal / noStoneTotal) - 1) * 100;

  const rows = realSelections.map((sel) => {
    const otherSelections = realSelections.filter((s) => s !== sel).map((s) => ({ name: s.name, level: s.level }));
    const withoutTotal = calculateAbilityStoneTotal(dealerData, dealerStats, ctx, otherSelections);
    const efficiencyPercent = ((realTotal / withoutTotal) - 1) * 100;
    return { key: sel.name, label: sel.name, value: `Lv.${sel.level}`, efficiencyPercent };
  });

  return { rows, totalEfficiencyPercent };
}

// "9/7 어빌리티 스톤 최적화": 현재 착용 중인 5개 각인 중 어떤 조합(Lv.3 + Lv.2)이 가장 높은 딜을 주는지
// 전수 탐색(20가지 순서쌍). 3lv&2lv(구 9/7) 스톤은 기본 공격력 +1.5%가 고정으로 붙는다고 가정 —
// 모든 후보에 동일하게 적용되므로 "어느 조합이 최선인지"에는 영향 없지만, 실제 착용 스톤 대비 변화율
// 계산에는 포함해야 정확하다.
const STONE_3_2_BASE_ATTACK_BONUS = 1.5;

function calculateAbilityStone97Optimization(dealerData, dealerStats, ctx) {
  const equippedNames = ((dealerData.engravings && dealerData.engravings.ArkPassiveEffects) || []).map((e) => e.Name);
  if (equippedNames.length < 2) return null;

  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;

  let best = null;
  equippedNames.forEach((lv3Name) => {
    equippedNames.forEach((lv2Name) => {
      if (lv3Name === lv2Name) return;
      const selections = [{ name: lv3Name, level: 3 }, { name: lv2Name, level: 2 }];
      const total = calculateAbilityStoneTotal(dealerData, dealerStats, ctx, selections, STONE_3_2_BASE_ATTACK_BONUS);
      if (!best || total > best.total) best = { lv3Name, lv2Name, total };
    });
  });

  return {
    lv3: best.lv3Name,
    lv2: best.lv2Name,
    changePercent: ((best.total / realTotal) - 1) * 100,
  };
}

// 아크그리드 6개 코어 슬롯을 이름/투자 포인트/등급 그대로 나열 (Slot.Name에 "질서의 해 코어 : ..." 형태로
// 질서·혼돈/해·달·별 구분이 이미 포함되어 있어 별도 텍스트 파싱 없이 그대로 사용)
function getArkgridCoreSummary(arkgridData) {
  if (!arkgridData || !arkgridData.Slots) return [];
  return arkgridData.Slots.map((slot) => ({
    name: slot.Name,
    point: slot.Point,
    grade: slot.Grade,
  }));
}

// 딜러의 모든 각인(ArkPassiveEffects)을 이름/레벨만 나열 (유물 각인서 정보 표시용)
function getEngravingList(engravingsData) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return [];
  return engravingsData.ArkPassiveEffects.map((e) => ({ name: e.Name, level: e.Level }));
}

// 캐릭터의 "직업 각인"(빌드 이름) 반환. arkpassive API 응답의 최상위 Title 필드가 바로 그 값
// (예: "잔재된 기운") — 클래스별 하드코딩 테이블 없이 전 클래스 공통으로 동작.
function getClassBuildEngravingName(arkpassiveData) {
  return (arkpassiveData && arkpassiveData.Title) || null;
}

// 서포터 아덴기(정체성 스킬) 피해량 증가 배율
// = [1 + 기본%×(1+아군피해량효과증가/100)×(1+특화계수/100)×1.2×보석레벨×(1+스킬전용운명코어%/100)] × 피증1유효율
// 특화계수 = 특화 스탯 × 클래스별 계수(예: 도화가 0.0600%/1당)
function calculateSupportAdenkiDamageBuffMultiplier(supportData, className, options) {
  const config = SUPPORT_DAMAGE_BUFF_CLASS_CONFIG[className];
  if (!config) return { multiplier: 1, breakdown: { 지원안되는직업: className } };

  const { effectiveRatio1 = 1 } = options || {};

  const braceletOptions = getBraceletOptionsFromEquipment(supportData?.equipment);
  const allyDamageBuffPercent = getTotalAllyDamageBuffPercent(supportData?.equipment, supportData?.arkgrid, braceletOptions);
  const specializationStat = getStatValueFromProfile(supportData?.profiles, '특화');
  const specializationCoefficientPercent = specializationStat * config.specializationCoefficient;
  const gemLevel = getSkillGemLevel(supportData?.gems, config.gemSkillName);
  const skillCoreBonusPercent = getSkillSpecificAllyDamageBuffFromArkgridCores(supportData?.arkgrid, config.adenkiSkillName);

  const multiplier =
    (1 +
      (config.adenkiBaseRate / 100) *
        (1 + allyDamageBuffPercent / 100) *
        (1 + specializationCoefficientPercent / 100) *
        1.2 *
        gemLevel *
        (1 + skillCoreBonusPercent / 100)) *
    effectiveRatio1;

  return {
    multiplier,
    breakdown: {
      아군피해량효과증가: allyDamageBuffPercent,
      특화스탯: specializationStat,
      특화계수: specializationCoefficientPercent,
      보석레벨: gemLevel,
      스킬전용코어보너스: skillCoreBonusPercent,
      피증1_유효율: effectiveRatio1,
    },
  };
}

// 서포터 초각성 스킬 피해량 증가 배율
// = [1 + 10%×(1+아군피해량효과증가/100)×(1+스킬전용운명코어%/100)] × 피증2유효율
function calculateSupportHyperAwakeningDamageBuffMultiplier(supportData, className, options) {
  const config = SUPPORT_DAMAGE_BUFF_CLASS_CONFIG[className];
  if (!config) return { multiplier: 1, breakdown: { 지원안되는직업: className } };

  const { effectiveRatio2 = 1 } = options || {};

  const braceletOptions = getBraceletOptionsFromEquipment(supportData?.equipment);
  const allyDamageBuffPercent = getTotalAllyDamageBuffPercent(supportData?.equipment, supportData?.arkgrid, braceletOptions);
  const skillCoreBonusPercent = getSkillSpecificAllyDamageBuffFromArkgridCores(supportData?.arkgrid, config.hyperSkillName);

  const multiplier =
    (1 +
      (config.hyperBaseRate / 100) *
        (1 + allyDamageBuffPercent / 100) *
        (1 + skillCoreBonusPercent / 100)) *
    effectiveRatio2;

  return {
    multiplier,
    breakdown: {
      아군피해량효과증가: allyDamageBuffPercent,
      스킬전용코어보너스: skillCoreBonusPercent,
      피증2_유효율: effectiveRatio2,
    },
  };
}

// 최종 산출식 = 최종데미지 × 치명타배율 × 추가피해 × 적에게 주는 피해 × 방어율 × 서포터 낙인 × 카드
// 지금까지 만든 실험용 배율 5종(치명타/추가피해/적주피/방어율/카드) + 서포터 낙인 + 최종데미지를 전부 곱한, 이 툴의 최종 결과값
function calculateFinalOutput(finalDamage, critMultiplier, extraDamageMultiplier, enemyDamageMultiplier, defenseMultiplier, brandMultiplier, cardMultiplier) {
  const output =
    finalDamage *
    critMultiplier *
    extraDamageMultiplier *
    enemyDamageMultiplier *
    defenseMultiplier *
    brandMultiplier *
    cardMultiplier;

  return {
    output,
    breakdown: {
      최종데미지: finalDamage,
      치명타배율: critMultiplier,
      추가피해: extraDamageMultiplier,
      적에게주는피해: enemyDamageMultiplier,
      방어율: defenseMultiplier,
      서포터낙인: brandMultiplier,
      카드: cardMultiplier,
    },
  };
}

// 풀버프 최종 산출식 = 최종 산출식 × 서포터 아군 피해량 증가(아덴기) × 서포터 아군 피해량 증가(초각성)
// (최종 산출식 자체는 그대로 두고, 서폿 피증까지 곱한 별도 결과값)
function calculateFullBuffFinalOutput(finalOutput, adenkiDamageBuffMultiplier, hyperAwakeningDamageBuffMultiplier) {
  const output = finalOutput * adenkiDamageBuffMultiplier * hyperAwakeningDamageBuffMultiplier;

  return {
    output,
    breakdown: {
      최종산출식: finalOutput,
      아덴기배율: adenkiDamageBuffMultiplier,
      초각성배율: hyperAwakeningDamageBuffMultiplier,
    },
  };
}
