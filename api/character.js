export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: '캐릭터명을 입력해주세요.' });
  }

  const headers = {
    Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
  };
  const base = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(name)}`;

  try {
    const [profilesRes, equipmentRes, arkgridRes, arkpassiveRes, gemsRes, avatarsRes] = await Promise.all([
      fetch(`${base}/profiles`, { headers }),
      fetch(`${base}/equipment`, { headers }),
      fetch(`${base}/arkgrid`, { headers }),
      fetch(`${base}/arkpassive`, { headers }),
      fetch(`${base}/gems`, { headers }),
      fetch(`${base}/avatars`, { headers }),
    ]);

    if (!profilesRes.ok) {
      return res.status(profilesRes.status).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });
    }

    const profiles = await profilesRes.json();
    const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
    const arkgrid = arkgridRes.ok ? await arkgridRes.json() : null;
    const arkpassive = arkpassiveRes.ok ? await arkpassiveRes.json() : null;
    const gems = gemsRes.ok ? await gemsRes.json() : null;
    const avatars = avatarsRes.ok ? await avatarsRes.json() : null;

    return res.status(200).json({ profiles, equipment, arkgrid, arkpassive, gems, avatars });
  } catch (error) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다: ' + error.message });
  }
}