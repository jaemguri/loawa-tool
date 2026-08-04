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

// profiles.Stats 배열에서 힘/민첩/지능 중 가장 큰 값을 찾기
function getMaxPrimaryStat(profilesStats) {
  if (!profilesStats) return 0;
  const targets = ['힘', '민첩', '지능'];
  let max = 0;
  profilesStats.forEach((stat) => {
    if (targets.includes(stat.Type)) {
      const value = parseFloat(String(stat.Value).replace(/,/g, ''));
      if (value > max) max = value;
    }
  });
  return max;
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

// 어빌리티 스톤의 세공 단계 보너스 중 "기본 공격력 N%" 추출
function getAbilityStoneBaseAttackPercent(equipmentList) {
  const stone = (equipmentList || []).find((it) => it.Type === '어빌리티 스톤');
  if (!stone) return 0;
  const text = parseTooltip(stone.Tooltip).join(' ');
  return extractPercent(text, '기본 공격력');
}

// 기본 공격력 = 순수 공격력 × (1 + (보석% + 세공%)/100)
function calculateBaseAttackPower(purePower, gemPercent, stonePercent) {
  return purePower * (1 + (gemPercent + stonePercent) / 100);
}