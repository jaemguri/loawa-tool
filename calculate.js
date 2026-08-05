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
    .replace(/무기\s*공격력이\s*[\d,]+\s*증가한다\s*\(최대\s*30\s*중첩\)/g, '')
    .replace(/생명력이\s*50%[^.]*\./g, '');

  let total = 0;
  const plainMatches = remaining.matchAll(/무기\s*공격력이\s*([\d,]+)\s*증가한다/g);
  for (const pm of plainMatches) {
    total += parseFloat(pm[1].replace(/,/g, ''));
  }
  return total;
}

// 팔찌 텍스트에서 조건부/스택형 무기 공격력만 합산 (실제 효율용, 최대치 가정)
function getBraceletWeaponAttackFlatConditional(braceletText) {
  if (!braceletText) return 0;
  const text = braceletText.replace(/무력화 상태의[^.]*\./g, '');
  let total = 0;

  let m = text.match(/무기\s*공격력이\s*([\d,]+)[^()]*\(최대\s*6\s*중첩\)/);
  if (m) total += parseFloat(m[1].replace(/,/g, '')) * 6;

  m = text.match(/무기\s*공격력이\s*([\d,]+)\s*증가한다\s*\(최대\s*30\s*중첩\)/);
  if (m) total += parseFloat(m[1].replace(/,/g, '')) * 30;

  m = text.match(/생명력이\s*50%[^무]*무기\s*공격력이\s*([\d,]+)/);
  if (m) total += parseFloat(m[1].replace(/,/g, ''));

  return total;
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
    allyShieldHealPercent: 0,
    allyAttackBuffPercent: 0,
    allyDamageBuffPercent: 0,
  };
  if (!braceletText) return result;

  const text = braceletText.replace(/무력화 상태의[^.]*\./g, ''); // 무력화 옵션은 없는 것으로 간주

  result.weaponAttackFlat = getBraceletWeaponAttackFlat(text);
  result.weaponAttackFlatBase = getBraceletWeaponAttackFlatBase(text);
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

  m = text.match(/치명타 저항(?:력)?(?:을|이)\s*(?:감소\s*)?([\d.]+)\s*%(?:\s*감소)?/);
  if (m) result.critResistReductionPercent = parseFloat(m[1]);

  m = text.match(/치명타 피해 저항(?:력)?(?:을|이)\s*(?:감소\s*)?([\d.]+)\s*%(?:\s*감소)?/);
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
function getStatTotalFromEquipment(equipmentList, statName) {
  let total = 0;
  (equipmentList || [])
    .filter((item) => item.Type !== '팔찌')
    .forEach((item) => {
      const text = parseTooltip(item.Tooltip).join(' ');
      total += extractFlat(text, statName);
    });
  return total;
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

// 힘/민첩/지능 = (장비합산 + 팔찌옵션 + 카드240 + 물약원정대1850 + 기본스탯476) × (1 + (펫도감1% + 아바타%)/100)
function getMaxPrimaryStat(equipmentList, braceletText, avatarsData) {
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

  const totalStr = eqStr + brStr + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;
  const totalDex = eqDex + brDex + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;
  const totalInt = eqInt + brInt + CARD_BONUS + POTION_EXPEDITION + BASE_STAT;

  const avatarPercent = getAvatarPrimaryStatPercent(avatarsData);
  const multiplier = 1 + (PET_DOGAM_PERCENT + avatarPercent) / 100;
  return Math.max(totalStr, totalDex, totalInt) * multiplier;
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

// 6개 코어 전체에 박힌 젬들의 "아군 공격력 강화" % 합산
function getAllyAttackBuffFromArkgridGems(arkgridData) {
  let total = 0;
  if (arkgridData && arkgridData.Slots) {
    arkgridData.Slots.forEach((slot) => {
      (slot.Gems || []).forEach((gem) => {
        const text = parseTooltip(gem.Tooltip).join(' ');
        total += extractPercent(text, '아군 공격력 강화');
      });
    });
  }
  return total;
}

// 팔찌+악세+아크그리드(코어/젬)+아크패시브(선각자22+기원22, 고정) 전체의 아군 공격력 강화 % 총합
function getTotalAllyAttackBuffPercent(equipmentList, braceletOptions, arkgridData) {
  const ARKPASSIVE_FIXED = 44; // 선각자 22 + 기원 22
  return (
    (braceletOptions?.allyAttackBuffPercent || 0) +
    getAccessoryAllyAttackBuffPercent(equipmentList) +
    getAllyAttackBuffFromArkgridCores(arkgridData) +
    getAllyAttackBuffFromArkgridGems(arkgridData) +
    ARKPASSIVE_FIXED
  );
}


// 서포터 버프력 = 기본공격력 × 0.22 × (1 + (아공강% + 겁화보석%)/100) × 공증유효율
function calculateSupportBuffPower(basePower, allyAttackBuffPercent, buffGemPercent, effectiveRatio) {
  return basePower * 0.22 * (1 + (allyAttackBuffPercent + buffGemPercent) / 100) * effectiveRatio;
}

// 최종 데미지 = (기본공격력 + 악세공격력고정 + 코어공격력고정 + 서포터버프력) × (1+(코어%+귀걸이%+젬%+아드레날린보너스)/100)
function calculateFinalDamage(basePower, accessoryFlat, coreFlat, supportBuffPower, corePercent, earringPercent, gemPercent, adrenalineBonus) {
  const flatTotal = basePower + accessoryFlat + coreFlat + supportBuffPower;
  const percentSum = corePercent + earringPercent + gemPercent + (adrenalineBonus || 0);
  return flatTotal * toMultiplier(percentSum);
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

  const earringItems = (data.equipment || []).filter((it) => it.Type === '귀걸이');
  let earringWeaponPercent = 0;
  earringItems.forEach((it) => {
    const text = parseTooltip(it.Tooltip).join(' ');
    earringWeaponPercent += extractPercent(text, '무기 공격력');
  });

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

  const flatBonusSum = braceletFlat + coreFlat;
  const percentBonusSum = earringWeaponPercent + corePercentWeapon + enlightenmentPercent;
  const weaponAttack = calculateWeaponAttack(weaponLevel, flatBonusSum, percentBonusSum);

  const primaryStat = getMaxPrimaryStat(data.equipment, braceletText, data.avatars);
  const purePower = calculatePureAttackPower(primaryStat, weaponAttack);

  const gemPercent = getGemsBaseAttackPercent(data.gems);
  const stonePercent = getAbilityStoneBaseAttackPercent(data.equipment);
  const basePower = calculateBaseAttackPower(purePower, gemPercent, stonePercent);

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
    weaponAttack, primaryStat, purePower, basePower,
    accessoryAttackFlat, chaosCoreAttack, earringAttackPercent, arkgridGemsAttackPercent,
    statWindowAttack,
    braceletOptions,
  };
}

// 각인 목록(engravings 응답) 안에 "아드레날린" 각인이 있는지 확인
function hasAdrenalineEngraving(engravingsData) {
  if (!engravingsData) return false;
  return JSON.stringify(engravingsData).includes('아드레날린');
}

// 아드레날린 각인 레벨(1~4)별 추가 보너스 %
const ADRENALINE_STONE_BONUS = { 1: 0.48, 2: 0.60, 3: 0.83, 4: 0.95 };

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
function calculateCritMultiplier(dealerData, supportData, backSameolChecked) {
  const equipment = dealerData.equipment;
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
    백사멸: backSameolChecked ? 10 : 0,
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

  const rate = Math.min(critRatePercent, 100) / 100;
  const critDamageMultiplier = (1 - rate) + rate * toMultiplier(critDamagePercent) * onHitMultiplier;
  const sharpWeaponPenalty = getSharpWeaponDamagePenaltyMultiplier(dealerData.engravings);
  const avgDamageMultiplier = critDamageMultiplier * sharpWeaponPenalty;

  return {
    critRatePercent, critDamagePercent, avgDamageMultiplier,
    critRateBreakdown, critDamageBreakdown, onHitBreakdown,
    sharpWeaponPenalty,
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

// 아크패시브(진화)의 "진화형 피해" % 합산
function getArkPassiveEvolutionDamagePercent(arkpassiveData) {
  return extractPercent(getArkPassiveEffectsText(arkpassiveData, '진화'), '진화형 피해');
}

// 백/헤드 사멸 체크박스의 적에게 주는 피해 보너스 %
function getSameolEnemyDamagePercent(backChecked, headChecked) {
  return (backChecked ? 5 : 0) + (headChecked ? 20 : 0);
}

// 딜러 데이터 + 사멸 체크박스 상태를 받아 "적에게 주는 피해" 전체 배율 계산 (breakdown 포함)
function calculateEnemyDamageMultiplier(dealerData, backSameolChecked, headSameolChecked) {
  const equipment = dealerData.equipment;
  const braceletItem = (equipment || []).find((it) => it.Type === '팔찌');
  const braceletText = braceletItem ? parseTooltip(braceletItem.Tooltip).join(' ') : '';
  const dealerBracelet = parseBraceletOptions(braceletText);

  const necklacePercent = getNecklaceEnemyDamagePercent(equipment);
  const engravingResult = getEngravingEnemyDamageMultiplier(dealerData.engravings);
  const bossGemPercent = getAllArkgridGemsBossDamagePercent(dealerData.arkgrid);
  const chaosCoreResult = getChaosCoreEnemyDamageMultiplier(dealerData.arkgrid);
  const orderCoreResult = getOrderCoreEnemyDamageMultiplier(dealerData.arkgrid);
  const evolutionDamagePercent = getArkPassiveEvolutionDamagePercent(dealerData.arkpassive);
  const sameolPercent = getSameolEnemyDamagePercent(backSameolChecked, headSameolChecked);

  const multiplier =
    toMultiplier(necklacePercent) *
    engravingResult.multiplier *
    toMultiplier(bossGemPercent) *
    chaosCoreResult.multiplier *
    orderCoreResult.multiplier *
    toMultiplier(dealerBracelet.enemyDamagePercent) *
    toMultiplier(evolutionDamagePercent) *
    toMultiplier(sameolPercent);

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
      사멸옵션: sameolPercent,
    },
  };
}