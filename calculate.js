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

  // 실제 팔찌 텍스트는 "재사용 대기 시간이"(공백 있음)인데 기존 정규식이 "대기시간"(공백 없음)만 찾아서
  // 실제 캐릭터 데이터에서는 항상 매칭 실패하던 버그 — \s*로 공백 유무 둘 다 허용하도록 수정.
  m = text.match(/재사용\s*대기\s*시간이\s*([\d.]+)\s*%\s*증가/);
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
// 무기공격력 → 순수공격력 → 기본공격력 → 스탯창공격력까지 전부 계산해서 객체로 반환.
// customDeltas(선택) — { weaponAttackFlat, weaponAttackPercent } — "커스텀" 탭 시뮬레이터가
// 무기공격력에 임의의 고정치/퍼센트를 더해서 재계산할 때 사용(순수공격력=sqrt(주스탯×무기공격력/6)
// 관계상 단순 후처리로는 정확한 값이 안 나와서, 무기공격력을 만드는 시점에 직접 더해야 함).
// 안 넘기면 전부 0이라 기존 호출부(수십 곳)는 전혀 영향 없음.
function calculateCharacterStats(data, customDeltas) {
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

  const customWeaponAttackFlat = (customDeltas && customDeltas.weaponAttackFlat) || 0;
  const customWeaponAttackPercent = (customDeltas && customDeltas.weaponAttackPercent) || 0;
  const flatBonusSum = braceletFlat + coreFlat + wanjibStats.weaponAttackFlat + customWeaponAttackFlat;
  const percentBonusSum = earringWeaponPercent + corePercentWeapon + enlightenmentPercent + customWeaponAttackPercent;
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

// 아크패시브(진화+깨달음)의 "적에게 주는 피해" % 합산. 조건부/시간제한 노드도 일단 포함하지만, "치명타
// (로) 적중 시 적에게 주는 피해가 X% 증가" 문구는 제외해야 한다 — 이건 getArkPassiveCritOnHitPercent가
// 치명타 적중 시에만 곱연산으로 이미 정확히 반영하고 있어서, 여기서 또 세면 상시 적용되는 것처럼 이중
// 반영된다(실측 발견: 잼구릿 진화 트리 최적화에서 '회심' 채용 시 상시버프_적주피가 22%→34%로 부풀려져서
// 회심의 실제 가치가 과대평가되고 있었음 — 4티어 회심/달인 비교에 직접 영향).
function getArkPassivePersistentEnemyDamagePercent(arkpassiveData) {
  const stripCritOnHit = (text) => text.replace(/치명타(?:로|론)?\s*(?:적중\s*)?시\s*적에게\s*주는\s*피해가\s*[\d.]+\s*%\s*증가(?:하며|하고)?/g, '');
  const evo = stripCritOnHit(getArkPassivePersistentEffectsText(arkpassiveData, '진화'));
  const real = stripCritOnHit(getArkPassivePersistentEffectsText(arkpassiveData, '깨달음'));
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

// 전투 스킬 Tooltip에서 "현재 레벨"의 부가효과 설명 텍스트만 추출 — 트라이포드/룬과는 별개로 스킬 자체에
// 항상 붙어있는 효과(예: "번개의 속삭임" - "스킬 시전 시 12초 동안 치명타 적중률이 10.0% 증가한다.").
// Tooltip 객체를 키 순서대로(숫자 접미사라 삽입순=원문 순서) 훑다가 "BlinkLineStart" 타입을 만나면 그
// 이전까지만 현재 레벨 설명이고, 그 이후는 "다음 스킬 레벨" 미리보기라 반드시 거기서 멈춰야 한다(안 그러면
// 아직 안 찍은 다음 레벨 수치까지 섞여 들어감). 그 구간의 마지막 SingleTextBox가 데미지+부가효과 문장이다.
function getCombatSkillInnateEffectText(skillTooltipStr) {
  let text = '';
  try {
    const obj = JSON.parse(skillTooltipStr);
    for (const key of Object.keys(obj)) {
      const el = obj[key];
      if (!el) continue;
      if (el.type === 'BlinkLineStart') break;
      if (el.type === 'SingleTextBox' && typeof el.value === 'string') {
        text = stripHtml(el.value);
      }
    }
  } catch (e) {}
  return text;
}

// 실제로 투자한(Level > 1 — 안 배운 스킬은 Level이 1로 고정된 채 트라이포드도 전부 미선택 상태로 내려옴)
// 전투 스킬 전체의 부가효과 텍스트를 이어붙임 — 아크패시브 진화/깨달음 텍스트 합치기와 같은 패턴.
function getCombatSkillsInnateEffectsText(combatSkillsData) {
  if (!Array.isArray(combatSkillsData)) return '';
  return combatSkillsData
    .filter((sk) => (sk.Level || 0) > 1)
    .map((sk) => getCombatSkillInnateEffectText(sk.Tooltip))
    .join(' ');
}

// 실제로 찍은(IsSelected) 트라이포드 전체의 효과 텍스트를 이어붙임 — 예: "다크 오더" 트라이포드처럼
// 스킬 자체 설명이 아니라 트라이포드에 지속형 버프가 달려있는 경우를 잡기 위함(스킬 부가효과와 트라이포드
// 둘 다에서 지속형 버프가 나올 수 있다는 걸 사용자가 "마엘스톰" 실측으로 확인시켜줌).
function getCombatSkillsSelectedTripodsText(combatSkillsData) {
  if (!Array.isArray(combatSkillsData)) return '';
  const parts = [];
  combatSkillsData.forEach((sk) => {
    (sk.Tripods || []).forEach((t) => {
      if (t.IsSelected) parts.push(stripHtml(t.Tooltip));
    });
  });
  return parts.join(' ');
}

// "N초간"/"N초 동안"이 명시된 문장만 남김 — 지속시간이 있는 일시적 버프(1단계 대상, 상시 가동 가정)와
// 지속시간 언급 없이 그 스킬/트라이포드 자체에 항상 붙어있는 상시 패시브(예: "치명타 적중률이 40% 증가한다"
// — 스킬 전용이라 사용 비중에 따라 달라져야 하므로 "전투분석 사진 등록" 2단계 대상)를 구분하기 위함.
// 문장 경계는 ". " (마침표+공백)로 나누는데, "12.8%" 같은 소수점은 마침표 뒤에 공백이 없어서 안 걸림.
function filterDurationSentences(text) {
  if (!text) return '';
  return text
    .split(/(?<=\.)\s+/)
    .filter((s) => /\d+(?:\.\d+)?\s*초\s*(?:간|동안)/.test(s))
    .join(' ');
}

// 스킬 자체 부가효과 + 실제로 찍은 트라이포드 전체를 합쳐서, 그중 지속시간이 명시된(=일시적 버프) 문장만
// 남긴 텍스트 — 1단계(지속형 버프, 상시 가동 가정)에서 재사용할 공통 소스.
function getCombatSkillsPersistentBuffText(combatSkillsData) {
  const innate = getCombatSkillsInnateEffectsText(combatSkillsData);
  const tripods = getCombatSkillsSelectedTripodsText(combatSkillsData);
  return filterDurationSentences(`${innate} ${tripods}`);
}

// 지속형 버프 중 "N초 동안/간 치명타 적중률이 X% 증가한다" 패턴 합산(스킬 부가효과 + 트라이포드 모두 포함) —
// 지속시간과 무관하게 우선 상시 발동한다고 가정(사용자 지정 컨벤션, 예외 상황은 추후 개별 입력 예정 —
// 기존 아크패시브 "조건부는 상시 발동 가정" 컨벤션과 동일선상).
function getCombatSkillPersistentCritRatePercent(combatSkillsData) {
  return extractPercent(getCombatSkillsPersistentBuffText(combatSkillsData), '치명타 적중률');
}

// 지속형 버프 중 이동속도 증가% 합산(스킬 부가효과 + 트라이포드 모두 포함, "이동속도"/"이동 속도" 두 표기
// 다 매칭) — 아크패시브 진화 5티어 "음속 돌파" 노드의 초과 이동속도 전환 공식에 쓰기 위해 값만 우선
// 확보해 둔 것(그 전환 공식 자체는 5티어 조건부 로직이라 아직 미구현, 다음 단계에서 연결 예정 — 지금은
// 어디에도 반영되지 않는 순수 조회용 함수).
function getCombatSkillPersistentMoveSpeedPercent(combatSkillsData) {
  return extractPercent(getCombatSkillsPersistentBuffText(combatSkillsData), '이동\\s*속도');
}

// === 전투분석 사진 등록 시스템 (2단계: 스킬/트라이포드 전용 상시 패시브) ===
// 지속시간(N초) 없이 그 스킬을 쓸 때만 항상 붙는 패시브(예: "예리한 사격" - "치명타 적중률이 40.0%
// 증가하고, 치명타 피해가 58.0% 증가한다")는 캐릭터 전체에 상시 적용되는 게 아니라, 전투분석에서 그
// 스킬의 실제 피해량 지분(%)만큼만 반영해야 한다. 사용자가 등록한 전투분석 사진에서 "스킬이름 + 피해량
// 지분(%)"을 뽑아 넘기면, 지분 2% 이상인 주요 스킬은 그 스킬 전용 보너스를 반영한 개별 배율로, 나머지
// (지분 2% 미만 스킬들의 합 + 전투분석 API에 없는 스킬 — 예: 소환수 자체 공격, 트라이포드 없는 정체성
// 스킬)는 "스킬/트라이포드 영향 없음" 기본 배율로 계산한 뒤 지분 가중 평균한다.

// "N초간"/"N초 동안" 없는 문장만 남김 — filterDurationSentences의 역. 지속시간이 없는 스킬/트라이포드
// 전용 상시 패시브(2단계 대상)를 걸러내기 위함.
function filterNonDurationSentences(text) {
  if (!text) return '';
  return text
    .split(/(?<=\.)\s+/)
    .filter((s) => !/\d+(?:\.\d+)?\s*초\s*(?:간|동안)/.test(s))
    .join(' ');
}

// combatSkills 배열에서 이름으로 스킬 하나를 찾음(전투분석 사진에서 뽑은 스킬 이름과 매칭용)
function findCombatSkillByName(combatSkillsData, name) {
  if (!Array.isArray(combatSkillsData)) return null;
  return combatSkillsData.find((sk) => sk.Name === name) || null;
}

// 특정 스킬 하나(전투분석에서 지목된 스킬)의 "스킬 자체 부가효과 + 실제로 찍은 트라이포드" 텍스트 중
// 지속시간 없는(=그 스킬 전용 상시) 문장만 추출
function getCombatSkillOwnNonDurationText(skill) {
  if (!skill) return '';
  const innate = getCombatSkillInnateEffectText(skill.Tooltip);
  const tripodParts = (skill.Tripods || []).filter((t) => t.IsSelected).map((t) => stripHtml(t.Tooltip));
  return filterNonDurationSentences(`${innate} ${tripodParts.join(' ')}`);
}

// 스킬 하나의 전용(트라이포드 포함) 치명타 적중률/피해 % 추출
function getCombatSkillSpecificCritBonus(skill) {
  const text = getCombatSkillOwnNonDurationText(skill);
  return {
    critRatePercent: extractPercent(text, '치명타 적중률'),
    critDamagePercent: extractPercent(text, '치명타\\s*피해'),
  };
}

// 전투분석 사진에서 추출된 [{name, sharePercent}] 배열을 받아, 지분 2% 이상 스킬은 그 스킬 전용 보너스를
// 반영한 개별 평균피해배율로, 나머지 지분은 기본(스킬 영향 없음) 배율로 계산한 뒤 지분 가중 평균한다.
const COMBAT_ANALYSIS_MAJOR_SHARE_THRESHOLD = 2;

function calculateCombatAnalysisWeightedCrit(dealerData, supportData, options, skillShares) {
  const baseCrit = calculateCritMultiplier(dealerData, supportData, options);
  const skillRows = [];
  let majorShareTotal = 0;
  let weightedMultiplier = 0;

  (skillShares || []).forEach((row) => {
    const share = row.sharePercent || 0;
    if (share < COMBAT_ANALYSIS_MAJOR_SHARE_THRESHOLD) return;
    const skill = findCombatSkillByName(dealerData.combatSkills, row.name);
    const hasTripods = skill && (skill.Tripods || []).some((t) => t.IsSelected);
    if (!skill || !hasTripods) {
      skillRows.push({
        name: row.name, sharePercent: share, matched: false,
        critRateBonus: 0, critDamageBonus: 0, avgDamageMultiplier: baseCrit.avgDamageMultiplier,
      });
      majorShareTotal += share;
      weightedMultiplier += (share / 100) * baseCrit.avgDamageMultiplier;
      return;
    }
    const bonus = getCombatSkillSpecificCritBonus(skill);
    const skillCrit = calculateCritMultiplier(dealerData, supportData, {
      ...options,
      extraCritRatePercent: bonus.critRatePercent,
      extraCritDamagePercent: bonus.critDamagePercent,
    });
    skillRows.push({
      name: row.name, sharePercent: share, matched: true,
      critRateBonus: bonus.critRatePercent, critDamageBonus: bonus.critDamagePercent,
      avgDamageMultiplier: skillCrit.avgDamageMultiplier,
    });
    majorShareTotal += share;
    weightedMultiplier += (share / 100) * skillCrit.avgDamageMultiplier;
  });

  const remainderSharePercent = Math.max(0, 100 - majorShareTotal);
  weightedMultiplier += (remainderSharePercent / 100) * baseCrit.avgDamageMultiplier;

  return {
    baseAvgDamageMultiplier: baseCrit.avgDamageMultiplier,
    weightedAvgDamageMultiplier: weightedMultiplier,
    majorShareTotal, remainderSharePercent,
    skillRows,
  };
}

// 초각성기/초각성 스킬/아이덴티티(Z·X) 스킬 이름 — combat-skills API 응답에 아예 없는 스킬들이라
// 전투분석 사진 OCR 이름 매칭 후보로 쓰기 위한 정적 테이블(직업별 수동 입력, 클라이언트에서 실측).
// 이 이름들로 매칭돼도 findCombatSkillByName은 API에서 못 찾으므로 null을 반환 → 자동으로 "조건없음"
// 기본 배율로 처리된다(트라이포드 보너스는 없지만 이름은 인식되어 빨간 경고가 안 뜸). 아이덴티티는
// 각인/스타일에 따라 이름이 갈리는 직업이 많은데, 사진만 봐서는 어떤 빌드인지 알 수 없으므로 알려진
// 이름을 전부 나열해 후보에 포함시킨다(고정 Z/X 스킬명이 없는 직업—배틀마스터/기공사/창술사/스트라이커/
// 차원술사 등—은 초각성기·초각성 스킬만 넣고 아이덴티티는 뺌).
const HYPER_AWAKENING_IDENTITY_SKILL_NAMES = {
  워로드: ['수호의 맹세', '정의 실현', '실드 대시', '풀배럴 캐넌', '방어태세', '전장의 방패', '진격태세', '전장의 창'],
  버서커: ['블러디 버스트', '레이지 블레이드', '퓨리 메소드', '블러드 슬래시', '블러디 러쉬', '다크 러쉬', '광기 해제'],
  디스트로이어: ['갤럭시 브레이크', '하이퍼 빅뱅', '체인 스트라이크', '슈퍼노바', '중력 가중 영역', '볼텍스 그라비티', '강제 종료'],
  홀리나이트: ['알리사노스의 격노', '알리사노스의 헌신', '신성한 정의', '판결집행', '신의 집행자', '심판의 칼날', '신성 파도', '신성의 오라'],
  슬레이어: ['레이지 슬래셔', '라그나 블레이드', '스파이럴 블레이드', '플레임 블레이드', '블러드러스트'],
  발키리: ['브뢴디아의 성역', '브뢴디아의 화신', '개벽', '신의 증명', '빛의 기사', '종언의 빛', '빛의 해방', '신념의 빛'],
  배틀마스터: ['극의: 팔괘난격', '극의: 대라파마각', '창천각', '오의: 금뢰각'],
  인파이터: ['신룡창세', '극: 파천섬멸권', '열혈폭격', '천지파권', '투지발산'],
  기공사: ['낙일멸천옥', '초신마섬광', '천하군림보', '천공참'],
  창술사: ['연가창식: 은하비섬창', '연가창식: 마룡합일섬', '맹룡난무', '적룡필살'],
  스트라이커: ['극의: 산군포효', '극의: 진천낙뢰각', '전진패도격', '오의: 청염각'],
  브레이커: ['일월신권', '천견지종', '천왕지무', '성운멸쇄권', '권왕태세', '수라 상태', '호신투기'],
  데빌헌터: ['데들리 케이지', '블라우어 블리츠', '래피드 파이어', '둠스 데이', '죽음의 표적'],
  블래스터: ['A.C.O.M: 폭격 지원', 'A.C.O.M: 출격', '포격: 스틸 레인', '미사일 런처', '포격 모드 전환', '오버히트'],
  호크아이: ['기간틱 보우: 펜리르', 'A.A.G.A: 데드 아이', '스파이럴 애로우', '락온', '폭풍의 날개', '실버호크 강습', '최후의 습격', '실버호크 MK2'],
  스카우터: ['배틀쉽 오퍼레이션', '프로젝트 타이탄', '네오 파이어', '포인트 익스클루션', '하이퍼 싱크'],
  건슬링어: ['데드 엔드', '아토믹 익스플로전', '프리즌 불릿', '세븐 샷건', '불스 아이', '로즈 블로썸'],
  아르카나: ['더 타워', '데스', '더 썬', '더 데빌'],
  서머너: ['심판자 켈시온', '바그론의 광란', '마리포사', '이그나'],
  바드: ['심포니 칸타빌레', '콘체르토', '아리아', '비바체', '용맹의 세레나데', '템페스트', '구원의 세레나데'],
  소서리스: ['초월자의 심판', '아포칼립스', '라바 블래스트', '러닝 글레이셔', '마력 방출', '마력 해방', '점멸'],
  블레이드: ['이터널 플래시', '카오틱 블레이드', '브레이킹 문', '데스 슬래쉬', '블레이드 아츠', '블레이드 버스트'],
  데모닉: ['다크니스 블라스트', '레이 오브 루인', '블러드 마쉬', '와일드 슬래쉬', '악마화'],
  리퍼: ['카덴차 델 루나', '레퀴엠 델 솔', '쉐도우 나이프', '피니쉬 스텝', '페르소나', '나이트메어'],
  소울이터: ['데스 콤비네이션', '더 페이탈리티', '데스 피날레', '프랜지 사이드'],
  도화가: ['신수도: 봉황', '몽중백화원', '묵법: 소떼몰이', '묵법: 미르 새김', '저무는 달', '떠오르는 해'],
  기상술사: ['아카샤의 너울', '칸의 영역', '우레바람', '여름 햇살', '여우비', '공간가르기', '눈부신 나날들'],
  환수사: ['꿀밤 강타', '여우불의 춤', '한방 곰', '두둥실 여우곰', '찢 곰', '여우 별 소나기'],
  차원술사: ['무간의 옥', '찰나', '업의 경계', '일념'],
  가디언나이트: ['브레스 오브 엠버레스', '어웨이큰', '소울 디바이드', '딥 임팩트', '인페르노 버스트', '가디언 피어', '가디언 스케일'],
};

function getClassHyperAwakeningIdentitySkillNames(className) {
  return HYPER_AWAKENING_IDENTITY_SKILL_NAMES[className] || [];
}

// === 전투분석 사진 등록 시스템: OCR 텍스트 파싱 (DOM/이미지 처리는 index.html, 여기는 순수 텍스트 처리만) ===
// Tesseract OCR 결과 텍스트(줄 단위)에서, "%로 끝나는 숫자가 있는 줄"만 후보로 삼아 그 줄의 가장 마지막
// %를 피해량 지분(전투분석 표의 맨 오른쪽 컬럼)으로, 첫 숫자 앞까지의 텍스트를 스킬 이름 후보로 추출한다.
// 이름 후보는 OCR 잡음(아이콘 오인식 등)이 섞이는 경우가 많아서 그대로 못 쓰고 fuzzyMatchSkillName으로
// 실제 캐릭터 스킬 이름과 대조해야 한다.
function parseCombatAnalysisLine(line) {
  const percentMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (percentMatches.length === 0) return null;
  const sharePercent = parseFloat(percentMatches[percentMatches.length - 1][1]);
  if (Number.isNaN(sharePercent)) return null;
  const numIdx = line.search(/[0-9]/);
  // 줄이 숫자로 바로 시작하면(아이콘 오인식 등으로 이름이 아예 안 남은 경우) 이름 후보를 만들지 않고
  // 매칭 실패로 남겨서(사용자가 드롭다운으로 직접 고름), 숫자 잡음 전체를 이름처럼 오매칭하지 않는다.
  const nameCandidate = numIdx > 1 ? line.slice(0, numIdx).trim() : '';
  return { rawName: nameCandidate, sharePercent };
}

function parseCombatAnalysisOcrText(rawText) {
  if (!rawText) return [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach((line) => {
    const row = parseCombatAnalysisLine(line);
    if (row) rows.push(row);
  });
  return rows;
}

// parseCombatAnalysisOcrText와 동일하지만, Tesseract의 줄 단위 바운딩 박스(lines: [{text, bbox}])를 받아
// 각 행에 bbox를 그대로 실어서 반환 — 아이콘 교차 검증(그 줄의 텍스트 시작 위치로 아이콘 영역을 잘라내기
// 위해) 좌표가 필요한 호출부에서 사용.
function parseCombatAnalysisOcrLines(lines) {
  if (!Array.isArray(lines)) return [];
  const rows = [];
  lines.forEach((line) => {
    const text = (line.text || '').trim();
    if (!text) return;
    const row = parseCombatAnalysisLine(text);
    if (row) rows.push({ ...row, bbox: line.bbox });
  });
  return rows;
}

// 두 그레이스케일 픽셀 배열(같은 길이, 0~255 값)의 유사도를 정규화 상관계수(Pearson correlation, -1~1)로
// 반환 — 아이콘 교차 검증에서 사진 크롭(고대비 그레이스케일 전처리를 거침)과 실제 API 아이콘(원본 컬러,
// 부드러운 톤)을 비교할 때 씀. 단순 픽셀 차이(MAE) 기반은 두 이미지의 밝기/대비 스타일이 서로 달라서
// 실측 검증 시 정답 쌍과 오답 쌍의 점수 차이가 거의 안 났는데, 상관계수는 밝기/대비 차이에 영향받지 않고
// 형태(엣지 패턴) 유사성만 반영해서 훨씬 안정적으로 구분됨(실측: 올바른 쌍 0.87 vs 틀린 쌍 -0.001).
function compareGrayscalePixelArrays(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

// OCR로 읽은 이름 후보 문자열을 실제 캐릭터의 스킬 이름 목록과 대조해서 가장 비슷한 것을 찾음(문자 단위
// 교집합 비율 기반 — OCR 잡음이 섞여도 스킬 이름 글자가 부분적으로 남아있으면 매칭됨). 임계값(0.7) 미만이면
// null(매칭 실패, 사용자가 직접 골라야 함) — 예: "래피드 샷"이 "2 uci"처럼 완전히 깨진 경우, 혹은 "실버호크"가
// "호크 샷"과 두 글자만 우연히 겹치는 것처럼 짧은 이름끼리 오매칭될 위험이 있는 경우. 이 함수는 어디까지나
// 기본값 미리 채우기용이고, 최종 확정은 UI에서 사용자가 원본 OCR 텍스트를 보고 드롭다운으로 검증/수정한다.
// 두 문자열의 "가장 긴 연속 부분 문자열" 길이 — 흩어진 글자 겹침(바구니 방식)이 아니라 실제로 이어진
// 구간만 인정한다. OCR 잡음은 진짜 이름 글자가 우연히 여기저기 흩어져서 나타날 수 있는데(예: "스킬룬 :
// 중독"이 우연히 "호","크","샷" 세 글자를 순서 상관없이 다 포함하게 되는 경우), 실제 이름은 항상 붙어서
// 나타나므로(예: "호크 샷") 연속 구간 매칭이 훨씬 안전하다.
function longestCommonSubstringLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  let max = 0;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > max) max = dp[i][j];
      }
    }
  }
  return max;
}

