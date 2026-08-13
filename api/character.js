async function fetchCharacterData(name, headers) {
  const base = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(name)}`;
  const [profilesRes, equipmentRes, arkgridRes, arkpassiveRes, gemsRes, avatarsRes, engravingsRes, combatSkillsRes] = await Promise.all([
    fetch(`${base}/profiles`, { headers }),
    fetch(`${base}/equipment`, { headers }),
    fetch(`${base}/arkgrid`, { headers }),
    fetch(`${base}/arkpassive`, { headers }),
    fetch(`${base}/gems`, { headers }),
    fetch(`${base}/avatars`, { headers }),
    fetch(`${base}/engravings`, { headers }),
    fetch(`${base}/combat-skills`, { headers }),
  ]);

  if (!profilesRes.ok) return null;

  const profiles = await profilesRes.json();
  const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
  const arkgrid = arkgridRes.ok ? await arkgridRes.json() : null;
  const arkpassive = arkpassiveRes.ok ? await arkpassiveRes.json() : null;
  const gems = gemsRes.ok ? await gemsRes.json() : null;
  const avatars = avatarsRes.ok ? await avatarsRes.json() : null;
  const engravings = engravingsRes.ok ? await engravingsRes.json() : null;
  const combatSkills = combatSkillsRes.ok ? await combatSkillsRes.json() : null;

  return { profiles, equipment, arkgrid, arkpassive, gems, avatars, engravings, combatSkills };
}

export default async function handler(req, res) {
  const { dealer, support } = req.query;

  if (!dealer || !support) {
    return res.status(400).json({ error: '딜러와 서포터 캐릭터명을 모두 입력해주세요.' });
  }

  const headers = {
    Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
  };

  try {
    const [dealerData, supportData] = await Promise.all([
      fetchCharacterData(dealer, headers),
      fetchCharacterData(support, headers),
    ]);

    if (!dealerData) {
      return res.status(404).json({ error: `딜러 캐릭터(${dealer})를 찾을 수 없습니다.` });
    }
    if (!supportData) {
      return res.status(404).json({ error: `서포터 캐릭터(${support})를 찾을 수 없습니다.` });
    }

    return res.status(200).json({ dealer: dealerData, support: supportData });
  } catch (error) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다: ' + error.message });
  }
}