// 한글 음절만 남기고 나머지(공백/영문/숫자/기호)는 제거 — OCR이 'kor' 단일 언어 모델이라 "MK2",
// "A.A.G.A:" 같은 라틴/숫자 구간은 원천적으로 정확히 읽지 못하는 게 실측으로 확인됨(예: "실버호크 MK2"가
// "실버호크112"/"봉 실버호크12"처럼 한글 부분은 항상 정확히 읽히는데 라틴+숫자 구간만 매번 다르게 깨짐).
// 이 구간까지 일치를 요구하면 해당 스킬은 구조적으로 절대 0.7 임계값을 못 넘기므로, 애초에 신뢰할 수 없는
// 비한글 문자는 채점에서 제외하고 한글 부분의 일치도만으로 판단한다.
function hangulOnly(str) {
  return (str || '').replace(/[^가-힣]/g, '');
}

function fuzzyMatchSkillName(candidateText, skillNames) {
  if (!candidateText || !Array.isArray(skillNames) || skillNames.length === 0) return null;
  const cand = hangulOnly(candidateText);
  let best = null;
  let bestScore = 0;
  skillNames.forEach((name) => {
    const nm = hangulOnly(name);
    if (!nm) return;
    const score = longestCommonSubstringLength(cand, nm) / nm.length;
    if (score > bestScore) { bestScore = score; best = name; }
  });
  return bestScore >= 0.7 ? best : null;
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

// engravings(ArkPassiveEffects)에서 "예리한 둔기" 기본 효과의 치명타 피해 % 추출.
// 적주피 계열 각인과 동일한 함정: 실제 어빌리티 스톤 보너스가 걸려있으면 API의 Description 자체가
// 이미 "각인 레벨값 + 스톤 보너스"가 합산된 현재 총합으로 온다(실측: 포구릿, 예리한 둔기 Lv3 스톤 →
// Description "57.20%" = 순수 각인값 44.00% + 스톤 13.2%). 아래에서 스톤 보너스(getSharpWeaponStoneBonus)를
// 또 더하면 이중 합산되므로, AbilityStoneLevel이 있으면 미리 빼서 순수 각인값만 남긴다.
// buildEngravingsWithAbilityStoneSelections(가상 조합 시뮬레이터)가 원래 실제 스톤 레벨 기준으로 이미
// 한 번 빼둔 경우(_pureCritDamagePercent 존재)는 그 값을 그대로 쓴다(이유는 getEngravingEnemyDamageByName
// 쪽 주석과 동일).
function getSharpWeaponCritDamagePercent(engravingsData) {
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return 0;
  const eng = engravingsData.ArkPassiveEffects.find((e) => e.Name === '예리한 둔기');
  if (!eng) return 0;
  if (eng._pureCritDamagePercent !== undefined) return eng._pureCritDamagePercent;
  let percent = extractPercent(stripHtml(eng.Description), '치명타 피해량');
  if (eng.AbilityStoneLevel) {
    percent -= SHARP_WEAPON_STONE_BONUS[eng.AbilityStoneLevel] || 0;
  }
  return percent;
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

// 치명타 피해의 게임 자체 기본값(장비/각인/아크패시브 등 어떤 보너스도 없어도 항상 적용되는 값) — 인게임
// 스탯창에서 모든 치명타 피해 관련 보너스를 뺀 순수 기본 수치가 200%(=100% 증가)라는 걸 사용자가 직접
// 스크린샷으로 확인해줌. 이전에는 각 소스에서 텍스트로 뽑은 "X% 증가" 값들만 합산하고 이 기본값을 어디서도
// 더하지 않아서, 치명타 배율이 실제보다 계속 낮게 계산되고 있었음(예: 잼구릿 기준 치피 88.80%로 계산되던
// 게 실제로는 188.80%여야 함 — 배율 약 1.85→2.85 수준으로 크게 달라짐).
const CRIT_DAMAGE_BASE_PERCENT = 100;

// 딜러+서포터 데이터를 받아 치명타 적중률/피해/평균 피해 배율까지 전부 계산 (항목별 breakdown 포함)
function calculateCritMultiplier(dealerData, supportData, options) {
  const equipment = dealerData.equipment;
  const className = dealerData.profiles ? dealerData.profiles.CharacterClassName : '';
  const partyClassNames = [className, ...((options && options.partyClassNames) || [])];
  const partyMemberRatios = (options && options.partyMemberRatios) || {};
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
    시너지_파티직업: sumPartySynergyPercent(partyClassNames, SYNERGY_CRIT_RATE_CLASSES, SYNERGY_CRIT_RATE_PERCENT, partyMemberRatios),
    어빌리티스톤_각인보너스_정밀단도: getAbilityStoneOtherEngravingBonus(dealerData.engravings).critRatePercent,
    정밀단도_각인: getPrecisionDaggerOwnCritRatePercent(dealerData.engravings),
    스킬_부가효과: getCombatSkillPersistentCritRatePercent(dealerData.combatSkills),
    아이덴티티_상시버프: getIdentityCritRatePercent(dealerData),
    전투분석_스킬전용: (options && options.extraCritRatePercent) || 0,
  };
  const critRatePercent = Object.values(critRateBreakdown).reduce((a, b) => a + b, 0);

  const arkgridCrit = getArkgridCritOptions(dealerData.arkgrid);
  const arkPassiveCritDmg = getArkPassiveCritDamagePercent(dealerData.arkpassive);
  const sharpWeaponDmg = getSharpWeaponCritDamagePercent(dealerData.engravings);
  const ringCritDmg = getRingCritDamagePercent(equipment);
  const stoneLevelBonusDmg = getAbilityStoneCritDamagePercent(equipment);
  const sharpWeaponStoneDmg = getSharpWeaponStoneBonus(dealerData.engravings);

  const critDamageBreakdown = {
    기본값: CRIT_DAMAGE_BASE_PERCENT,
    아크패시브: arkPassiveCritDmg,
    예리한둔기_각인_최종값: sharpWeaponDmg,
    반지: ringCritDmg,
    스톤_레벨보너스: stoneLevelBonusDmg,
    스톤_예리한둔기_전용보너스: sharpWeaponStoneDmg,
    딜러팔찌: dealerBracelet.critDamagePercent,
    아크그리드: arkgridCrit.critDamagePercent,
    정밀단도_각인_페널티: getPrecisionDaggerCritDamagePenaltyPercent(dealerData.engravings),
    아이덴티티_상시버프: getIdentityCritDamagePercent(dealerData),
    전투분석_스킬전용: (options && options.extraCritDamagePercent) || 0,
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
  const classSynergyCritDamagePercent = sumPartySynergyPercent(partyClassNames, SYNERGY_CRIT_DAMAGE_CLASSES, SYNERGY_CRIT_DAMAGE_PERCENT, partyMemberRatios);
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
// 돌격대장은 별도 공식(이동속도 기반)으로 처리하므로 여기선 제외.
// 실측으로 확인된 함정: 실제로 어빌리티 스톤 보너스가 붙어있는 각인은 API의 Description 자체가 이미
// "각인 레벨값 + 스톤 보너스"가 합산된 현재 총합 텍스트로 온다(예: 저주받은 인형 4lv 17% + 스톤 2lv
// 3.75% = Description에 "20.75%"로 표시). 여기서 그대로 추출한 뒤 아래에서 스톤 보너스를 또 더하면
// 이중 합산된다 — 그래서 AbilityStoneLevel이 있으면 그 스톤 값을 미리 빼서 "순수 각인 레벨"만 남긴다.
// buildEngravingsWithAbilityStoneSelections(가상 조합 시뮬레이터)가 이미 원본 실제 스톤 레벨 기준으로
// 한 번 빼둔 경우(_pureEnemyDamagePercent 존재)는 그 값을 그대로 쓰고 여기서 또 빼지 않는다 — 시뮬레이터가
// AbilityStoneLevel을 테스트용 값으로 바꿔치기해서, 이 시점의 AbilityStoneLevel로 다시 빼면 Description에
// 원래 baked-in된 실제 레벨 값과 어긋나 버리기 때문.
function getEngravingEnemyDamageByName(engravingsData) {
  const result = {};
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return result;

  engravingsData.ArkPassiveEffects.forEach((eng) => {
    if (eng.Name === '돌격대장') return;
    let percent;
    if (eng._pureEnemyDamagePercent !== undefined) {
      percent = eng._pureEnemyDamagePercent;
    } else {
      percent = extractEngravingEnemyDamagePercent(eng.Description);
      const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG[eng.Name];
      if (catalogEntry && catalogEntry.method === 'enemyDamage' && eng.AbilityStoneLevel) {
        percent -= catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0;
      }
    }
    if (percent > 0) {
      result[eng.Name] = (result[eng.Name] || 0) + percent;
    }
  });
  return result;
}

// 돌격대장의 "이동속도 증가량의 X%" → 실제 적주피 % (이동속도 40% 고정 가정).
// 다른 스톤형 각인(저주받은 인형/예리한 둔기)과 동일한 함정이 여기도 있었음을 실측으로 확인: 실제
// 스톤 보너스가 걸려있으면 Description 자체가 이미 그 값까지 합산된 현재 총합으로 온다(실측: 잼구릿,
// 돌격대장 Lv3 스톤 → "이동속도 증가량의 61.20%" - 13.2(스톤 raw %) = 48.00%, 깔끔한 값이라 순수
// 각인값으로 추정). 스톤 보너스는 getAbilityStoneChargeCaptainBonus가 별도로(이미 ×0.4 전환된 적주피%
// 단위로) 더하므로, 여기서 미리 뺄 땐 그 전환을 거꾸로 풀어서 "이동속도%" 단위로 빼야 한다.
function getChargeCaptainEnemyDamagePercent(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '돌격대장');
  if (!eng) return 0;
  const MOVE_SPEED_FIXED = 40;
  if (eng._pureChargeCaptainMoveSpeedPercent !== undefined) {
    return (eng._pureChargeCaptainMoveSpeedPercent * MOVE_SPEED_FIXED) / 100;
  }
  const text = stripHtml(eng.Description || '');
  const m = text.match(/이동속도\s*증가량의\s*([\d.]+)\s*%/);
  if (!m) return 0;
  let moveSpeedPercent = parseFloat(m[1]);
  if (eng.AbilityStoneLevel) {
    const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG['돌격대장'];
    const convertedStoneValue = catalogEntry ? (catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0) : 0;
    moveSpeedPercent -= convertedStoneValue / (MOVE_SPEED_FIXED / 100);
  }
  return (moveSpeedPercent * MOVE_SPEED_FIXED) / 100;
}

// 어빌리티 스톤 "무작위 각인 효과"(적주피% 계열, method:'enemyDamage')를 각인 이름별로 그룹핑 — 밸런스
// 패치로 어빌리티 스톤의 적주피% 보너스가 더 이상 독립적인 곱연산 항이 아니라, 같은 이름의 실제 각인이
// 주는 값에 합연산으로 더해지도록 변경됨(예: 원한 4lv 21% + 어빌리티스톤 원한 2lv 3.75% → 24.75%
// 하나의 그룹으로 합산 후 곱연산). AbilityStoneLevel은 항상 실제 착용 중인 각인(ArkPassiveEffects의
// 같은 항목)에만 붙으므로 이름이 어긋날 일은 없음. 돌격대장은 별도 공식(이동속도 전환)이라 여기서 제외.
function getAbilityStoneEnemyDamageByName(engravingsData) {
  const result = {};
  if (!engravingsData || !engravingsData.ArkPassiveEffects) return result;
  engravingsData.ArkPassiveEffects.forEach((eng) => {
    if (eng.Name === '돌격대장' || !eng.AbilityStoneLevel) return;
    const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG[eng.Name];
    if (!catalogEntry || catalogEntry.method !== 'enemyDamage') return;
    const value = catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0;
    result[eng.Name] = (result[eng.Name] || 0) + value;
  });
  return result;
}

// 돌격대장의 어빌리티 스톤 보너스(이미 이동속도→적주피 전환 공식이 적용된 적주피% 단위) — byName과
// 마찬가지로 실제 각인의 chargeCaptainPercent에 합연산으로 더해진다.
function getAbilityStoneChargeCaptainBonus(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '돌격대장');
  if (!eng || !eng.AbilityStoneLevel) return 0;
  const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG['돌격대장'];
  return catalogEntry ? (catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0) : 0;
}

// 각인 전체(돌격대장 포함)의 적에게 주는 피해 곱연산 배율
// 같은 이름 각인끼리는 이미 합산되어 있고(그룹별, 어빌리티 스톤 보너스도 같은 이름이면 여기 합산됨),
// 이름이 다른 각인끼리는 여기서 곱연산
function getEngravingEnemyDamageMultiplier(engravingsData) {
  const byName = getEngravingEnemyDamageByName(engravingsData);
  const stoneByName = getAbilityStoneEnemyDamageByName(engravingsData);
  Object.keys(stoneByName).forEach((name) => {
    byName[name] = (byName[name] || 0) + stoneByName[name];
  });

  let multiplier = 1;
  Object.values(byName).forEach((p) => { multiplier *= toMultiplier(p); });

  const chargeCaptainPercent = getChargeCaptainEnemyDamagePercent(engravingsData) + getAbilityStoneChargeCaptainBonus(engravingsData);
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

// 질서 코어 포인트 1개 값을 적주피%로 환산 — 17P 미만은 0% 취급, 17P부터 1P당 0.15%
// (실제 게임의 18/19/20P 단계식 지급과는 다른 단순화된 시뮬레이터 전용 규칙 — 사용자 확정)
function orderCorePointToEnemyDamagePercent(point) {
  const p = point || 0;
  return p >= 17 ? (p - 16) * 0.15 : 0;
}

// 아크그리드 코어(질서/혼돈) 6개 슬롯의 실제 투자 포인트를 해/달/별 그룹별로 반환
// — 시뮬레이터 기본값(현재 상태)을 채우는 용도
function getArkgridCorePointsByGroup(arkgridData) {
  const result = { 질서: { 해: 0, 달: 0, 별: 0 }, 혼돈: { 해: 0, 달: 0, 별: 0 } };
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const typeText = getCoreTypeText(slot.Tooltip);
      const kind = typeText.includes('질서') ? '질서' : typeText.includes('혼돈') ? '혼돈' : null;
      if (!kind) return;
      const group = typeText.includes('해') ? '해' : typeText.includes('달') ? '달' : typeText.includes('별') ? '별' : null;
      if (!group) return;
      result[kind][group] = slot.Point || 0;
    });
  }
  return result;
}

// 혼돈 코어 3종(해/달/별)의 실제 장착된 코어 옵션 원문 텍스트를 그룹별로 반환
// — 시뮬레이터에서 임의의 포인트를 넣어도 [XXP] 구간 텍스트는 실제 장착 코어의 것을 그대로 사용하기 위함
function getChaosCoreOptionTextByGroup(arkgridData) {
  const result = { 해: '', 달: '', 별: '' };
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      const typeText = getCoreTypeText(slot.Tooltip);
      if (!typeText.includes('혼돈')) return;
      const group = typeText.includes('해') ? '해' : typeText.includes('달') ? '달' : typeText.includes('별') ? '별' : null;
      if (!group) return;
      result[group] = getCoreOptionText(slot.Tooltip);
    });
  }
  return result;
}

// 혼돈 코어 옵션 원문 텍스트 + 임의의 포인트로, 그 코어가 실제로 부여하는 스탯을 그대로 계산.
// 질서 코어처럼 "적주피 하나로 통일"하지 않고, 코어마다 다른 테마를 각각 감지해서 반영한다
// (18P/19P/20P 등 실제 코어에 박혀있는 [XXP] 구간 옵션을 그대로 사용) — 여러 테마를 동시에 시도해서
// 코어 자신이 실제로 갖고 있는 것만 0이 아닌 값으로 잡히는 방식(한 코어의 세그먼트는 보통 테마가
// 하나로 일관됨). 관측/지원 테마: 공격력형(대표적으로 "별" 코어, getChaosStarCoreAttack과 동일 방식),
// 적에게 주는 피해형("보스 이상 적에게 주는 피해"도 포함, 해/달 코어에서 흔함), 추가 피해형,
// 치명타 적중률형, 치명타 피해형, "치명타 시 적에게 주는 피해"(곱연산 onHit) 조건부형(라벨/추출은
// getArkgridCritOptions와 동일). 그 외 아직 관측되지 않은 테마는 0으로 처리됨 — 새로운 테마가
// 확인되면 이 함수에 추가할 것.
function getChaosCoreStatAtPoint(coreOptionText, point) {
  if (!coreOptionText) {
    return { attackFlat: 0, attackPercent: 0, enemyDamagePercent: 0, extraDamagePercent: 0, critRatePercent: 0, critDamagePercent: 0, critOnHitPercent: 0 };
  }
  const segments = getActivatedCoreSegments(coreOptionText, point || 0);
  const attackStats = sumCoreSegmentsExcluding(segments, '공격력', '무기 공격력');
  const enemyDamagePercent = segments.reduce((sum, seg) => sum + extractChaosCoreEnemyDamagePercent(seg), 0);
  const extraDamagePercent = segments.reduce((sum, seg) => sum + extractPercent(seg, '추가 피해'), 0);
  const critRatePercent = segments.reduce((sum, seg) => sum + extractPercent(seg, '치명타 적중률'), 0);
  const critDamagePercent = segments.reduce((sum, seg) => sum + extractPercent(seg, '치명타 피해'), 0);
  const critOnHitPercent = segments.reduce((sum, seg) => sum + extractCritOnHitDamagePercent(seg), 0);
  return {
    attackFlat: attackStats.flat, attackPercent: attackStats.percent,
    enemyDamagePercent, extraDamagePercent, critRatePercent, critDamagePercent, critOnHitPercent,
  };
}

// calculateCritMultiplier가 계산한 실제 breakdown을 기준으로, 치명타 적중률/피해/onHit(치명타 시 적에게
// 주는 피해, 곱연산)에 각각 delta를 더해서 평균피해배율을 다시 계산 — 치명타 배율은 rate/damage가
// 비선형으로 얽혀있어(rate가 낮아지면 onHit 보너스의 실효 가치도 같이 낮아지는 등, 이번 세션에서
// 확인된 구조) 단순 비율 치환이 불가능하고 calculateCritMultiplier의 수식 구조를 그대로 재사용해야
// 정확하다. onHit은 breakdown의 '아크그리드' 항목(6개 코어 전체 합산치)에만 delta를 더해서 치환하고
// (다른 onHit 소스는 아크그리드와 무관하므로 그대로 유지), 치피패널티/시너지는 delta로 안 건드리는
// 항목이라 ctx.critResult 값을 그대로 재사용.
function recalcCritAvgDamageMultiplierWithDelta(critResult, critRatePercentDelta, critDamagePercentDelta, onHitPercentDelta) {
  const newCritRatePercent = critResult.critRatePercent + (critRatePercentDelta || 0);
  const newCritDamagePercent = critResult.critDamagePercent + (critDamagePercentDelta || 0);
  const bluntThornCap = critResult.뭉툭한가시_치명타발동상한;
  const effectiveCritRatePercent = (bluntThornCap !== null && bluntThornCap !== undefined)
    ? Math.min(newCritRatePercent, bluntThornCap)
    : newCritRatePercent;
  const rate = Math.min(effectiveCritRatePercent, 100) / 100;
  let onHitMultiplier = 1;
  Object.entries(critResult.onHitBreakdown).forEach(([key, p]) => {
    const adjusted = key === '아크그리드' ? p + (onHitPercentDelta || 0) : p;
    onHitMultiplier *= toMultiplier(adjusted);
  });
  const critDamageMultiplier = (1 - rate) + rate * toMultiplier(newCritDamagePercent) * onHitMultiplier;
  return critDamageMultiplier * critResult.sharpWeaponPenalty * toMultiplier(critResult.시너지_치명타시피해량);
}

// 아크그리드 포인트 · 젬 시뮬레이터 (최적화 없음 — 사용자가 직접 입력한 값으로 재계산만 수행)
// inputs = {
//   orderPoints: { 해, 달, 별 } — 질서 코어 3종 포인트(0~20), 17P 미만은 0% 취급(단순화된 규칙)
//   chaosPoints: { 해, 달, 별 } — 혼돈 코어 3종 포인트(0~20), 실제 장착 코어의 18/19/20P 옵션을 그대로 반영,
//   코어별로 실제 부여하는 스탯(공격력/적주피/추가피해/치명타 적중률/치명타 피해 등)을 그대로 적용
//   gemAttackLevel, gemExtraDamageLevel, gemBossDamageLevel — 젬 공격력/추가피해/보스피해 합산 레벨
//   (레벨당 % 환산은 getAllArkgridGems*Percent와 동일한 상수 0.0367/0.080834/0.08334 사용)
// }
// 실제(API) 값 대비 총딜 변화율을 계산 — 아크그리드 코어/젬 관련 항목만 입력값으로 교체하고
// 그 외 모든 항목(다른 추가피해/적주피/치명타 소스 등)은 ctx의 실제 계산 결과를 그대로 사용한다.
function calculateArkGridPointGemSimulation(ctx, inputs) {
  const orderPoints = inputs.orderPoints || {};
  const orderPercents = {
    해: orderCorePointToEnemyDamagePercent(orderPoints.해),
    달: orderCorePointToEnemyDamagePercent(orderPoints.달),
    별: orderCorePointToEnemyDamagePercent(orderPoints.별),
  };
  const orderMultiplier = toMultiplier(orderPercents.해) * toMultiplier(orderPercents.달) * toMultiplier(orderPercents.별);

  const chaosPoints = inputs.chaosPoints || {};
  const chaosOptionTextByGroup = getChaosCoreOptionTextByGroup(ctx.dealerData.arkgrid);
  const chaosStatsByGroup = {
    해: getChaosCoreStatAtPoint(chaosOptionTextByGroup.해, chaosPoints.해),
    달: getChaosCoreStatAtPoint(chaosOptionTextByGroup.달, chaosPoints.달),
    별: getChaosCoreStatAtPoint(chaosOptionTextByGroup.별, chaosPoints.별),
  };
  const chaosPercents = {
    해: chaosStatsByGroup.해.enemyDamagePercent,
    달: chaosStatsByGroup.달.enemyDamagePercent,
    별: chaosStatsByGroup.별.enemyDamagePercent,
  };
  const chaosMultiplier = toMultiplier(chaosPercents.해) * toMultiplier(chaosPercents.달) * toMultiplier(chaosPercents.별);
  // 공격력형 혼돈 코어(대표적으로 "별" 코어)의 고정값/% — 질서 코어와 달리 적주피로 뭉뚱그리지 않고
  // 실제 스탯(공격력)에 직접 반영해야 "전체 스펙" 변화가 정확해진다.
  const chaosAttackFlat = chaosStatsByGroup.해.attackFlat + chaosStatsByGroup.달.attackFlat + chaosStatsByGroup.별.attackFlat;
  const chaosAttackPercent = chaosStatsByGroup.해.attackPercent + chaosStatsByGroup.달.attackPercent + chaosStatsByGroup.별.attackPercent;
  const chaosExtraDamagePercent = chaosStatsByGroup.해.extraDamagePercent + chaosStatsByGroup.달.extraDamagePercent + chaosStatsByGroup.별.extraDamagePercent;
  const chaosCritRatePercent = chaosStatsByGroup.해.critRatePercent + chaosStatsByGroup.달.critRatePercent + chaosStatsByGroup.별.critRatePercent;
  const chaosCritDamagePercent = chaosStatsByGroup.해.critDamagePercent + chaosStatsByGroup.달.critDamagePercent + chaosStatsByGroup.별.critDamagePercent;

  // 추가 피해/치명타는 실제 앱의 다른 계산식이 "혼돈 코어" 자체를 소스로 잡지 않으므로(공격력/적주피와
  // 달리 대체할 real 값이 없음), 실제 투자 포인트 기준으로 같은 함수를 한 번 더 돌려서 "이미 반영되어
  // 있다고 봐야 할 기준값"을 구하고, 시뮬레이터 입력값과의 차이(delta)만 ctx의 실제 결과에 더한다.
  const realChaosPoints = getArkgridCorePointsByGroup(ctx.dealerData.arkgrid).혼돈;
  const realChaosStatsByGroup = {
    해: getChaosCoreStatAtPoint(chaosOptionTextByGroup.해, realChaosPoints.해),
    달: getChaosCoreStatAtPoint(chaosOptionTextByGroup.달, realChaosPoints.달),
    별: getChaosCoreStatAtPoint(chaosOptionTextByGroup.별, realChaosPoints.별),
  };
  const realChaosExtraDamagePercent = realChaosStatsByGroup.해.extraDamagePercent + realChaosStatsByGroup.달.extraDamagePercent + realChaosStatsByGroup.별.extraDamagePercent;
  const realChaosCritRatePercent = realChaosStatsByGroup.해.critRatePercent + realChaosStatsByGroup.달.critRatePercent + realChaosStatsByGroup.별.critRatePercent;
  const realChaosCritDamagePercent = realChaosStatsByGroup.해.critDamagePercent + realChaosStatsByGroup.달.critDamagePercent + realChaosStatsByGroup.별.critDamagePercent;
  const chaosCritOnHitPercent = chaosStatsByGroup.해.critOnHitPercent + chaosStatsByGroup.달.critOnHitPercent + chaosStatsByGroup.별.critOnHitPercent;
  const realChaosCritOnHitPercent = realChaosStatsByGroup.해.critOnHitPercent + realChaosStatsByGroup.달.critOnHitPercent + realChaosStatsByGroup.별.critOnHitPercent;

  // 젬 레벨 합 × 레벨당 % (실제 캐릭터 계산과 동일한 환산 상수 재사용: getAllArkgridGems*Percent 참고)
  const gemAttackPercent = (inputs.gemAttackLevel || 0) * 0.0367;
  const gemExtraDamagePercent = (inputs.gemExtraDamageLevel || 0) * 0.080834;
  const gemBossDamagePercent = (inputs.gemBossDamageLevel || 0) * 0.08334;

  const dealerStats = ctx.dealerStats;
  const finalDamage = calculateFinalDamage(
    dealerStats.basePower, dealerStats.accessoryAttackFlat, chaosAttackFlat, ctx.supportBuffPower,
    chaosAttackPercent, dealerStats.earringAttackPercent, gemAttackPercent,
    ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );

  const realExtraBreakdown = ctx.extraDamageResult.extraDamageBreakdown;
  const extraSumPercent = Object.entries(realExtraBreakdown).reduce(
    (sum, [key, value]) => sum + (key === '아크그리드젬' ? gemExtraDamagePercent : (value || 0)), 0
  ) + (chaosExtraDamagePercent - realChaosExtraDamagePercent);
  const extraDamageMultiplier = 1 + extraSumPercent / 100;

  const critAvgDamageMultiplier = recalcCritAvgDamageMultiplierWithDelta(
    ctx.critResult, chaosCritRatePercent - realChaosCritRatePercent, chaosCritDamagePercent - realChaosCritDamagePercent,
    chaosCritOnHitPercent - realChaosCritOnHitPercent
  );

  const realBreakdown = ctx.enemyDamageResult.breakdown;
  const realBossGemPercent = realBreakdown.아크그리드젬_보스피해 || 0;
  const realOrderMultiplier = toMultiplier(realBreakdown.아크그리드코어_질서.해 || 0)
    * toMultiplier(realBreakdown.아크그리드코어_질서.달 || 0)
    * toMultiplier(realBreakdown.아크그리드코어_질서.별 || 0);
  const realChaosMultiplier = Object.values(realBreakdown.아크그리드코어_혼돈 || {}).reduce((m, p) => m * toMultiplier(p), 1);

  const enemyDamageMultiplier = ctx.enemyDamageResult.multiplier
    / toMultiplier(realBossGemPercent) * toMultiplier(gemBossDamagePercent)
    / realOrderMultiplier * orderMultiplier
    / realChaosMultiplier * chaosMultiplier;

  const totalDamage = finalDamage * critAvgDamageMultiplier * extraDamageMultiplier * enemyDamageMultiplier;
  const realTotalDamage = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const totalChangePercent = ((totalDamage / realTotalDamage) - 1) * 100;

  return {
    orderPercents, orderMultiplier, chaosPercents, chaosMultiplier, chaosAttackFlat, chaosAttackPercent,
    chaosExtraDamagePercent, chaosCritRatePercent, chaosCritDamagePercent,
    gemAttackPercent, gemExtraDamagePercent, gemBossDamagePercent,
    finalDamage, critAvgDamageMultiplier, extraDamageMultiplier, enemyDamageMultiplier, totalDamage, totalChangePercent,
  };
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

// "적에게 주는 (모든 )?피해(량)?(가/이) X[, Y, Z]% 증가" 또는 "모든 피해(량)?(가/이) X% 증가" 형태를
// 잡는 전용 추출 함수(아크패시브 노드 문구가 "적에게 주는 모든 피해가 21.0% 증가"처럼 "모든"이
// 끼어 있어 extractPercent의 6자 이내 근접 매칭 규칙으로는 못 잡아서 별도 정규식으로 처리).
// "14.0%, 28.0%, 42.0% 증가"처럼 조건부 단계값이 나열된 경우 최댓값만 사용(최대 달성 가정).
// "량" 유무 둘 다 지원("피해량이"/"피해가") — 실측(포구릿 A.C.T 호출 "모든 피해량이 18.0% 증가",
// 권구릿 수라강체 "모든 피해량이 33.5% 증가")에서 "적에게 주는" 없이 "모든 피해량"만 쓰는 문구가
// 실제로 존재해서 둘 다 매칭하도록 확장(수정 전엔 "모든 피해량" 단독 문구를 완전히 놓치고 있었음
// — 치명타 피해/추가 피해/진화형 피해는 라벨이 달라서 오매칭 없음, 네거티브 케이스로 확인).
function extractEnemyDamageAllPercent(text) {
  if (!text) return 0;
  const regex = /(?:적에게\s*주는\s*(?:모든\s*)?피해|모든\s*피해)량?(?:이|가)?\s*((?:[\d.]+\s*%[,\s]*)+)증가/g;
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

// 아크패시브 특정 카테고리(진화/깨달음/도약)에서 "현재 실제로 찍혀서 발동 중인 노드"의 이름/티어/레벨/
// 아이콘 URL 목록을 반환 (Effects 배열엔 애초에 발동 중인 노드만 담김). UI에서 아이콘 그리드로 표시하는 용도.
function getArkPassiveNodeIcons(arkpassiveData, category) {
  if (!arkpassiveData || !arkpassiveData.Effects) return [];
  return arkpassiveData.Effects
    .filter((e) => e.Name === category)
    .map((e) => {
      let nodeName = '';
      let effectText = '';
      try {
        const obj = JSON.parse(e.ToolTip);
        nodeName = obj.Element_000 ? stripHtml(obj.Element_000.value) : '';
        effectText = obj.Element_002 ? stripHtml(obj.Element_002.value).replace(/\|+\s*$/, '').trim() : '';
      } catch (err) {}
      const desc = stripHtml(e.Description || '');
      const tierMatch = desc.match(/(\d+)티어/);
      const levelMatch = desc.match(/Lv\.(\d+)/);
      return {
        name: nodeName || desc,
        tier: tierMatch ? parseInt(tierMatch[1], 10) : null,
        level: levelMatch ? parseInt(levelMatch[1], 10) : null,
        icon: e.Icon || '',
        description: desc,
        effectText,
      };
    });
}

// 진화 트리 전체 배치(5티어×6칸, 실제 게임 화면을 보고 사용자가 직접 제공한 이름) — 모든 직업이 동일한
// 트리를 공유한다(사용자 확인 사항: "모든 직업들도 아크패시브는 똑같고 위치도 똑같아"). Open API는
// 실제로 찍은 노드만 내려주므로, 안 찍힌 노드까지 포함한 전체 그리드를 보여주려면 이 정적 테이블이 필요.
const EVOLUTION_TREE_LAYOUT = [
  ['치명', '특화', '제압', '신속', '인내', '숙련'],
  ['끝없는 마나', '금단의 주문', '예리한 감각', '한계 돌파', '최적화 훈련', '축복의 여신'],
  ['무한한 마력', '혼신의 강타', '일격', '파괴 전차', '타이밍 지배', '정열의 춤사위'],
  ['회심', '달인', '분쇄', '선각자', '진군', '기원'],
  ['뭉툭한 가시', '음속 돌파', '인파이팅', '입식 타격가', '마나 용광로', '안정된 관리자'],
];

// 안 찍힌(미투자) 상태 노드의 효과 설명 — API로는 실제로 찍은 노드의 효과만 알 수 있어서, 미투자 노드는
// 별도 출처가 필요하다. 사용자가 인벤 로스트아크 스킬 DB(lostark.inven.co.kr/dataninfo/arkpassive)의
// '진화' 탭 원문을 직업별로 정리해 제공한 자료(워로드 기준 문서, 모든 직업이 노드 이름/배치를 공유하므로
// 그대로 적용 가능 — EVOLUTION_TREE_LAYOUT과 정확히 1:1 대조 확인됨)로 전면 재검증·수정함. 이전 버전은
// 커뮤니티 영문 참고표 번역이라 몇몇 항목이 부정확하거나(뭉툭한가시 전환율 120/140%→125/150%가 정답,
// 음속돌파 초과분 전환율 10/20%→15/30%가 정답) 일부 효과가 통째로 누락돼 있었음(입식 타격가의 기본
// 진화형피해/낙인력 고정 증가분, 마나 용광로의 낙인력 고정 증가분, 정열의 춤사위의 아이덴티티 게이지
// 획득량 증가분 전부 빠져있었음) — 전부 이 문서 원문으로 교체. 4티어(회심 그룹) 6개 노드도 전부 이
// 문서에서 확보해 신규 추가(회심/분쇄만 있던 기존 상태에서 달인/선각자/진군/기원까지 채움).
const EVOLUTION_NODE_STATIC_EFFECT = {
  '치명': '치명 +50',
  '특화': '특화 +50',
  '제압': '제압 +50',
  '신속': '신속 +50',
  '인내': '인내 +50',
  '숙련': '숙련 +50',
  '끝없는 마나': '마나 스킬의 재사용 대기시간이 7/14% 감소하고, 마나 소모량이 10/20% 감소합니다.',
  '금단의 주문': '진화형 피해가 5/10% 증가합니다. 마나를 소모하는 스킬이라면 추가로 5/10% 증가합니다. 마나 소모량이 6/12% 감소합니다.',
  '예리한 감각': '치명타 적중률이 4/8% 증가하고, 진화형 피해가 5/10% 증가합니다.',
  '한계 돌파': '진화형 피해가 10/20/30% 증가합니다.',
  '최적화 훈련': '각성기, 이동 및 기상기를 제외한 스킬의 재사용 대기시간이 4/8% 감소하고, 진화형 피해가 5/10% 증가합니다.',
  '축복의 여신': '전투 중 자신과 파티원에게 [전투의 축복]을 부여합니다. (20초간 지속되며, 매초 갱신됩니다.) 전투의 축복: 공격 및 이동 속도가 3/6/9% 증가합니다.',
  '무한한 마력': '진화형 피해가 8/16% 증가하고, 마나 스킬의 재사용 대기시간이 7/14% 감소하며, 마나 소모량이 8/16% 감소합니다.',
  '혼신의 강타': '치명타 적중률이 12/24% 증가하고, 진화형 피해가 2/4% 증가합니다.',
  '일격': '치명타 적중률이 10/20% 증가하고, 방향성 공격 스킬의 치명타 피해가 16/32% 증가합니다.',
  '파괴 전차': '진화형 피해가 12/24% 증가하고, 공격 속도가 4/8% 증가합니다.',
  '타이밍 지배': '각성기, 이동 및 기상기를 제외한 스킬의 재사용 대기시간이 5/10% 감소하고, 진화형 피해가 8/16% 증가합니다.',
  '정열의 춤사위': '[축복의 여신] 3레벨이 필요합니다. 적중 시 아이덴티티 게이지 획득량이 10/20% 증가합니다. 전투 중 자신과 파티원에게 [정열의 춤]을 부여합니다. (20초간 지속되며, 매초 갱신됩니다.) 정열의 춤: 진화형 피해가 7/14% 증가합니다.',
  '회심': '공격이 치명타로 적중 시 적에게 주는 피해가 12% 증가하며, 받는 피해가 4% 감소합니다.',
  '달인': '받는 피해가 4% 감소하며, 이동기 및 기상기를 제외한 스킬 사용 시 10초간 [달인] 효과를 얻습니다. 달인: 치명타 적중률 +1.4% / 추가 피해 +1.7%, 최대 5중첩',
  '분쇄': '진화형 피해가 20% 증가하며, 받는 피해가 4% 감소합니다.',
  '선각자': '최대 생명력이 6% 증가합니다. 이동기 및 기상기를 제외한 스킬 사용 시 10초간 [통찰] 효과를 얻습니다. [통찰] 중첩이 최대에 도달하면 아군 공격력 강화 효과가 추가로 11% 증가하고, 기상기 및 각성기를 제외한 스킬의 재사용 대기시간이 5% 감소합니다. 통찰: 아군 공격력 강화 효과 +2.2%, 최대 5중첩',
  '진군': '최대 생명력이 6% 증가합니다. 아군에게 보호 효과 사용 시 자신의 5m 이내에 [진군 에테르]를 생성합니다. (발동 재사용 대기시간 7초) 진군 에테르: 15초간 아군 공격력 강화 효과 +24% / 공격속도 +4% / 이동속도 +4%',
  '기원': '최대 생명력이 6% 증가합니다. 아군 공격력 강화 효과가 22% 증가하고, 낙인력이 4% 증가합니다.',
  '뭉툭한 가시': '진화형 피해가 7.5/15% 증가합니다. 최대 치명타 적중률이 80%로 제한되며, 초과한 치명타 확률의 125/150%가 진화형 피해로 전환됩니다. (최대 52.5/75% 진화형 피해)',
  '음속 돌파': '적중 시, 공격 속도와 이동 속도 증가량의 5/10%가 진화형 피해로 전환됩니다. 공격 속도와 이동 속도가 모두 상한을 초과하면 적중 시 추가로 진화형 피해가 4/8% 증가하며, 상한 초과분의 15/30%도 추가로 진화형 피해로 전환됩니다. 이 노드로 인한 진화형 피해는 최대 12/24%까지 적용됩니다.',
  '인파이팅': '공격 적중 시 [정면 승부]를 부여합니다. (10초간 지속, 재사용 대기시간 5초) 정면 승부: 진화형 피해가 9/18% 증가합니다.',
  '입식 타격가': '진화형 피해가 6/12%, 낙인력이 4/8% 증가합니다. 전투 시작 후 [입식 타격] 효과를 최대 중첩으로 얻습니다. 피격 이상 시 중첩 3회를 잃으며, 이후 2초마다 1중첩씩 회복됩니다. 입식 타격: 진화형 피해 +0.75/1.5% / 낙인력 +1.0/2.0%, 최대 6중첩',
  '마나 용광로': '낙인력이 10/20% 증가합니다. 마나를 소모하는 스킬 사용 시 최대 마나의 2%를 추가로 소모합니다. 해당 스킬로 피해를 줄 경우 기본 마나 소모량 10당 진화형 피해가 0.25/0.5% 증가합니다. (최대 12/24%)',
  '안정된 관리자': '낙인력이 10/20% 증가하지만, 아이덴티티 게이지 획득량이 3/6% 감소합니다.',
};

// 안 찍힌(미투자) 상태의 노드 아이콘 — API로는 구할 수 없는 미투자 노드 아이콘을 `loa-cp/icons/evolution/
// t{티어}c{열}.png`로 저장해 둠(30개 전부 커버, 64×64 고정 해상도로 통일). 사용자가 제공한 인벤
// 로스트아크 스킬 DB(진화 탭) 문서에 30개 노드 아이콘이 전부 원본 그대로 첨부돼 있어서, 이전의
// 스크린샷 크롭/CSS grayscale 방식(칸마다 해상도가 제각각이었음)을 이 원본 아이콘으로 전량 교체.
function getEvolutionPlaceholderIconPath(tier, colIndex) {
  return `icons/evolution/t${tier}c${colIndex + 1}.png`;
}

// 전체 진화 트리(5티어×6칸, 모든 직업 공통)를 실제 투자 여부와 매칭해서 반환. 투자된 칸은 실제
// 아이콘/레벨/설명 포함(invested:true), 안 찍힌 칸은 이름 + 스크린샷에서 잘라낸 그 칸의 미투자 상태
// 아이콘(invested:false) — 30칸 전부 커버됨.
function getArkPassiveEvolutionFullTree(arkpassiveData) {
  const investedNodes = getArkPassiveNodeIcons(arkpassiveData, '진화');
  const byName = {};
  investedNodes.forEach((n) => { byName[n.name] = n; });

  return EVOLUTION_TREE_LAYOUT.map((row, tierIdx) => row.map((name, colIdx) => {
    const node = byName[name];
    if (node) {
      return {
        name, tier: tierIdx + 1, invested: true, level: node.level, icon: node.icon,
        description: node.description, effectText: node.effectText,
      };
    }
    return {
      name, tier: tierIdx + 1, invested: false, icon: getEvolutionPlaceholderIconPath(tierIdx + 1, colIdx),
      effectText: EVOLUTION_NODE_STATIC_EFFECT[name] || '',
    };
  }));
}

// 진화 노드별 최대 레벨(실제 게임 화면 기준: 1티어=30, 2티어는 노드마다 2 또는 3, 3~5티어는 2, 4티어는 1)
// — 인벤 로스트아크 스킬 DB 원문(사용자 제공, 각 노드 "최대 레벨: N" 표기)으로 전수 검증, 최적화
// 훈련이 3이 아니라 2가 맞음을 확인해 수정.
const EVOLUTION_NODE_MAX_LEVEL = {
  치명: 30, 특화: 30, 제압: 30, 신속: 30, 인내: 30, 숙련: 30,
  '끝없는 마나': 2, '금단의 주문': 2, '예리한 감각': 2, '한계 돌파': 3, '최적화 훈련': 2, '축복의 여신': 3,
  '무한한 마력': 2, '혼신의 강타': 2, '일격': 2, '파괴 전차': 2, '타이밍 지배': 2, '정열의 춤사위': 2,
  회심: 1, 달인: 1, 분쇄: 1, 선각자: 1, 진군: 1, 기원: 1,
  '뭉툭한 가시': 2, '음속 돌파': 2, 인파이팅: 2, '입식 타격가': 2, '마나 용광로': 2, '안정된 관리자': 2,
};

// 티어별 "전체 투자 가능 레벨 총합" 상한(사용자 지정) — 1티어는 스탯 6종 중 아무 조합으로나 최대 40레벨,
// 2티어는 6개 노드 통틀어 최대 3레벨, 3~5티어는 각각 6개 노드 통틀어 최대 2레벨까지만 투자 가능하다
// (예: 1티어는 특정 스탯 하나를 30까지 찍고 나머지에 10을 더 분배하는 식, 4티어는 노드 두 개를 Lv.1씩
// 찍거나 한 노드만 Lv.1 찍는 식). EVOLUTION_NODE_MAX_LEVEL(노드 하나 자체의 최대 레벨)과는 별개의 제약이라
// 커스텀 시뮬레이터에서 둘 다(개별 노드 상한 + 티어 전체 합계 상한) 동시에 지켜야 한다.
const EVOLUTION_TIER_MAX_TOTAL = [40, 3, 2, 2, 2];

// 진화 노드별 레벨당 실제 효과 텍스트(한국어, 실측 API 문구와 대조해서 확인된 표현 — EVOLUTION_NODE_STATIC_EFFECT의
// "N/M%" 범위 표기를 레벨별로 쪼갠 것). 커스텀 진화 시뮬레이터에서 이 텍스트를 진화 Effects에 합성해 넣으면
// 기존 계산식(진화형피해/치명타적중률/치명타피해/달인 특수처리 등 — getArkPassiveEvolutionDamagePercent,
// getArkPassiveCritRatePercent 등)이 실제 캐릭터와 동일하게 그대로 인식해서 재사용된다.
// 1티어(치명 제외 특화/제압/신속/인내/숙련)와 4티어의 선각자/진군/기원(분쇄는 잼구릿 실측으로 확보해서
// 지원 목록에 추가됨)은 현재 엔진에 대응하는 계산식이 없어 미포함(선택은 가능하지만 데미지 기여는 0).
// 일격의 Lv.1 값(치명타 적중률 10%/치명타 피해 16%)은 실측이 아니라 Lv.2 실측값(20%/32%)을 다른 모든
// 2레벨 노드에서 공통으로 확인된 "정확히 2배" 패턴에 맞춰 역산한 추정치 — Lv.2는 잼구릿 실측으로 확정.
// 5티어는 전부 조건부/동적 메커니즘(뭉툭한가시의 치명타
// 초과분 전환, 음속돌파의 속도 한계 조건, 입식 타격가 중첩, 마나 용광로의 마나 소모 비례 등)이라 이번
// 1차 시뮬레이터에서는 의도적으로 제외 — 사용자 요청("일단 시뮬레이터를 만들고 그 다음에 조건을 어떻게
// 활용하는지 만들것임")에 따라 선택 UI만 두고 조건부 계산 로직은 다음 단계에서 추가할 예정.
const EVOLUTION_NODE_LEVEL_TEXT = {
  '끝없는 마나': [
    '마나 스킬의 재사용 대기시간이 7% 감소하고, 마나 소모량이 10% 감소합니다.',
    '마나 스킬의 재사용 대기시간이 14% 감소하고, 마나 소모량이 20% 감소합니다.',
  ],
  '금단의 주문': [
    '진화형 피해가 5% 증가합니다. 마나를 소모하는 스킬이라면 추가로 5% 증가합니다. 마나 소모량이 6% 감소합니다.',
    '진화형 피해가 10% 증가합니다. 마나를 소모하는 스킬이라면 추가로 10% 증가합니다. 마나 소모량이 12% 감소합니다.',
  ],
  '예리한 감각': [
    '치명타 적중률이 4% 증가하고, 진화형 피해가 5% 증가합니다.',
    '치명타 적중률이 8% 증가하고, 진화형 피해가 10% 증가합니다.',
  ],
  '한계 돌파': [
    '진화형 피해가 10% 증가합니다.',
    '진화형 피해가 20% 증가합니다.',
    '진화형 피해가 30% 증가합니다.',
  ],
  '최적화 훈련': [
    '각성기, 이동 및 기상기를 제외한 스킬의 재사용 대기시간이 4% 감소하고, 진화형 피해가 5% 증가합니다.',
    '각성기, 이동 및 기상기를 제외한 스킬의 재사용 대기시간이 8% 감소하고, 진화형 피해가 10% 증가합니다.',
  ],
  '무한한 마력': [
    '진화형 피해가 8% 증가하고, 마나 스킬의 재사용 대기시간이 7% 감소하며, 마나 소모량이 8% 감소합니다.',
    '진화형 피해가 16% 증가하고, 마나 스킬의 재사용 대기시간이 14% 감소하며, 마나 소모량이 16% 감소합니다.',
  ],
  '혼신의 강타': [
    '치명타 적중률이 12% 증가하고, 진화형 피해가 2% 증가합니다.',
    '치명타 적중률이 24% 증가하고, 진화형 피해가 4% 증가합니다.',
  ],
  '일격': [
    '치명타 적중률이 10% 증가하고, 방향성 공격 스킬의 치명타 피해가 16% 증가합니다.',
    '치명타 적중률이 20% 증가하고, 방향성 공격 스킬의 치명타 피해가 32% 증가합니다.',
  ],
  분쇄: [
    '진화형 피해가 20% 증가하며, 받는 피해가 4% 감소합니다.',
  ],
  '파괴 전차': [
    '진화형 피해가 12% 증가하고, 공격 속도가 4% 증가합니다.',
    '진화형 피해가 24% 증가하고, 공격 속도가 8% 증가합니다.',
  ],
  '타이밍 지배': [
    '각성기를 제외한 스킬의 재사용 대기시간이 5% 감소하고, 진화형 피해가 8% 증가합니다.',
    '각성기를 제외한 스킬의 재사용 대기시간이 10% 감소하고, 진화형 피해가 16% 증가합니다.',
  ],
  '정열의 춤사위': [
    '진화형 피해가 7% 증가합니다.',
    '진화형 피해가 14% 증가합니다.',
  ],
  회심: [
    '공격이 치명타로 적중 시 적에게 주는 피해가 12% 증가하며, 받는 피해가 4% 감소합니다.',
  ],
  달인: [
    "받는 피해가 4% 감소하며, 이동기 및 기상기를 제외한 스킬 사용시 10초간 '달인' 효과를 얻습니다. 달인 : 치명타 적중률 +1.4% / 추가 피해 +1.7% , 최대 5중첩",
  ],
};

// name이 EVOLUTION_TREE_LAYOUT의 몇 티어에 속하는지 반환
function getEvolutionNodeTier(name) {
  for (let t = 0; t < EVOLUTION_TREE_LAYOUT.length; t++) {
    if (EVOLUTION_TREE_LAYOUT[t].includes(name)) return t + 1;
  }
  return null;
}

// 가상 진화 노드 선택 하나를 실제 arkpassive.Effects 항목과 같은 모양으로 합성 — Description에 "N티어
// 이름 Lv.X" 형식을 그대로 써서 hasArkPassiveEffect 등 이름 매칭 기반 특수처리(예: 달인의 고정 7%/8.5%)도
// 실제 캐릭터와 동일하게 자동으로 반응한다.
function buildSyntheticEvolutionEffect(name, level) {
  const tier = getEvolutionNodeTier(name);
  if (!tier) return null;
  const levelText = EVOLUTION_NODE_LEVEL_TEXT[name];
  const effectText = levelText ? (levelText[Math.min(level, levelText.length) - 1] || '') : '';
  return {
    Name: '진화',
    Description: `진화 ${tier}티어 ${name} Lv.${level}`,
    ToolTip: JSON.stringify({ Element_000: { value: name }, Element_002: { value: effectText } }),
  };
}

// 선택된 진화 노드 조합(selections=[{name, level}])으로 실제 진화 트리를 통째로 교체한 dealerData를 생성.
// 치명(1티어)은 진화 Effects 텍스트가 아니라 profiles.Stats의 치명 스탯 자체에 직접 반영되는 값이라(실제
// 캐릭터도 이렇게 반영됨) buildDealerDataWithCritStatDelta로 별도 처리 — 다만 실제 팔찌 치명 스탯 시뮬레이터와
// 같은 한계로, 실제 캐릭터가 이미 갖고 있는 치명 스탯을 빼지 않고 가상 값만큼 "추가로 있다"고 가정한다.
function buildDealerDataWithEvolutionSelections(dealerData, selections) {
  const validSelections = (selections || []).filter((s) => s.level > 0);
  const critSelection = validSelections.find((s) => s.name === '치명');
  const textSelections = validSelections.filter((s) => s.name !== '치명' && EVOLUTION_NODE_LEVEL_TEXT[s.name]);

  const nonEvolutionEffects = ((dealerData.arkpassive && dealerData.arkpassive.Effects) || []).filter((e) => e.Name !== '진화');
  const syntheticEffects = textSelections.map((s) => buildSyntheticEvolutionEffect(s.name, s.level)).filter(Boolean);
  const modifiedArkpassive = { ...dealerData.arkpassive, Effects: [...nonEvolutionEffects, ...syntheticEffects] };

  let modifiedDealerData = { ...dealerData, arkpassive: modifiedArkpassive };
  if (critSelection) modifiedDealerData = buildDealerDataWithCritStatDelta(modifiedDealerData, critSelection.level * 50);
  return modifiedDealerData;
}

// 아크패시브 진화 커스텀 시뮬레이터: 가상 노드 조합을 실제 진화 트리와 "교체"했다고 가정하고 효율표 +
// 총 변화율을 계산. 5티어(조건부) 및 계산식 없는 노드(1티어 치명 외 스탯 5종, 4티어 분쇄/선각자/진군/기원)는
// 선택은 되지만 기여도가 0으로 나옴(getEvolutionNodeTier가 EVOLUTION_TREE_LAYOUT에서 티어를 못 찾는 경우가
// 아니라, 이 함수들 자체가 EVOLUTION_NODE_LEVEL_TEXT/치명 특수처리에 없는 이름이라 그냥 0으로 남는 것).
function calculateHypotheticalEvolutionEfficiency(dealerData, supportData, ctx, selections) {
  const validSelections = (selections || []).filter((s) => s.name && s.level > 0);
  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;

  function totalFor(sels) {
    const modifiedDealerData = buildDealerDataWithEvolutionSelections(dealerData, sels);
    const newStats = calculateCharacterStats(modifiedDealerData);
    const newCrit = calculateCritMultiplier(modifiedDealerData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
    const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
    const newEnemy = calculateEnemyDamageMultiplier(modifiedDealerData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
    const newFinalDamage = calculateFinalDamage(
      newStats.basePower, newStats.accessoryAttackFlat, newStats.chaosCoreAttack.flat, ctx.supportBuffPower,
      newStats.chaosCoreAttack.percent, newStats.earringAttackPercent, newStats.arkgridGemsAttackPercent,
      ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
    );
    return newFinalDamage * newCrit.avgDamageMultiplier * newExtra.multiplier * newEnemy.multiplier;
  }

  // 실제 캐릭터의 현재 진화 투자 상태가 아니라, "진화 트리에 아무것도 안 찍은 상태(0)"를 기준선으로 비교
  // — 커스텀 시뮬레이터는 "내 현재 빌드 대비"가 아니라 "찍는 노드가 늘어날수록 얼마나 상승하는지"를
  // 처음부터 누적해서 보여주는 게 목적이라(사용자 요청), 실제 빌드를 기준으로 하면 실제 투자분(최대 140P)을
  // 통째로 빼는 셈이라 선택 몇 개만으로는 항상 큰 폭의 음수로 나와 오해를 준다.
  // 다만 실제 빌드도 "같은 미투자(0) 기준선" 대비로 환산해서(realChangePercent) 같이 보여주면, 두 값을
  // 나눠서(1+커스텀%)/(1+실제%) 커스텀 선택이 실제 빌드 대비 몇 %인지도 비교 가능해진다(사용자 제안).
  const zeroTotal = totalFor([]);
  const hypotheticalTotal = totalFor(validSelections);
  const totalChangePercent = ((hypotheticalTotal / zeroTotal) - 1) * 100;
  const realChangePercent = ((realTotal / zeroTotal) - 1) * 100;
  const vsRealPercent = ((hypotheticalTotal / realTotal) - 1) * 100;

  const rows = validSelections.map((sel) => {
    const withoutSelections = validSelections.filter((s) => s !== sel);
    const withoutTotal = totalFor(withoutSelections);
    const efficiencyPercent = ((hypotheticalTotal / withoutTotal) - 1) * 100;
    return { key: sel.name, label: sel.name, value: `Lv.${sel.level}`, efficiencyPercent };
  });

  return { rows, totalChangePercent, realChangePercent, vsRealPercent };
}

// === 진화 트리 1~4티어 최적화 시뮬레이터 (9/7 어빌리티 스톤 최적화와 같은 성격 — 사용자가 정리한 티어별
// 판단 규칙을 그대로 코드화한 규칙 기반 추천, 완전탐색 아님) ===
// 5티어(뭉툭한 가시/음속 돌파/마나 용광로/입식 타격가)는 실제 공식에 필요한 데이터(정확한 레벨별 툴팁
// 텍스트, 이동속도·공격속도 시너지/직업별 표)가 아직 없어 이번 범위에서 제외 — 다음 단계.

// 실제 진화 트리의 현재 투자를 티어별(1~5)로 그룹핑 — getArkPassiveNodeIcons가 이미 진화 Effects를
// {name, tier, level, ...}로 파싱해주므로 그대로 재사용.
function getEvolutionTierCurrentSelections(arkpassiveData) {
  const nodes = getArkPassiveNodeIcons(arkpassiveData, '진화');
  const byTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  nodes.forEach((n) => {
    if (n.tier && byTier[n.tier]) byTier[n.tier].push({ name: n.name, level: n.level });
  });
  return byTier;
}

// 후보 노드 이름 목록 + 티어 예산 안에서 만들 수 있는 모든 레벨 조합을 나열(각 노드 자체의
// EVOLUTION_NODE_MAX_LEVEL도 동시에 존중). 후보가 2~3개, 레벨이 1~3 수준이라 완전탐색으로 충분하다.
function enumerateTierCandidates(candidateNames, tierBudget) {
  const results = [];
  function recurse(idx, remaining, current) {
    if (idx === candidateNames.length) {
      if (current.some((lv) => lv > 0)) results.push([...current]);
      return;
    }
    const maxForNode = Math.min(EVOLUTION_NODE_MAX_LEVEL[candidateNames[idx]] || 0, remaining);
    for (let lv = 0; lv <= maxForNode; lv++) {
      current.push(lv);
      recurse(idx + 1, remaining - lv, current);
      current.pop();
    }
  }
  recurse(0, tierBudget, []);
  return results.map((levels) => candidateNames.map((name, i) => ({ name, level: levels[i] })).filter((s) => s.level > 0));
}

// buildDealerDataWithEvolutionSelections(기존 커스텀 시뮬레이터용)는 진화 Effects 전체를 통째로 갈아
// 끼워서, 이번 최적화가 다루지 않는 5티어(뭉툭한가시/음속돌파/마나용광로/입식타격가)의 실제 투자까지
// 평가 도중 사라져 버린다 — 그러면 "1~4티어만 바꿨을 때의 순수 변화"가 아니라 "5티어 실제 보너스까지
// 잃는 변화"가 섞여서 비교가 왜곡된다. 그래서 1~4티어에 해당하는 실제 Effects만 제거하고 5티어(또는
// 티어를 못 찾는 항목)는 그대로 보존하는 전용 버전을 따로 둔다.
// realCritLevel: 치명 선택이 있을 때, 프로필 스탯에 더할 값은 "선택 레벨×50"이 아니라 "선택 레벨과 실제
// 현재 레벨의 차이×50"이어야 한다(안 그러면 실제 치명 스탯 위에 또 더해져서 이중 반영됨 — 기존
// buildDealerDataWithEvolutionSelections는 "0에서 시작하는" 커스텀 시뮬레이터라 이 문제가 없었지만, 이
// 최적화는 실제 현재값에서 ±4만 미세 조정하는 거라 델타 계산이 꼭 필요하다).
function buildDealerDataWithEvolutionTier1to4Selections(dealerData, sels, realCritLevel) {
  const validSelections = (sels || []).filter((s) => s.level > 0);
  const critSelection = validSelections.find((s) => s.name === '치명');
  const textSelections = validSelections.filter((s) => s.name !== '치명' && EVOLUTION_NODE_LEVEL_TEXT[s.name]);

  const realEffects = (dealerData.arkpassive && dealerData.arkpassive.Effects) || [];
  const evolutionNodeInfo = getArkPassiveNodeIcons(dealerData.arkpassive, '진화'); // realEffects 중 '진화' 항목과 순서가 1:1로 대응
  let evoIdx = 0;
  const preservedEffects = realEffects.filter((e) => {
    if (e.Name !== '진화') return true;
    const info = evolutionNodeInfo[evoIdx];
    evoIdx += 1;
    return !info || info.tier === null || info.tier > 4;
  });

  const syntheticEffects = textSelections.map((s) => buildSyntheticEvolutionEffect(s.name, s.level)).filter(Boolean);
  const modifiedArkpassive = { ...dealerData.arkpassive, Effects: [...preservedEffects, ...syntheticEffects] };

  let modifiedDealerData = { ...dealerData, arkpassive: modifiedArkpassive };
  if (critSelection) {
    const delta = (critSelection.level - (realCritLevel || 0)) * 50;
    modifiedDealerData = buildDealerDataWithCritStatDelta(modifiedDealerData, delta);
  }
  return modifiedDealerData;
}

// 스킬 지분 가중 "치명타 배율 × 적에게 주는 피해 배율" 결합값 — calculateCombatAnalysisWeightedCrit은
// 치명타 배율만 스킬별로 가중하는데, 뭉툭한 가시의 진화형 피해 전환은 그 스킬 순간의 치명타 적중률
// (트라이포드 보너스 포함)에 따라 달라지므로 적에게 주는 피해 배율도 스킬별로 다시 계산해서 같이
// 가중평균해야 한다(안 그러면 "치명타 트라이포드가 있는 스킬일수록 뭉툭한 가시가 유리해진다"는 상호작용을
// 놓친다 — 한가한신수 캐릭터로 실측 검증: 기본 비교로는 뭉툭한가시가 근소하게 불리했지만, 지분 가중
// 시 +6.87%로 역전됨). skillShares가 비어있으면 기본(가중치 없음) 결합값을 그대로 반환한다.
function calculateSkillWeightedCritEnemyMultiplier(dealerData, supportData, ctx, skillShares) {
  const baseCrit = calculateCritMultiplier(dealerData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
  const baseEnemy = calculateEnemyDamageMultiplier(dealerData, baseCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
  const baseCombined = baseCrit.avgDamageMultiplier * baseEnemy.multiplier;
  if (!skillShares || skillShares.length === 0) return baseCombined;

  let majorShareTotal = 0;
  let weighted = 0;
  skillShares.forEach((row) => {
    const share = row.sharePercent || 0;
    if (share < COMBAT_ANALYSIS_MAJOR_SHARE_THRESHOLD) return;
    const skill = findCombatSkillByName(dealerData.combatSkills, row.name);
    const hasTripods = skill && (skill.Tripods || []).some((t) => t.IsSelected);
    let combined = baseCombined;
    if (skill && hasTripods) {
      const bonus = getCombatSkillSpecificCritBonus(skill);
      const skillCrit = calculateCritMultiplier(dealerData, supportData, {
        partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios,
        extraCritRatePercent: bonus.critRatePercent, extraCritDamagePercent: bonus.critDamagePercent,
      });
      const skillEnemy = calculateEnemyDamageMultiplier(dealerData, skillCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
      combined = skillCrit.avgDamageMultiplier * skillEnemy.multiplier;
    }
    majorShareTotal += share;
    weighted += (share / 100) * combined;
  });
  const remainder = Math.max(0, 100 - majorShareTotal);
  weighted += (remainder / 100) * baseCombined;
  return weighted;
}

function totalDamageForEvolutionTier1to4Selections(dealerData, supportData, ctx, sels, realCritLevel, skillShares) {
  const modifiedDealerData = buildDealerDataWithEvolutionTier1to4Selections(dealerData, sels, realCritLevel);
  const newStats = calculateCharacterStats(modifiedDealerData);
  const critEnemyCombined = calculateSkillWeightedCritEnemyMultiplier(modifiedDealerData, supportData, ctx, skillShares);
  const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
  const newFinalDamage = calculateFinalDamage(
    newStats.basePower, newStats.accessoryAttackFlat, newStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    newStats.chaosCoreAttack.percent, newStats.earringAttackPercent, newStats.arkgridGemsAttackPercent,
    ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );
  return newFinalDamage * critEnemyCombined * newExtra.multiplier;
}

// 5티어 뭉툭한가시/마나 용광로/입식 타격가의 Lv.2(예산 2를 전부 쓰는 유일한 실전 선택) 실측 효과
// 텍스트 — 각각 권구릿/햄현이/잼구릿 캐릭터로 실측 확인. getBluntThornConversionBonusPercent/
// getManaFurnaceEvolutionDamagePercent/getStandingStrikerEvolutionDamagePercent가 이 텍스트를 그대로
// 정규식으로 파싱하도록 이미 구현돼 있어서(Element_002 텍스트 매칭) 새 계산식 없이 그대로 재사용 가능.
// 음속 돌파는 실제 공식에 이동속도/공격속도 시너지·직업별 표가 필요해 아직 제외(다음 단계). Lv.1
// 텍스트는 미확보 — 예산이 2라 Lv.2 단독 투자가 어차피 가장 흔한 실전 선택이라 실용상 문제 없다.
const EVOLUTION_TIER5_LEVEL2_TEXT = {
  '뭉툭한 가시': '진화형 피해가 15.0% 증가합니다. 치명타가 발생할 확률이 최대 80.0% 로 제한됩니다. 공격 시, 초과한 모든 치명타가 발생할 확률의 150.0% 가 진화형 피해로 전환됩니다. 이 노드에 의한 진화형 피해는 최대 75.0% 까지 적용됩니다.',
  '마나 용광로': '낙인력이 20.0% 증가합니다. 마나를 소모하는 스킬 사용 시, 최대 마나의 2.0% 가 추가로 소모됩니다. 해당 스킬로 피해를 줄 경우, 스킬의 증감 전 기본 마나 소모량에 비례하여 진화형 피해가 증가합니다. (기본 마나 소모량 10 당, 진화형 피해 0.5% 증가, 최대 24.0% )',
  '입식 타격가': "진화형 피해가 12.0% , 낙인력이 8.0% 증가합니다. 전투 시작 후, '입식 타격 II' 효과를 최대로 얻습니다. 피격 이상 시 중첩을 3회 잃습니다. 이후 2초가 지날 때마다 효과를 1중첩 회복합니다. 입식 타격 II : 진화형 피해 +1.5% / 낙인력 +2.0% , 최대 6중첩",
};

function buildSyntheticTier5Effect(name) {
  const text = EVOLUTION_TIER5_LEVEL2_TEXT[name];
  if (!text) return null;
  return {
    Name: '진화',
    Description: `진화 5티어 ${name} Lv.2`,
    ToolTip: JSON.stringify({ Element_000: { value: name }, Element_002: { value: text } }),
  };
}

// buildDealerDataWithEvolutionTier1to4Selections와 달리 5티어까지 전부 선택대로 갈아끼우는 버전 — 1~4티어
// 최적화가 끝난 뒤, 그 확정값을 유지한 채 5티어 후보만 바꿔가며 비교하는 마지막 단계에서 쓴다.
function buildDealerDataWithFullEvolutionSelections(dealerData, tier1to4Sels, tier5Sels, realCritLevel) {
  const validT14 = (tier1to4Sels || []).filter((s) => s.level > 0);
  const critSelection = validT14.find((s) => s.name === '치명');
  const textSelections = validT14.filter((s) => s.name !== '치명' && EVOLUTION_NODE_LEVEL_TEXT[s.name]);
  const tier5Synthetic = (tier5Sels || []).map((s) => buildSyntheticTier5Effect(s.name)).filter(Boolean);

  const nonEvolutionEffects = ((dealerData.arkpassive && dealerData.arkpassive.Effects) || []).filter((e) => e.Name !== '진화');
  const syntheticEffects = textSelections.map((s) => buildSyntheticEvolutionEffect(s.name, s.level)).filter(Boolean);
  const modifiedArkpassive = { ...dealerData.arkpassive, Effects: [...nonEvolutionEffects, ...syntheticEffects, ...tier5Synthetic] };

  let modifiedDealerData = { ...dealerData, arkpassive: modifiedArkpassive };
  if (critSelection) {
    const delta = (critSelection.level - (realCritLevel || 0)) * 50;
    modifiedDealerData = buildDealerDataWithCritStatDelta(modifiedDealerData, delta);
  }
  return modifiedDealerData;
}

function totalDamageForFullEvolutionSelections(dealerData, supportData, ctx, tier1to4Sels, tier5Sels, realCritLevel, skillShares) {
  const modifiedDealerData = buildDealerDataWithFullEvolutionSelections(dealerData, tier1to4Sels, tier5Sels, realCritLevel);
  const newStats = calculateCharacterStats(modifiedDealerData);
  const critEnemyCombined = calculateSkillWeightedCritEnemyMultiplier(modifiedDealerData, supportData, ctx, skillShares);
  const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
  const newFinalDamage = calculateFinalDamage(
    newStats.basePower, newStats.accessoryAttackFlat, newStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    newStats.chaosCoreAttack.percent, newStats.earringAttackPercent, newStats.arkgridGemsAttackPercent,
    ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );
  return newFinalDamage * critEnemyCombined * newExtra.multiplier;
}

// 진화 트리 1~4티어 최적화 — 사용자가 정리한 티어별 판단 규칙을 그대로 코드화:
//  1티어: 현재 투자가 "30+10" 스플릿이면 그대로 둠. 아니면 '치명'이 포함돼 있을 때만 치명 포인트를
//    현재값 ±4 범위에서 탐색(상대 노드는 40-치명값으로 자동 보정). 치명이 아예 없으면 손대지 않음.
//  2티어: '끝없는 마나' 또는 '최적화 훈련'이 찍혀있으면 그대로 둠. 아니면 '한계 돌파'(금단의 주문은 같은
//    수치로 취급해 한계 돌파로 대체 표기) vs '예리한 감각' 중 예산(3) 안에서 조합 비교.
//  3티어: '무한한 마력' 또는 '일격'이 찍혀있으면 그대로 둠. 아니면 '혼신의 강타' vs '파괴 전차' 중 예산
//    (2) 안에서 조합 비교.
//  4티어: 조건 없이 항상 회심/달인/분쇄 중 2택(3가지 조합 전수 비교) — 선각자/진군/기원은 후보 제외.
//  5티어: '뭉툭한 가시'/'입식 타격가'는 항상 비교, '마나 용광로'는 현재 찍혀있을 때만 비교 후보에
//    포함(음속 돌파는 아직 데이터 부족으로 제외) — Lv.2(풀 투자) 후보끼리만 비교, 현재 실투자가 Lv.1을
//    포함하면(지원 안 하는 케이스) 5티어는 건드리지 않고 실제값을 그대로 유지한다.
// 순차 최적화(1→2→3→4→5 순서로 확정하며 이전 결과를 다음 평가에 반영) — 사용자가 티어별로 독립적인
// 규칙을 제시했으므로 티어 간 상호작용은 고려하지 않는다.
// skillShares(선택): 전투분석 사진에서 뽑은 [{name, sharePercent}] — 넘기면 모든 후보 비교에
// calculateSkillWeightedCritEnemyMultiplier로 스킬 지분 가중 치명타×적주피 결합값을 쓴다(특히 뭉툭한
// 가시처럼 크리티컬 적중률에 따라 효율이 갈리는 5티어 후보 비교에서 실제 스킬 트라이포드 보너스를
// 반영하기 위함 — 한가한신수 캐릭터로 실측 검증: 이 가중치 없이는 입식 타격가가 근소 우위였지만, 실제
// 스킬 사용 지분으로 가중하면 뭉툭한 가시가 +6.87% 우위로 뒤집힘). 안 넘기면 기존과 동일하게 기본
// (가중치 없음) 배율을 쓴다.
function calculateEvolutionTreeOptimization(dealerData, supportData, ctx, skillShares) {
  const current = getEvolutionTierCurrentSelections(dealerData.arkpassive);
  const critEntry = current[1].find((s) => s.name === '치명');
  const realCritLevel = critEntry ? critEntry.level : 0;

  // 2티어 현재 투자에서 '금단의 주문'은 사용자 지정대로 '한계 돌파'와 같은 수치로 취급(레벨은 유지, 이름만 대체)
  const tier2Current = current[2].map((s) => (s.name === '금단의 주문' ? { name: '한계 돌파', level: s.level } : s));

  const tiers = { 1: current[1], 2: tier2Current, 3: current[3], 4: current[4] };

  function evalTotal(sels) {
    return totalDamageForEvolutionTier1to4Selections(dealerData, supportData, ctx, sels, realCritLevel, skillShares);
  }
  function fullSelectionsExcept(excludeTier) {
    const result = [];
    [1, 2, 3, 4].forEach((t) => { if (t !== excludeTier) result.push(...tiers[t]); });
    return result;
  }
  function sameSelections(a, b) {
    const norm = (arr) => [...arr].map((s) => `${s.name}:${s.level}`).sort().join(',');
    return norm(a) === norm(b);
  }

  const tierResults = {};

  // --- 1티어 ---
  {
    const isThirtyTen = tiers[1].length === 2
      && [...tiers[1].map((s) => s.level)].sort((a, b) => a - b).join(',') === '10,30';
    if (isThirtyTen || !critEntry) {
      tierResults[1] = { recommended: tiers[1], current: current[1], changed: false };
    } else {
      const otherEntry = tiers[1].find((s) => s.name !== '치명');
      const otherName = otherEntry ? otherEntry.name : null;
      let best = { sels: tiers[1], total: evalTotal([...tiers[1], ...fullSelectionsExcept(1)]) };
      for (let delta = -4; delta <= 4; delta++) {
        const newCritLevel = realCritLevel + delta;
        if (newCritLevel < 0 || newCritLevel > EVOLUTION_NODE_MAX_LEVEL['치명']) continue;
        const remaining = EVOLUTION_TIER_MAX_TOTAL[0] - newCritLevel;
        if (remaining < 0) continue;
        const candidateSels = otherName
          ? [{ name: '치명', level: newCritLevel }, { name: otherName, level: remaining }]
          : [{ name: '치명', level: newCritLevel }];
        const total = evalTotal([...candidateSels, ...fullSelectionsExcept(1)]);
        if (total > best.total) best = { sels: candidateSels, total };
      }
      tiers[1] = best.sels;
      tierResults[1] = { recommended: best.sels, current: current[1], changed: !sameSelections(best.sels, current[1]) };
    }
  }

  // --- 2티어 ---
  {
    const skip = tiers[2].some((s) => s.name === '끝없는 마나' || s.name === '최적화 훈련');
    if (skip) {
      tierResults[2] = { recommended: tiers[2], current: current[2], changed: false };
    } else {
      const candidates = enumerateTierCandidates(['한계 돌파', '예리한 감각'], EVOLUTION_TIER_MAX_TOTAL[1]);
      let best = { sels: tiers[2], total: evalTotal([...tiers[2], ...fullSelectionsExcept(2)]) };
      candidates.forEach((sels) => {
        const total = evalTotal([...sels, ...fullSelectionsExcept(2)]);
        if (total > best.total) best = { sels, total };
      });
      tiers[2] = best.sels;
      tierResults[2] = { recommended: best.sels, current: current[2], changed: !sameSelections(best.sels, tier2Current) };
    }
  }

  // --- 3티어 ---
  {
    const skip = tiers[3].some((s) => s.name === '무한한 마력' || s.name === '일격');
    if (skip) {
      tierResults[3] = { recommended: tiers[3], current: current[3], changed: false };
    } else {
      const candidates = enumerateTierCandidates(['혼신의 강타', '파괴 전차'], EVOLUTION_TIER_MAX_TOTAL[2]);
      let best = { sels: tiers[3], total: evalTotal([...tiers[3], ...fullSelectionsExcept(3)]) };
      candidates.forEach((sels) => {
        const total = evalTotal([...sels, ...fullSelectionsExcept(3)]);
        if (total > best.total) best = { sels, total };
      });
      tiers[3] = best.sels;
      tierResults[3] = { recommended: best.sels, current: current[3], changed: !sameSelections(best.sels, current[3]) };
    }
  }

  // --- 4티어 (항상 회심/달인/분쇄 중 2택) ---
  {
    const pairs = [['회심', '달인'], ['회심', '분쇄'], ['달인', '분쇄']];
    let best = null;
    pairs.forEach(([a, b]) => {
      const sels = [{ name: a, level: 1 }, { name: b, level: 1 }];
      const total = evalTotal([...sels, ...fullSelectionsExcept(4)]);
      if (!best || total > best.total) best = { sels, total };
    });
    tiers[4] = best.sels;
    tierResults[4] = { recommended: best.sels, current: current[4], changed: !sameSelections(best.sels, current[4]) };
  }

  const finalTier1to4 = [...tiers[1], ...tiers[2], ...tiers[3], ...tiers[4]];

  // --- 5티어 (뭉툭한 가시/입식 타격가는 항상, 마나 용광로는 찍혀있을 때만 비교 — 음속 돌파는 데이터
  // 부족으로 이번엔 대상 아님) ---
  const canEvaluateTier5 = current[5].every((s) => s.level === 2);
  let optimizedTotal;
  if (canEvaluateTier5) {
    const tier5CandidateNames = ['뭉툭한 가시', '입식 타격가'];
    if (current[5].some((s) => s.name === '마나 용광로')) tier5CandidateNames.push('마나 용광로');

    function evalWithTier5(tier5Sels) {
      return totalDamageForFullEvolutionSelections(dealerData, supportData, ctx, finalTier1to4, tier5Sels, realCritLevel, skillShares);
    }
    let bestTier5 = { sels: current[5], total: evalWithTier5(current[5]) };
    tier5CandidateNames.forEach((name) => {
      const sels = [{ name, level: 2 }];
      const total = evalWithTier5(sels);
      if (total > bestTier5.total) bestTier5 = { sels, total };
    });
    tierResults[5] = { recommended: bestTier5.sels, current: current[5], changed: !sameSelections(bestTier5.sels, current[5]) };
    optimizedTotal = bestTier5.total;
  } else {
    // Lv.1이 섞여있는 케이스는 아직 지원하는 실측 텍스트가 없어 5티어는 손대지 않고 실제값을 그대로 유지
    tierResults[5] = { recommended: current[5], current: current[5], changed: false, unsupported: true };
    optimizedTotal = evalTotal([...finalTier1to4]);
  }

  // 비교 기준(realTotal)도 최적화 결과와 동일한 방식(스킬 지분 가중 포함)으로 다시 계산해야 공정하게
  // 비교된다 — ctx.critResult.avgDamageMultiplier는 전투분석 탭에서 이미 가중치가 반영돼 있을 수도
  // 있고 아닐 수도 있어 일관성이 없다(적주피 배율은 아예 가중 안 됨). 현재 실제 선택 그대로(1~4티어는
  // 원본, 금단의 주문 리매핑 없이) 재구성해서 skillShares를 동일하게 적용한다.
  const currentFull1to4 = [1, 2, 3, 4].flatMap((t) => current[t]);
  const realTotal = totalDamageForFullEvolutionSelections(dealerData, supportData, ctx, currentFull1to4, current[5], realCritLevel, skillShares);
  const totalChangePercent = ((optimizedTotal / realTotal) - 1) * 100;

  return { tier1: tierResults[1], tier2: tierResults[2], tier3: tierResults[3], tier4: tierResults[4], tier5: tierResults[5], totalChangePercent };
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
  const partyMemberRatios = (options && options.partyMemberRatios) || {};
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
  const synergyDamageIncreasePercent = sumPartySynergyPercent(partyClassNames, SYNERGY_DAMAGE_INCREASE_CLASSES, SYNERGY_DAMAGE_INCREASE_PERCENT, partyMemberRatios);
  const synergyEnemyDamageTakenTierPercent = (backSameolChecked || headSameolChecked)
    ? SYNERGY_ENEMY_DAMAGE_TAKEN_SAMEOL_PERCENT
    : SYNERGY_ENEMY_DAMAGE_TAKEN_BASE_PERCENT;
  const synergyEnemyDamageTakenPercent = sumPartySynergyPercent(partyClassNames, SYNERGY_ENEMY_DAMAGE_TAKEN_CLASSES, synergyEnemyDamageTakenTierPercent, partyMemberRatios);
  const supportPassionateDanceBonus = getSupportPassionateDanceEvolutionDamageBonus(supportData?.arkpassive);
  const supportBrandTraceCoreMultiplier = getSupportBrandTraceCoreEnemyDamageMultiplier(supportData?.arkgrid, brandEffectiveRatio ?? 1);
  const arkPassivePersistentEnemyDamagePercent = getArkPassivePersistentEnemyDamagePercent(dealerData.arkpassive);
  const identityEnemyDamagePercent = getIdentityEnemyDamagePercent(dealerData);

  const multiplier =
    toMultiplier(necklacePercent) *
    engravingResult.multiplier *
    toMultiplier(bossGemPercent) *
    chaosCoreResult.multiplier *
    orderCoreResult.multiplier *
    toMultiplier(dealerBracelet.enemyDamagePercent) *
    toMultiplier(evolutionDamagePercent + bluntThornBonus + supportPassionateDanceBonus) *
    toMultiplier(arkPassivePersistentEnemyDamagePercent) *
    toMultiplier(identityEnemyDamagePercent) *
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
      아이덴티티_상시버프_적주피: identityEnemyDamagePercent,
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

// 파티(본인 포함 최대 3명) 직업 목록 중 주어진 시너지 직업 목록에 속하는 인원마다 percent를 더한다.
// 같은 직업이 중복 선택될 일은 없다고 가정하고 종류 구분 없이 매치되는 만큼 그냥 더한다.
// ratioByClassName(선택) — { 직업명: 0~1 } 형태로 인원별 유효율(시너지가 실전에서 100% 상시 유지되지
// 않는 것을 감안, 사용자 입력, 미기재 시 0.98 기본값은 UI 쪽에서 처리) — 같은 직업이 항상 시너지
// 카테고리 1개만 갖는 이 코드베이스 규칙 덕에 카테고리가 아니라 "사람"별로 유효율 하나만 있으면 된다.
// 해당 직업의 값이 없으면 1(=100%, 기존 동작과 동일해 회귀 없음)로 취급.
function sumPartySynergyPercent(classNames, classList, percent, ratioByClassName) {
  return (classNames || []).filter((c) => classList.includes(c)).reduce((sum, c) => {
    const ratio = (ratioByClassName && ratioByClassName[c] !== undefined) ? ratioByClassName[c] : 1;
    return sum + percent * ratio;
  }, 0);
}

// 시너지 탭 시뮬레이터 — 파티 시너지 직업 2명(본인 제외) + 인원별(본인 포함) 유효율만 바꿔서
// 전체 파이프라인을 처음부터 다시 계산하고 baseline(ctx.baselineFullBuffOutput) 대비 변화율을
// 반환한다. simPartyMemberRatios = { 직업명: 0~1 } — 같은 직업은 항상 시너지 카테고리 1개만
// 갖기 때문에 카테고리가 아니라 "사람"별로 유효율 하나면 충분하다(본인 직업 포함 가능, 없으면 100%).
// 다른 스탯(스톤/장비/아크그리드 등)은 전부 ctx의 실제값 그대로 고정 — 시너지 6개 카테고리만
// 바뀐 값으로 재계산.
function calculateSynergySimulation(ctx, simPartyClassNames, simPartyMemberRatios) {
  const fullPartyClassNames = [ctx.dealerStats.className, ...simPartyClassNames];

  const critResult = calculateCritMultiplier(ctx.dealerData, ctx.supportData, {
    partyClassNames: simPartyClassNames, partyMemberRatios: simPartyMemberRatios,
  });
  const enemyDamageResult = calculateEnemyDamageMultiplier(
    ctx.dealerData, critResult.critRatePercent, ctx.supportData, ctx.brandEffectiveRatio,
    { partyClassNames: simPartyClassNames, partyMemberRatios: simPartyMemberRatios }
  );

  const classSynergyAttackPercent = sumPartySynergyPercent(fullPartyClassNames, SYNERGY_ATTACK_POWER_CLASSES, SYNERGY_ATTACK_POWER_PERCENT, simPartyMemberRatios);
  const classSynergyDefenseReductionPercent = sumPartySynergyPercent(fullPartyClassNames, SYNERGY_DEFENSE_REDUCTION_CLASSES, SYNERGY_DEFENSE_REDUCTION_PERCENT, simPartyMemberRatios);

  const finalDamage = calculateFinalDamage(
    ctx.dealerStats.basePower, ctx.dealerStats.accessoryAttackFlat, ctx.dealerStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    ctx.dealerStats.chaosCoreAttack.percent, ctx.dealerStats.earringAttackPercent, ctx.dealerStats.arkgridGemsAttackPercent,
    ctx.adrenalineBonusBase, classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );
  const defenseResult = calculateDefenseMultiplier({ synergyAPercent: classSynergyDefenseReductionPercent });

  const finalOutputResult = calculateFinalOutput(
    finalDamage, critResult.avgDamageMultiplier, ctx.extraDamageResult.multiplier, enemyDamageResult.multiplier,
    defenseResult.multiplier, ctx.brandResult.multiplier, ctx.cardExtraDamageResult.multiplier
  );
  const fullBuffFinalOutputResult = calculateFullBuffFinalOutput(
    finalOutputResult.output, ctx.adenkiDamageBuffResult.multiplier, ctx.hyperAwakeningDamageBuffResult.multiplier
  );

  const changePercent = (fullBuffFinalOutputResult.output / ctx.baselineFullBuffOutput - 1) * 100;

  return {
    output: fullBuffFinalOutputResult.output,
    changePercent,
    classSynergyAttackPercent, classSynergyDefenseReductionPercent,
    critResult, enemyDamageResult,
  };
}

// "커스텀" 탭 — 실제 스탯과 무관하게 사용자가 8개 항목(치명타 적중률/치명타 피해/적에게 주는 피해/
// 추가피해/공격력+/공격력%/무기공격력/무기공격력%)에 원하는 숫자를 직접 입력하면 그 값을 실제 캐릭터
// 스탯 위에 "더해서" 전체 파이프라인을 재계산한다(순수 가상치가 아니라 실제 캐릭터 + 커스텀 델타).
// customInputs의 모든 필드는 %는 %p 단위 덧셈, flat은 그대로 덧셈, 안 넘기면 0(=실제 그대로).
// - 치명타 적중률/피해: calculateCritMultiplier의 extraCritRatePercent/extraCritDamagePercent를
//   그대로 재사용(치적/치피/onHit 비선형 상호작용까지 실제 계산 체인이 그대로 처리).
// - 적에게 주는 피해: calculateEnemyDamageMultiplier의 결과 배율에 새 곱연산 항을 하나 추가
//   (이 배율 자체가 여러 %의 곱이라 덧셈이 아니라 toMultiplier로 추가 항 곱셈이 맞음).
// - 추가피해: calculateExtraDamageMultiplier는 순수 합연산(1+sum%/100) 구조라 결과값에 %/100을
//   그대로 더하면 된다.
// - 공격력+/%: calculateFinalDamage 내부 공식(고정치 합 × (1+%합/100) × (1+시너지%/100))을 그대로
//   재현하되 고정치 합/퍼센트 합에 커스텀 값을 얹어서 직접 계산(원본 함수는 다른 곳에서 널리
//   호출되므로 시그니처를 바꾸지 않고 호출부에서 같은 공식을 재현).
// - 무기공격력+/%: calculateCharacterStats의 customDeltas로 전달 — 순수공격력이
//   sqrt(주스탯×무기공격력/6)로 무기공격력과 비선형 관계라 무기공격력을 만드는 시점에 더해야
//   정확하다(basePower까지 전부 다시 파생됨).
function calculateCustomSimulation(ctx, customInputs) {
  const inputs = Object.assign({
    critRatePercent: 0, critDamagePercent: 0, enemyDamagePercent: 0, extraDamagePercent: 0,
    attackFlat: 0, attackPercent: 0, weaponAttackFlat: 0, weaponAttackPercent: 0,
  }, customInputs || {});

  const newDealerStats = calculateCharacterStats(ctx.dealerData, {
    weaponAttackFlat: inputs.weaponAttackFlat, weaponAttackPercent: inputs.weaponAttackPercent,
  });

  const critResult = calculateCritMultiplier(ctx.dealerData, ctx.supportData, {
    partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios,
    extraCritRatePercent: inputs.critRatePercent, extraCritDamagePercent: inputs.critDamagePercent,
  });
  const baseEnemyDamageResult = calculateEnemyDamageMultiplier(
    ctx.dealerData, critResult.critRatePercent, ctx.supportData, ctx.brandEffectiveRatio,
    { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios }
  );
  const enemyDamageMultiplier = baseEnemyDamageResult.multiplier * toMultiplier(inputs.enemyDamagePercent);
  const extraDamageMultiplier = ctx.extraDamageResult.multiplier + inputs.extraDamagePercent / 100;

  const flatTotal = newDealerStats.basePower + newDealerStats.accessoryAttackFlat + newDealerStats.chaosCoreAttack.flat
    + ctx.supportBuffPower + inputs.attackFlat;
  const percentSum = newDealerStats.chaosCoreAttack.percent + newDealerStats.earringAttackPercent
    + newDealerStats.arkgridGemsAttackPercent + ctx.adrenalineBonusBase + ctx.arkPassiveAttackPercent + inputs.attackPercent;
  const finalDamage = flatTotal * toMultiplier(percentSum) * toMultiplier(ctx.classSynergyAttackPercent);

  const finalOutputResult = calculateFinalOutput(
    finalDamage, critResult.avgDamageMultiplier, extraDamageMultiplier, enemyDamageMultiplier,
    ctx.defenseResult.multiplier, ctx.brandResult.multiplier, ctx.cardExtraDamageResult.multiplier
  );
  const fullBuffFinalOutputResult = calculateFullBuffFinalOutput(
    finalOutputResult.output, ctx.adenkiDamageBuffResult.multiplier, ctx.hyperAwakeningDamageBuffResult.multiplier
  );

  const changePercent = (fullBuffFinalOutputResult.output / ctx.baselineFullBuffOutput - 1) * 100;

  return {
    output: fullBuffFinalOutputResult.output,
    changePercent,
    newDealerStats, critResult, enemyDamageMultiplier, extraDamageMultiplier, finalDamage,
  };
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
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
    const newExtra = calculateExtraDamageMultiplier(withoutData);
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
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
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
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
// selections={basic:[{type,value}], grant:[{catalogKey,tierIndex}]}를 파싱해서 팔찌 옵션 구조체 +
// 그 옵션이 반영된 dealerData(팔찌 Tooltip 합성)를 함께 반환 — calculateHypotheticalBraceletEfficiency와
// 통합 시뮬레이터 엔진(calculateCombinedSimulationTotal)이 공유하는 파싱 로직(중복 방지를 위해 추출).
function parseBraceletSelectionsToDealerData(dealerData, selections) {
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

  return { dealerData: hypotheticalDealerData, braceletOptions, primaryStatFlat, specStat, swiftStat, critStat, grantSlots };
}

function calculateHypotheticalBraceletEfficiency(dealerData, supportData, ctx, selections) {
  const {
    dealerData: hypotheticalDealerData, braceletOptions, primaryStatFlat, specStat, swiftStat, critStat, grantSlots,
  } = parseBraceletSelectionsToDealerData(dealerData, selections);

  const hypotheticalStats = calculateCharacterStats(hypotheticalDealerData);
  const hypotheticalCrit = calculateCritMultiplier(hypotheticalDealerData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
  const hypotheticalExtra = calculateExtraDamageMultiplier(hypotheticalDealerData);
  const hypotheticalEnemy = calculateEnemyDamageMultiplier(hypotheticalDealerData, hypotheticalCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
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
      const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
      const newExtra = calculateExtraDamageMultiplier(withoutData);
      const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
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
    const newCrit = calculateCritMultiplier(withoutData, supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
    const newEnemy = calculateEnemyDamageMultiplier(withoutData, newCrit.critRatePercent, supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
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
// AbilityStoneLevel을 리셋하기 전에, 원래(실제) 레벨 기준으로 Description에 이미 합산돼 있던 스톤 보너스를
// 미리 빼서 _pureEnemyDamagePercent/_pureCritDamagePercent(예리한 둔기 전용)/_pureChargeCaptainMoveSpeedPercent
// (돌격대장 전용)에 저장해둔다(각각 getEngravingEnemyDamageByName / getSharpWeaponCritDamagePercent /
// getChargeCaptainEnemyDamagePercent 쪽 주석 참고) — 리셋 후엔 원래 실제 레벨 정보가 사라져서 나중엔 이
// 값을 정확히 계산할 수 없기 때문에 여기서 미리 해둬야 한다.
function buildEngravingsWithAbilityStoneSelections(engravingsData, selections) {
  const effects = ((engravingsData && engravingsData.ArkPassiveEffects) || []).map((e) => {
    const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG[e.Name];
    let pureEnemyDamagePercent = extractEngravingEnemyDamagePercent(e.Description);
    if (catalogEntry && catalogEntry.method === 'enemyDamage' && e.AbilityStoneLevel) {
      pureEnemyDamagePercent -= catalogEntry.levels[e.AbilityStoneLevel - 1] || 0;
    }
    let pureCritDamagePercent;
    if (e.Name === '예리한 둔기') {
      pureCritDamagePercent = extractPercent(stripHtml(e.Description), '치명타 피해량');
      if (e.AbilityStoneLevel) {
        pureCritDamagePercent -= SHARP_WEAPON_STONE_BONUS[e.AbilityStoneLevel] || 0;
      }
    }
    let pureChargeCaptainMoveSpeedPercent;
    if (e.Name === '돌격대장') {
      const m = stripHtml(e.Description || '').match(/이동속도\s*증가량의\s*([\d.]+)\s*%/);
      pureChargeCaptainMoveSpeedPercent = m ? parseFloat(m[1]) : 0;
      if (e.AbilityStoneLevel) {
        const convertedStoneValue = catalogEntry ? (catalogEntry.levels[e.AbilityStoneLevel - 1] || 0) : 0;
        pureChargeCaptainMoveSpeedPercent -= convertedStoneValue / 0.4;
      }
    }
    return {
      ...e, AbilityStoneLevel: null,
      _pureEnemyDamagePercent: pureEnemyDamagePercent,
      ...(pureCritDamagePercent !== undefined ? { _pureCritDamagePercent: pureCritDamagePercent } : {}),
      ...(pureChargeCaptainMoveSpeedPercent !== undefined ? { _pureChargeCaptainMoveSpeedPercent: pureChargeCaptainMoveSpeedPercent } : {}),
    };
  });
  (selections || []).forEach(({ name, level }) => {
    if (!name || !level || name === '아드레날린') return;
    const existing = effects.find((e) => e.Name === name);
    if (existing) {
      existing.AbilityStoneLevel = level;
    } else {
      // 실제로 착용하지 않은 각인을 가상으로 테스트하는 경우 — 순수 각인 레벨은 0이므로
      // _pureEnemyDamagePercent/_pureCritDamagePercent/_pureChargeCaptainMoveSpeedPercent를 명시적으로
      // 0으로 남겨야 한다(안 남기면 각 함수가 빈 Description('')을 스톤 레벨만큼 잘못 빼서 음수가 되어 버림).
      effects.push({
        Name: name, AbilityStoneLevel: level, Level: 0, Description: '',
        _pureEnemyDamagePercent: 0, _pureCritDamagePercent: 0, _pureChargeCaptainMoveSpeedPercent: 0,
      });
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

  const newCrit = calculateCritMultiplier(modifiedDealerData, ctx.supportData, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });
  const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
  const newEnemy = calculateEnemyDamageMultiplier(modifiedDealerData, newCrit.critRatePercent, ctx.supportData, ctx.brandEffectiveRatio, { partyClassNames: ctx.partyClassNames, partyMemberRatios: ctx.partyMemberRatios });

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
    icon: slot.Icon || '',
  }));
}

// 각인 자체의 레벨별(유물0단계=전설4단계, 유물1~4단계) 실제 효과 % — 사용자가 실측/정리해서 제공.
// ABILITY_STONE_ENGRAVING_CATALOG(어빌리티 스톤이 "추가로" 주는 보너스, 이 표와는 완전히 다른 수치)와
// 혼동하지 말 것 — 이건 각인 자체(스톤 없이도 적용되는) 순수 레벨값. method는 그 카탈로그와 동일 분류:
// enemyDamage(적주피%, 곱연산)/critRate(치명타 적중률%, 합연산)/critDamage(치명타 피해%)/
// attackPower(공격력%). 돌격대장은 "이동속도 증가량의 X%"로, 기존 getChargeCaptainEnemyDamagePercent와
// 동일하게 ×0.4 적주피 전환이 필요(이 표엔 raw 값 그대로 저장 — 변환은 사용처에서).
// 각 각인의 "고정효과"(레벨 무관 상시 적용, 예: 결투의 대가 헤드어택 성공 시 +15%)는 현재 계산 체인에
// 대응하는 자리가 없어 주석으로만 기록 — 조건부/캐스팅속도/마나회복 등은 추후 별도 계산식 필요(TODO).
// levels 배열 인덱스 0~4 = 유물0~4단계, 실제 API의 Level 필드가 그대로 이 인덱스와 일치함 — 실측으로
// 확인 완료(잼구릿, Level=4인 예리한 둔기/기습의 대가/원한/돌격대장 4개 각인 전부 Description에서
// 역산한 순수 각인값이 이 표의 levels[4](유물4단계)와 정확히 일치, 아드레날린도 기존
// adrenalineCritRateBonus 공식과 levels[4]=20이 일치).
const ENGRAVING_LEVEL_VALUE_TABLE = {
  '결투의 대가': { method: 'enemyDamage', levels: [4.80, 5.50, 6.20, 6.90, 7.60] }, // 고정: 헤드어택 성공 시 +15%
  '기습의 대가': { method: 'enemyDamage', levels: [4.80, 5.50, 6.20, 6.90, 7.60] }, // 고정: 백어택 성공 시 +15%
  '달인의 저력': { method: 'enemyDamage', levels: [14.00, 14.75, 15.50, 16.25, 17.00] },
  '바리케이드': { method: 'enemyDamage', levels: [14.00, 14.75, 15.50, 16.25, 17.00] },
  '속전속결': { method: 'enemyDamage', levels: [18.00, 18.75, 19.50, 20.25, 21.00] }, // 고정: 홀딩/캐스팅 속도 +20%
  '슈퍼 차지': { method: 'enemyDamage', levels: [18.00, 18.75, 19.50, 20.25, 21.00] }, // 고정: 차징속도 +40%
  '안정된 상태': { method: 'enemyDamage', levels: [14.00, 14.75, 15.50, 16.25, 17.00] },
  '원한': { method: 'enemyDamage', levels: [18.00, 18.75, 19.50, 20.25, 21.00] }, // 고정: 받는 피해 +20%
  '저주받은 인형': { method: 'enemyDamage', levels: [14.00, 14.75, 15.50, 16.25, 17.00] }, // 고정: 회복효과 25% 감소
  '질량 증가': { method: 'enemyDamage', levels: [16.00, 16.75, 17.50, 18.25, 19.00] }, // 고정: 공격속도 -10%
  '타격의 대가': { method: 'enemyDamage', levels: [14.00, 14.75, 15.50, 16.25, 17.00] }, // 고정: 각성기 미적용
  '마나 효율 증가': { method: 'enemyDamage', levels: [13.00, 13.75, 14.50, 15.25, 16.00] }, // 고정: 마나회복 +20%
  '돌격대장': { method: 'enemyDamage', levels: [40.00, 42.00, 44.00, 46.00, 48.00] }, // 이동속도 증가량 raw값(×0.4 전환 필요)
  '정밀 단도': { method: 'critRate', levels: [18.00, 18.75, 19.50, 20.25, 21.00] }, // 고정: 치명타 피해 -6%
  // 이 levels 값은 기존 adrenalineCritRateBonus(14+level*1.5, 최대 20) 공식과 정확히 일치(치명타
  // 적중률 보너스, .Level 기반 — 각인 자체 공격력%는 "중첩당 0.90%"로 별도 상시 스택 메커니즘이라
  // 계산 체인에 아직 미반영). method는 실제로 critRate — 표 작성 시 attackPower로 잘못 분류했던 것 정정.
  '아드레날린': { method: 'critRate', levels: [14.00, 15.50, 17.00, 18.50, 20.00] }, // 고정: 중첩당 공격력 0.90%
  '예리한 둔기': { method: 'critDamage', levels: [44.00, 46.00, 48.00, 50.00, 52.00] }, // 고정: 확률적 피해 20% 감소
};

// 정밀 단도 각인 자체(스톤 아님)의 치명타 적중률% — Description에 이 각인 전용 문구가 없어(예리한
// 둔기처럼 "치명타 피해량이 X%" 같은 고유 텍스트가 없음) 텍스트 파싱 대신 .Level을 직접 읽어서
// 검증된 ENGRAVING_LEVEL_VALUE_TABLE로 조회한다(아드레날린과 동일한 방식).
// 기존에는 이 각인 자체 값이 계산에 전혀 반영되지 않고(스톤 보너스만 반영) 있었던 갭 — 이번에 추가.
// 실측 검증: 사용자가 인게임 각인 정보창 스크린샷 제공(전설0단계=15+전설4단계보너스3=18%,
// 유물1~4단계=18.75/19.50/20.25/21.00%, 스톤 Lv4=+6.00% 전부 ENGRAVING_LEVEL_VALUE_TABLE/
// ABILITY_STONE_ENGRAVING_CATALOG 값과 정확히 일치) — API로 착용 캐릭터를 못 구했지만 스샷으로
// 확정 검증됨.
function getPrecisionDaggerOwnCritRatePercent(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '정밀 단도');
  if (!eng || eng.Level === undefined || eng.Level === null) return 0;
  const entry = ENGRAVING_LEVEL_VALUE_TABLE['정밀 단도'];
  return (entry && entry.levels[eng.Level] !== undefined) ? entry.levels[eng.Level] : 0;
}

// 정밀 단도의 "치명타 피해 6% 감소" — 장식적 부가효과가 아니라 이 각인의 핵심 트레이드오프 자체
// (치명타 적중률 15% 증가 "대신" 치명타 피해 6% 감소, 레벨/등급 무관 상시 적용 — 인게임 스크린샷으로
// 확인). 착용 중이기만 하면(레벨 0 이상) 항상 -6%.
function getPrecisionDaggerCritDamagePenaltyPercent(engravingsData) {
  const eng = getArkPassiveEffectByName(engravingsData, '정밀 단도');
  return (eng && eng.Level !== undefined && eng.Level !== null) ? -PRECISION_DAGGER_FIXED_CRIT_DAMAGE_PENALTY_PERCENT : 0;
}

// 각인 하나(이름+레벨)의 스톤 보너스 값을 실제 착용 중인 스톤 정보에서 이름이 일치할 때만 가져옴 —
// 스톤의 무작위 각인 효과는 그 이름의 각인이 실제로 활성화돼 있을 때만 발동하는 실제 게임 로직과
// 동일하게, 시뮬레이션에서 이름을 바꾸면 스톤 보너스도 같이 사라지게 한다.
function getEngravingStoneBonusValue(engravingsData, name) {
  const eng = getArkPassiveEffectByName(engravingsData, name);
  if (!eng || !eng.AbilityStoneLevel) return 0;
  if (name === '돌격대장') return ABILITY_STONE_ENGRAVING_CATALOG['돌격대장'].levels[eng.AbilityStoneLevel - 1] || 0; // 이미 ×0.4된 적주피%
  if (name === '예리한 둔기') return SHARP_WEAPON_STONE_BONUS[eng.AbilityStoneLevel] || 0;
  if (name === '아드레날린') return 0; // 아드레날린 스톤 보너스는 크리티컬이 아니라 별도 공격력 경로(ctx.adrenalineBonusBase) — 여기서 다루지 않음
  const catalogEntry = ABILITY_STONE_ENGRAVING_CATALOG[name];
  return catalogEntry ? (catalogEntry.levels[eng.AbilityStoneLevel - 1] || 0) : 0;
}

// 결투의 대가/기습의 대가의 "고정효과"(헤드/백어택 성공 시 피해량 추가로 15% 증가) — 레벨 무관 고정값.
// 기존 컨벤션(getBackHeadAttackExtraDamagePercent 등, 조건부는 "상시 발동" 가정)과 동일하게 상시
// 적용으로 취급하고, 실제 계산과 동일하게 "추가 피해"(적주피 아님) 쪽에 더한다.
const ENGRAVING_FIXED_BACK_HEAD_ATTACK_EXTRA_DAMAGE_PERCENT = 15;

// 정밀 단도의 "고정효과" — 다른 각인들의 고정효과와 달리 이건 장식적인 부가효과가 아니라 이 각인의
// 핵심 트레이드오프 자체(치명타 적중률 15% 증가 "대신" 치명타 피해 6% 감소, 레벨/등급 무관 상시 적용
// — 사용자 제공 인게임 스크린샷으로 확인). ENGRAVING_LEVEL_VALUE_TABLE의 정밀 단도 levels 값은 이미
// 이 기본 15%가 포함된 값이므로(전설0단계=15+전설4단계보너스3=18 등, 스크린샷과 정확히 일치 검증됨),
// 치명타 피해 감소분만 별도로 빼주면 된다.
const PRECISION_DAGGER_FIXED_CRIT_DAMAGE_PENALTY_PERCENT = 6;

// 각인 세트(최대 5개, {name, level(0~4)}) 하나를 통째로 가정했을 때의 적주피 배율/치명타 적중률/
// 치명타 피해/치명타 피해 페널티/추가 피해%(결투·기습의 대가 고정효과)를 계산 —
// ENGRAVING_LEVEL_VALUE_TABLE을 직접 조회하는 방식(Description 텍스트 합성이 아님, 더 정확하고
// 안전함). 스톤 보너스는 이름이 일치하는 경우에만 그대로 유지. 원한의 받는 피해 증가, 캐스팅/차징
// 속도, 마나회복 등은 사용자 확정으로 계산에 포함하지 않음.
function calculateEngravingSetStats(engravingsData, selections) {
  const valid = (selections || []).filter((s) => s.name && ENGRAVING_LEVEL_VALUE_TABLE[s.name] && s.level !== undefined && s.level !== null);
  let enemyDamageMultiplier = 1;
  let critRatePercent = 0;
  let critDamagePercent = 0;
  let extraDamagePercent = 0;
  let hasSharpWeapon = false;

  valid.forEach(({ name, level }) => {
    const entry = ENGRAVING_LEVEL_VALUE_TABLE[name];
    const value = entry.levels[level] || 0;
    const stoneValue = getEngravingStoneBonusValue(engravingsData, name);

    if (name === '돌격대장') {
      const MOVE_SPEED_FIXED = 40;
      enemyDamageMultiplier *= toMultiplier((value * MOVE_SPEED_FIXED) / 100 + stoneValue);
    } else if (entry.method === 'enemyDamage') {
      enemyDamageMultiplier *= toMultiplier(value + stoneValue);
    } else if (entry.method === 'critRate') {
      critRatePercent += value + (name === '아드레날린' ? 0 : stoneValue);
      if (name === '정밀 단도') critDamagePercent -= PRECISION_DAGGER_FIXED_CRIT_DAMAGE_PENALTY_PERCENT;
    } else if (entry.method === 'critDamage') {
      critDamagePercent += value + stoneValue;
      hasSharpWeapon = true;
    }

    if (name === '결투의 대가' || name === '기습의 대가') {
      extraDamagePercent += ENGRAVING_FIXED_BACK_HEAD_ATTACK_EXTRA_DAMAGE_PERCENT;
    }
  });

  return { enemyDamageMultiplier, critRatePercent, critDamagePercent, extraDamagePercent, hasSharpWeapon };
}

// 각인 세트 시뮬레이터 진입점(최적화 없음). selections = [{name, level}] 최대 5개 — 지정 안 하면
// 실제 5개 각인+레벨을 그대로 사용. 실제(ctx) 값 대비 총딜 변화율을 ratio 치환 방식으로 계산 —
// 각인에서 오는 적주피/치명타 항목만 시뮬레이션 값으로 교체하고 그 외(코어/보석/진화 등)는 ctx의
// 실제 계산 결과를 그대로 사용한다(calculateArkGridPointGemSimulation과 동일한 패턴).
function calculateEngravingSetSimulation(dealerData, ctx, selections) {
  const engravingsData = dealerData.engravings;
  const real = calculateEngravingSetStats(engravingsData, getEngravingList(engravingsData));
  const sim = calculateEngravingSetStats(engravingsData, selections);

  // 치명타 배율: recalcCritAvgDamageMultiplierWithDelta 재사용(rate/damage/onHit이 비선형으로 얽혀있어
  // 단순 비율 치환이 불가능 — calculate.js 상단 참고). onHit은 각인 시뮬레이터가 안 건드리므로 delta 0.
  const critAvgDamageMultiplier = recalcCritAvgDamageMultiplierWithDelta(
    ctx.critResult, sim.critRatePercent - real.critRatePercent, sim.critDamagePercent - real.critDamagePercent, 0
  );
  // 예리한 둔기의 "10% 확률로 20% 감소된 피해" 페널티는 착용 여부(레벨 무관)로만 결정되는 고정 배율이라
  // ctx.critResult.sharpWeaponPenalty를 그대로 나눠서 빼고 새로 곱한다.
  const sharpWeaponPenaltyMultiplier = 1 - 0.10 * 0.20; // getSharpWeaponDamagePenaltyMultiplier와 동일 고정값
  const realSharpWeaponPenalty = ctx.critResult.sharpWeaponPenalty;
  const simSharpWeaponPenalty = sim.hasSharpWeapon ? sharpWeaponPenaltyMultiplier : 1;
  const adjustedCritMultiplier = critAvgDamageMultiplier / realSharpWeaponPenalty * simSharpWeaponPenalty;

  const realEnemyMultiplier = real.enemyDamageMultiplier;
  const simEnemyMultiplier = sim.enemyDamageMultiplier;
  const enemyDamageMultiplier = ctx.enemyDamageResult.multiplier / realEnemyMultiplier * simEnemyMultiplier;

  // 결투의 대가/기습의 대가 고정효과(+15%, 백/헤드어택 성공 시 추가 피해) — extraDamageMultiplier =
  // 1+합연산%/100 구조라 델타를 그대로 더하면 된다(ratio 치환 불필요).
  const extraDamageMultiplier = ctx.extraDamageResult.multiplier + (sim.extraDamagePercent - real.extraDamagePercent) / 100;

  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const totalDamage = ctx.finalDamage * adjustedCritMultiplier * extraDamageMultiplier * enemyDamageMultiplier;

  return {
    realCritRatePercent: real.critRatePercent, simCritRatePercent: sim.critRatePercent,
    realCritDamagePercent: real.critDamagePercent, simCritDamagePercent: sim.critDamagePercent,
    realEnemyMultiplier, simEnemyMultiplier,
    realExtraDamagePercent: real.extraDamagePercent, simExtraDamagePercent: sim.extraDamagePercent,
    critAvgDamageMultiplier: adjustedCritMultiplier, enemyDamageMultiplier, extraDamageMultiplier,
    totalDamage, totalChangePercent: ((totalDamage / realTotal) - 1) * 100,
  };
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

// 직업별 "아이덴티티(Z/X) 상시 버프" — 사용자가 정리해 제공한 전 직업 초각성/아이덴티티 스킬 문서를
// 근거로, 아이덴티티 효과가 "상시 켜져 있다"고 가정(사용자 확정)했을 때 딜러 계산에 반영할 수치.
// API로는 이 토글이 실제로 켜져 있는지 알 수 없으므로 항상 켜진 것으로 가정 — 실제 게임에서는
// 게이지/쿨타임 관리에 따라 이보다 낮은 평균 가동률이 나올 수 있음(추후 유효율 개념 도입 가능).
//
// 값 종류: critRatePercent(치명타 적중률)/critDamagePercent(치명타 피해)/attackPercent(공격력%)/
// enemyDamagePercent(적에게 주는 피해%, 곱연산 신규 항)/moveSpeedPercent·attackSpeedPercent
// (이동/공격속도% — 이 앱의 데미지 공식엔 아직 안 쓰이지만 음속돌파/돌격대장 효율 계산에 쓸 예정이라
// 사용자 확정으로 일단 계산만 해서 노출, 최종 데미지에는 미반영).
//
// 서포터 전용 클래스(발키리/홀리나이트/도화가/바드)는 유효율(effectiveRatio) 개념이 필요해서 이번
// 범위에서 제외(별도 처리 예정). 스탠스가 배타적인 데빌헌터/건슬링어(고정 수치 자체가 없음)는 계산
// 대상에서 제외(사용자 확정). 그 외 "상시 스탯% 버프가 아예 없는" 직업(워로드/호크아이/환수사 —
// 생존기·순수 액티브 데미지형, 서머너/가디언나이트/배틀마스터/스트라이커 — 자원관리형 스킬만 있고
// 딜 %버프 없음)과 시너지/디버프 성격이라 별도 처리할 인파이터·기상술사는 이번 범위에 없음(표에
// 없으면 자동으로 보너스 0). 리퍼는 아래 6번에 추가로 포함됨.
//
// enemyDamagePercent로 넣은 항목(기공사/디스트로이어/소서리스/블래스터/차원술사) 중 상당수는 원래
// "해방스킬" "몬스터 대상 스킬" "일반 스킬" "각성기"처럼 특정 스킬군에만 적용되는 조건부 버프다. 이
// 앱은 "적에게 주는 피해"를 스킬 구분 없이 캐릭터 전체에 곱하는 단일 배율 모델이라, 조건 없이 항상
// 적용된다고 근사한 값이라 실제보다 다소 과대평가될 수 있음(전투분석 스킬 지분 가중 연동은 다음 단계).
const IDENTITY_PERSISTENT_STAT_BONUS = {
  // 1. 단순 스탯 버프형(상시 켜짐 가정) — 폭주모드/사신화/악마화/하이퍼 싱크
  '버서커': { critRatePercent: 30, moveSpeedPercent: 20, attackSpeedPercent: 20 },
  '슬레이어': { critRatePercent: 30, moveSpeedPercent: 20, attackSpeedPercent: 20 },
  '소울이터': { critRatePercent: 20, moveSpeedPercent: 20, attackSpeedPercent: 10 },
  '데모닉': { moveSpeedPercent: 20 },
  '스카우터': { attackPercent: 6, moveSpeedPercent: 30, attackSpeedPercent: 15 },
  // 2. 단계/스택형 — 최고 스택 기준(사용자 확정)
  '블레이드': { attackPercent: 30, moveSpeedPercent: 10, attackSpeedPercent: 20 }, // 블레이드 아츠, 오브 최대치
  '기공사': { enemyDamagePercent: 60, attackSpeedPercent: 15 }, // 금강선공 3단계
  '디스트로이어': { enemyDamagePercent: 45 }, // 중력코어 3개, 해방스킬 조건부 근사
  // 3. 스탠스 전환형 — 창술사는 집중 스탠스 고정(사용자 확정, 추후 변경 가능). 브레이커는 각인별로
  // 갈려서 아래 getIdentityPersistentStatBonus에서 Title(직업각인명)로 분기 처리.
  '창술사': { critDamagePercent: 60, moveSpeedPercent: 15 },
  // 4. 게이지/자원 소모형(딜러만, 상시 켜짐 가정) — 마력 해방/오버히트/차원 간섭
  '소서리스': { enemyDamagePercent: 18 }, // 마력 해방(게이지100%), 몬스터 대상 스킬 조건부 근사
  '블래스터': { enemyDamagePercent: 25 }, // 오버히트, 일반 스킬 조건부 근사
  '차원술사': { enemyDamagePercent: 50 }, // 간섭 2중첩, 각성기 조건부 근사
  // 5. 카드형 — 아르카나는 "도태" 카드 상시 가정(사용자 확정, 랜덤 요소 무시 — 추후 변경 가능)
  '아르카나': { critRatePercent: 100, critDamagePercent: 50 },
  // 6. 리퍼 — 각인 무관 고정 시스템(페르소나+혼돈상태가 배타적 빌드가 아니라 같이 유지되는 상태이므로
  // 둘 다 상시 켜짐 가정으로 합산). 페르소나 이동속도30% + 혼돈상태 이동속도10%=합산 40%, 혼돈상태
  // 공격속도10%·치명타적중률15%. "급습 스킬 피해 +25%/스택 최대 5중첩"은 급습 스킬 전용 조건부라
  // 다른 게이지형 항목과 동일하게 적주피에 근사 적용, 최고 스택(5중첩=125%) 가정 — 노트: 이 수치는
  // 표기("+25%/스택")를 "스택당 25%p"로 해석한 것이라 실제보다 클 수 있음(사용자 확인 시 조정 예정).
  '리퍼': { critRatePercent: 15, moveSpeedPercent: 40, attackSpeedPercent: 10, enemyDamagePercent: 125 },
};

// 브레이커는 채용한 각인(직업각인명)에 따라 권왕태세/수라 상태 중 하나만 적용된다.
const BREAKER_STANCE_STAT_BONUS = {
  '권왕': { attackSpeedPercent: 20 }, // 권왕파천무 각인 → Z 권왕태세
  '수라': { moveSpeedPercent: 15 }, // 수라의 길 각인 → Z 수라 상태
};

// 딜러 데이터로 아이덴티티 상시 버프 객체를 조회 (없는 직업은 빈 객체)
function getIdentityPersistentStatBonus(dealerData) {
  const className = dealerData.profiles ? dealerData.profiles.CharacterClassName : '';
  if (className === '브레이커') {
    const buildName = getClassBuildEngravingName(dealerData.arkpassive) || '';
    if (buildName.includes('수라')) return BREAKER_STANCE_STAT_BONUS['수라'];
    if (buildName.includes('권왕')) return BREAKER_STANCE_STAT_BONUS['권왕'];
    return {};
  }
  return IDENTITY_PERSISTENT_STAT_BONUS[className] || {};
}

function getIdentityCritRatePercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).critRatePercent || 0; }
function getIdentityCritDamagePercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).critDamagePercent || 0; }
function getIdentityAttackPercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).attackPercent || 0; }
function getIdentityEnemyDamagePercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).enemyDamagePercent || 0; }
function getIdentityMoveSpeedPercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).moveSpeedPercent || 0; }
function getIdentityAttackSpeedPercent(dealerData) { return getIdentityPersistentStatBonus(dealerData).attackSpeedPercent || 0; }

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

// ===== 통합 시뮬레이터 엔진 =====
// 지금까지 6개 시뮬레이터(어빌리티스톤/팔찌/장비레벨/아크패시브 진화/아크그리드/전투분석)는 전부
// 실제(ctx) 값 하나만을 기준선으로 놓고 독립적으로 "이거 하나 바꾸면 얼마나 달라지나"만 계산했다.
// 이 엔진은 여러 탭의 선택을 동시에 하나의 dealerData 사본에 합성한 뒤 전체 체인을 한 번만 계산해서,
// "지금까지 다른 탭에서 고른 것들이 다 반영된 상태에서, 이 선택은 얼마나 기여하는가"를 계산할 수 있게 한다.
//
// overrides = {
//   abilityStone: [{name, level}] | null,               // 어빌리티스톤 탭과 동일한 selections
//   bracelet: { basic: [...], grant: [...] } | null,      // 팔찌 탭과 동일한 selections
//   armorLevels: { [apiType]: level } | null,             // 장비 탭과 동일한 levelSelections
//   evolution: { tier1to4Sels: [{name,level}], tier5Sels: [{name,level}] } | null,  // 진화 탭 선택(2D배열은 호출부에서 변환)
//   arkgrid: { orderPoints:{해,달,별}, chaosPoints:{해,달,별}, gemAttackLevel, gemExtraDamageLevel, gemBossDamageLevel } | null,
// }
// 스톤/팔찌/진화/장비는 이미 calculateHypothetical*가 쓰는 "dealerData 얕은 복사 + 전체 체인 재계산"
// 패턴을 그대로 재사용(중복 로직 없음). 아크그리드만 신규 — 혼돈 코어는 arkgrid.Slots의 Point를 그대로
// 바꿔서(실제 코어 텍스트를 그대로 재사용하므로 [XXP] 구간이 자동으로 맞게 활성화됨) 다른 실제 추출
// 함수들이 알아서 정확히 반영하게 하고, 젬은 실제 젬을 전부 제거하고 원하는 레벨의 가짜 젬 하나를
// 슬롯 하나에 붙여서 반영한다. 질서 코어는 (사용자 확정) 코어마다 스탯이 달라 적주피로 통일 근사하는
// 기존 방식을 그대로 유지 — dealerData에 굽지 않고 계산 마지막에 별도 배율로 곱한다.

// 장비 탭과 동일한 방식(아이템 이름의 "+N"을 갈아끼움) — ARMOR_LEVEL_TABLE이 이름 텍스트가 아니라
// 레벨 자체로 조회되므로(getArmorLevel), 실제 아이템의 다른 필드는 건드릴 필요가 없다.
function buildDealerDataWithArmorLevels(dealerData, levelSelections) {
  if (!levelSelections) return dealerData;
  const equipment = (dealerData.equipment || []).map((item) => {
    if (!ARMOR_EQUIPMENT_TYPES.includes(item.Type)) return item;
    const level = levelSelections[item.Type];
    if (!level) return item;
    const name = stripHtml(item.Name);
    const newName = /\+\d+/.test(name) ? name.replace(/\+\d+/, `+${level}`) : `${name} +${level}`;
    return { ...item, Name: newName };
  });
  return { ...dealerData, equipment };
}

// 팔찌 탭과 동일한 파싱 재사용 — dealerData만 필요하므로 parseBraceletSelectionsToDealerData의
// 결과 중 dealerData만 취한다.
function buildDealerDataWithBraceletSelections(dealerData, selections) {
  if (!selections) return dealerData;
  return parseBraceletSelectionsToDealerData(dealerData, selections).dealerData;
}

// 혼돈 코어 3종의 포인트를 그대로 바꿔치기(실제 코어 텍스트는 유지 — [XXP] 구간이 자동으로 재계산됨)
// + 젬 3항목 레벨을 가짜 젬 하나로 합성. 질서 코어는 여기서 건드리지 않음(계산 마지막에 별도 처리).
function buildDealerDataWithArkGridChaosAndGems(dealerData, arkgridOverrides) {
  if (!arkgridOverrides || !dealerData.arkgrid || !dealerData.arkgrid.Slots) return dealerData;
  const chaosPoints = arkgridOverrides.chaosPoints || {};
  const hasGemOverride = arkgridOverrides.gemAttackLevel !== undefined
    || arkgridOverrides.gemExtraDamageLevel !== undefined || arkgridOverrides.gemBossDamageLevel !== undefined;
  let gemsAttached = false;

  const makeGemTooltip = (label, level) => JSON.stringify({ Element_000: { value: `[${label}] Lv.${level}` } });
  const syntheticGems = [];
  if (arkgridOverrides.gemAttackLevel) syntheticGems.push({ Tooltip: makeGemTooltip('공격력', arkgridOverrides.gemAttackLevel) });
  if (arkgridOverrides.gemExtraDamageLevel) syntheticGems.push({ Tooltip: makeGemTooltip('추가 피해', arkgridOverrides.gemExtraDamageLevel) });
  if (arkgridOverrides.gemBossDamageLevel) syntheticGems.push({ Tooltip: makeGemTooltip('보스 피해', arkgridOverrides.gemBossDamageLevel) });

  const newSlots = dealerData.arkgrid.Slots.map((slot) => {
    const typeText = getCoreTypeText(slot.Tooltip);
    const isChaos = typeText.includes('혼돈');
    const group = typeText.includes('해') ? '해' : typeText.includes('달') ? '달' : typeText.includes('별') ? '별' : null;
    const newSlot = { ...slot };
    if (isChaos && group && chaosPoints[group] !== undefined) {
      newSlot.Point = chaosPoints[group];
    }
    if (hasGemOverride) {
      newSlot.Gems = (!gemsAttached && (gemsAttached = true)) ? syntheticGems : [];
    }
    return newSlot;
  });
  return { ...dealerData, arkgrid: { ...dealerData.arkgrid, Slots: newSlots } };
}

// 질서 코어 3종의 "적주피 통일 근사" 배율 — dealerData에 굽지 않고 최종 결과에 곱하는 별도 항.
// overrides.arkgrid.orderPoints가 없으면(질서를 안 건드림) 실제 값 그대로 유지되도록 배율 1을 반환.
function calculateArkGridOrderAdjustmentMultiplier(dealerData, overrides) {
  const realOrderMultiplier = getOrderCoreEnemyDamageMultiplier(dealerData.arkgrid).multiplier;
  if (!overrides.arkgrid || !overrides.arkgrid.orderPoints) return 1;
  const op = overrides.arkgrid.orderPoints;
  const simulatedOrderMultiplier = toMultiplier(orderCorePointToEnemyDamagePercent(op.해))
    * toMultiplier(orderCorePointToEnemyDamagePercent(op.달))
    * toMultiplier(orderCorePointToEnemyDamagePercent(op.별));
  return simulatedOrderMultiplier / realOrderMultiplier;
}

// 어빌리티 스톤 선택 중 "아드레날린"(스톤 전용 공격력% 보너스, 각인 텍스트가 아니라 calculateFinalDamage의
// adrenalineBonus 파라미터로 직접 들어감)만 engravings 교체로는 반영이 안 되므로 별도로 델타 계산
// (calculateAbilityStoneTotal과 동일한 방식).
function calculateCombinedAdrenalineBonusBase(dealerData, ctx, overrides) {
  if (!overrides.abilityStone) return ctx.adrenalineBonusBase;
  const adrenalineSelection = overrides.abilityStone.find((s) => s.name === '아드레날린');
  const adrenalineDelta = adrenalineSelection ? (ADRENALINE_STONE_BONUS[adrenalineSelection.level] || 0) : 0;
  const realAdrenalineStoneBonus = getAdrenalineStoneBonus(dealerData.equipment);
  return ctx.adrenalineBonusBase - realAdrenalineStoneBonus + adrenalineDelta;
}

// 활성화된 오버라이드들을 전부(또는 일부) 하나의 dealerData 사본에 순서대로 합성 — 각 소스는 서로
// 다른 필드(engravings/arkpassive/equipment/arkgrid)만 건드리므로 순서는 결과에 영향을 주지 않는다.
function buildDealerDataWithAllOverrides(dealerData, overrides) {
  let result = dealerData;
  if (overrides.abilityStone) {
    result = { ...result, engravings: buildEngravingsWithAbilityStoneSelections(result.engravings, overrides.abilityStone) };
  }
  if (overrides.evolution) {
    const realCritLevel = (getEvolutionTierCurrentSelections(dealerData.arkpassive)[1].find((s) => s.name === '치명') || {}).level || 0;
    result = buildDealerDataWithFullEvolutionSelections(result, overrides.evolution.tier1to4Sels, overrides.evolution.tier5Sels, realCritLevel);
  }
  result = buildDealerDataWithBraceletSelections(result, overrides.bracelet);
  result = buildDealerDataWithArmorLevels(result, overrides.armorLevels);
  result = buildDealerDataWithArkGridChaosAndGems(result, overrides.arkgrid);
  return result;
}

// 통합 시뮬레이터 엔진의 진입점 — overrides에 담긴 여러 탭의 선택을 전부(또는 일부) 반영한 총딜을 계산.
// skillShares가 있으면 전투분석 지분 가중까지 같은 계산에 포함된다(calculateSkillWeightedCritEnemyMultiplier
// 재사용). 반환값은 절대 총딜(스칼라)이며, "실제 대비"/"다른 탭 반영 상태 대비" 비교는 호출부에서
// ctx.finalDamage×ctx.critResult.avgDamageMultiplier×... 또는 다른 overrides 조합으로 한 번 더 호출한
// 값과 나눠서 계산한다.
function calculateCombinedSimulationTotal(dealerData, supportData, ctx, overrides, skillShares) {
  const modifiedDealerData = buildDealerDataWithAllOverrides(dealerData, overrides);
  const newStats = calculateCharacterStats(modifiedDealerData);
  const critEnemyCombined = calculateSkillWeightedCritEnemyMultiplier(modifiedDealerData, supportData, ctx, skillShares);
  const newExtra = calculateExtraDamageMultiplier(modifiedDealerData);
  const adrenalineBonusBase = calculateCombinedAdrenalineBonusBase(dealerData, ctx, overrides);
  const orderAdjustment = calculateArkGridOrderAdjustmentMultiplier(dealerData, overrides);

  const newFinalDamage = calculateFinalDamage(
    newStats.basePower, newStats.accessoryAttackFlat, newStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    newStats.chaosCoreAttack.percent, newStats.earringAttackPercent, newStats.arkgridGemsAttackPercent,
    adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );

  return newFinalDamage * critEnemyCombined * newExtra.multiplier * orderAdjustment;
}

// 실제(현재) 대비 변화율 + "다른 탭에서 이미 선택된 것들" 대비 변화율(맥락 안에서의 한계 기여도)을
// 함께 계산. thisTabKey를 지정하면 excludeSelfOverrides(자기 탭 값을 뺀 나머지)를 맥락 기준선으로 삼는다.
function calculateUnifiedSimulationResult(ctx, globalSimState, skillShares) {
  const realTotal = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier;
  const combinedTotal = calculateCombinedSimulationTotal(ctx.dealerData, ctx.supportData, ctx, globalSimState, skillShares);
  return {
    combinedTotal,
    realTotal,
    totalChangePercent: ((combinedTotal / realTotal) - 1) * 100,
  };
}

// ===== 보석(겁화/광휘 피해형) 시뮬레이터 =====
// 스킬 보석은 특정 "스킬 하나"에만 적용되는 피해 증가라서, 그 보석이 전체 딜에 얼마나 기여하는지
// 알려면 그 스킬이 총딜에서 차지하는 지분(전투분석)이 반드시 있어야 한다 — 지분 없이는 계산 불가.
// "재사용 대기시간 감소"형(작열 등)은 DPS 로테이션 모델이 없어 정확한 딜 환산이 불가능하므로
// 기본적으로 레벨을 고려하지 않는다(사용자 확정) — 오직 "피해 X% 증가"형만 계산 대상.
// 실측 발견: 보석 아이템 이름(겁화/작열/광휘)과 실제 효과 종류가 1:1로 안 묶여있음(광휘의 보석이
// "피해 증가"형일 수도, "재사용 대기시간 감소"형일 수도 있음 — 겁화/작열은 이름 자체가 효과 종류를
// 뜻하지만 광휘는 아님) → 이름이 아니라 Description 텍스트("피해 X% 증가" vs "재사용 대기시간 X% 감소")로
// 종류를 판별한다.

// 겁화/광휘(피해 증가형) 보석의 레벨→피해% — 실측 4개 캐릭터(잼구릿/포구릿/권구릿/쩡구릿), 서로 다른
// 스킬/레벨 조합 다수로 교차검증한 선형 공식: 레벨당 +4%p, 레벨1=8%. 블래스터 "포격 스킬"류처럼
// 특정 스킬명이 아닌 그룹형/지원형 보너스는 이 표와 무관한 별도 체계로 보이며(Lv10=40%로 이 공식과
// 어긋남), combat-analysis 스킬 지분과도 이름이 안 맞아 자동으로 매칭 제외된다.
function damageGemLevelToPercent(level) {
  return 4 * ((level || 0) + 1);
}

// 보석 레벨이 오를 때마다 붙는 "기본 공격력 X% 증가"(모든 스킬 보석 공통 부가효과, Option 필드) —
// 6~10레벨만 실측 확인됨(잼구릿/포구릿/한가한신수/권구릿/쩡구릿 교차검증: 6=0.45/7=0.60/8=0.80/
// 9=1.00/10=1.20, 6→7 구간만 +0.15고 나머지는 +0.20이라 선형이 아님 — 그대로 표로 저장).
// 1~5레벨은 데이터가 없어 사용자 확정으로 지원 범위에서 제외 — 그 이하 레벨은 null 반환(호출부가
// 경고 처리).
const BASE_ATTACK_GEM_LEVEL_TABLE = { 6: 0.45, 7: 0.60, 8: 0.80, 9: 1.00, 10: 1.20 };
const BASE_ATTACK_GEM_MIN_SUPPORTED_LEVEL = 6;
function baseAttackGemLevelToPercent(level) {
  return BASE_ATTACK_GEM_LEVEL_TABLE[level] !== undefined ? BASE_ATTACK_GEM_LEVEL_TABLE[level] : null;
}

// gemsData(캐릭터 /gems API 응답)에서 "피해 X% 증가"형 스킬 보석만 뽑아 스킬별로 반환
// (재사용 대기시간 감소형은 제외). gemsData.Effects.Skills[]가 이미 스킬명+효과 텍스트를 정리해서
// 주므로 툴팁을 직접 파싱할 필요가 없다 — gemsData.Gems[].Slot/Level을 GemSlot으로 조인해서 레벨을 구함.
// realBaseAttackPercent는 Option 필드("기본 공격력 X% 증가")에서 그대로 추출(실제값은 API 텍스트
// 그대로라 6레벨 미만이어도 정확함 — 표가 필요한 건 "시뮬레이션 레벨"일 때뿐).
function getDealerDamageGems(gemsData) {
  if (!gemsData || !gemsData.Effects || !gemsData.Effects.Skills) return [];
  const levelBySlot = {};
  (gemsData.Gems || []).forEach((g) => { levelBySlot[g.Slot] = g.Level; });
  const result = [];
  gemsData.Effects.Skills.forEach((s) => {
    const text = (s.Description || []).join(' ');
    const m = text.match(/피해\s*([\d.]+)\s*%\s*증가/);
    if (!m) return;
    const optMatch = (s.Option || '').match(/기본\s*공격력\s*([\d.]+)\s*%\s*증가/);
    result.push({
      gemSlot: s.GemSlot,
      skillName: s.Name,
      level: levelBySlot[s.GemSlot] || 0,
      realDamagePercent: parseFloat(m[1]),
      realBaseAttackPercent: optMatch ? parseFloat(optMatch[1]) : 0,
    });
  });
  return result;
}

// 스킬 지분(skillShares, 전투분석) 기준으로 겁화/광휘 보석들의 가중평균 배율을 계산.
// levelsBySkill로 각 스킬의 (시뮬레이션) 보석 레벨을 지정 — 없으면 실제 레벨 사용.
// 보석이 없는 스킬/매칭 안 된 지분은 배율 1(보너스 없음)로 취급.
function calculateWeightedGemDamageMultiplier(gemBySkillName, skillShares, levelsBySkill) {
  let majorShareTotal = 0;
  let weighted = 0;
  (skillShares || []).forEach((row) => {
    const share = row.sharePercent || 0;
    if (!row.name) return;
    majorShareTotal += share;
    const gem = gemBySkillName[row.name];
    const level = gem ? ((levelsBySkill && levelsBySkill[row.name] !== undefined) ? levelsBySkill[row.name] : gem.level) : 0;
    const percent = gem ? damageGemLevelToPercent(level) : 0;
    weighted += (share / 100) * toMultiplier(percent);
  });
  const remainder = Math.max(0, 100 - majorShareTotal);
  weighted += (remainder / 100) * 1;
  return weighted;
}

// 보석 시뮬레이터 진입점(최적화 없음 — 입력한 레벨 그대로 재계산만). skillShares가 비어있으면(전투분석
// 데이터 없음) 계산 자체가 불가능하므로 rows가 빈 배열로 반환됨 — 호출부(UI)가 이 경우 "전투분석
// 필요" 안내를 보여줘야 한다.
// 레벨이 오를 때 스킬 전용 "피해%"뿐 아니라 모든 보석 공통의 "기본 공격력%"도 같이 오르므로
// (Option 필드), 이 델타를 basePower→finalDamage에 반영해서 "피해% 가중평균 배율"과 함께 최종
// 총딜 변화율 하나로 합쳐서 반환한다. 기본 공격력%는 6~10레벨만 지원(그 미만은 null 반환 → 그 갬은
// 델타에서 제외하고 belowMinLevel 플래그로 UI가 경고를 표시하게 함).
// levelOverrides = { [스킬명]: 레벨 } — 지정 안 한 스킬은 실제 레벨 유지.
function calculateSkillGemSimulation(dealerData, dealerStats, ctx, skillShares, levelOverrides) {
  const damageGems = getDealerDamageGems(dealerData.gems);
  const gemBySkillName = {};
  damageGems.forEach((g) => { if (!gemBySkillName[g.skillName]) gemBySkillName[g.skillName] = g; });

  if (!damageGems.length || !skillShares || !skillShares.length) {
    return { rows: [], realWeightedMultiplier: 1, weightedMultiplier: 1, totalChangePercent: 0 };
  }

  const realWeightedMultiplier = calculateWeightedGemDamageMultiplier(gemBySkillName, skillShares, null);
  const weightedMultiplier = calculateWeightedGemDamageMultiplier(gemBySkillName, skillShares, levelOverrides);

  let baseAttackPercentDelta = 0;
  const rows = Object.values(gemBySkillName).map((g) => {
    const share = (skillShares.find((s) => s.name === g.skillName) || {}).sharePercent || 0;
    const simLevel = (levelOverrides && levelOverrides[g.skillName] !== undefined) ? levelOverrides[g.skillName] : g.level;
    const simBaseAttackPercent = baseAttackGemLevelToPercent(simLevel);
    const belowMinLevel = simBaseAttackPercent === null;
    if (!belowMinLevel) baseAttackPercentDelta += simBaseAttackPercent - g.realBaseAttackPercent;
    return {
      skillName: g.skillName, realLevel: g.level, simLevel, belowMinLevel,
      sharePercent: share, simDamagePercent: damageGemLevelToPercent(simLevel),
      realBaseAttackPercent: g.realBaseAttackPercent, simBaseAttackPercent,
    };
  });

  const gemAttackPercent = getGemsBaseAttackPercent(dealerData.gems) + baseAttackPercentDelta;
  const stonePercent = getAbilityStoneBaseAttackPercent(dealerData.equipment);
  const basePower = calculateBaseAttackPower(
    dealerStats.purePower, gemAttackPercent, stonePercent + dealerStats.wanjibStats.baseAttackPercent
  ) + dealerStats.wanjibStats.baseAttackFlat;
  const finalDamage = calculateFinalDamage(
    basePower, dealerStats.accessoryAttackFlat, dealerStats.chaosCoreAttack.flat, ctx.supportBuffPower,
    dealerStats.chaosCoreAttack.percent, dealerStats.earringAttackPercent, dealerStats.arkgridGemsAttackPercent,
    ctx.adrenalineBonusBase, ctx.classSynergyAttackPercent, ctx.arkPassiveAttackPercent
  );

  const realTotalDamage = ctx.finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier * realWeightedMultiplier;
  const totalDamage = finalDamage * ctx.critResult.avgDamageMultiplier * ctx.extraDamageResult.multiplier * ctx.enemyDamageResult.multiplier * weightedMultiplier;

  return {
    rows, realWeightedMultiplier, weightedMultiplier, baseAttackPercentDelta, finalDamage,
    totalChangePercent: ((totalDamage / realTotalDamage) - 1) * 100,
  };
}
