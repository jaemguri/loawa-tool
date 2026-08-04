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
    const [profilesRes, equipmentRes, arkgridRes] = await Promise.all([
      fetch(`${base}/profiles`, { headers }),
      fetch(`${base}/equipment`, { headers }),
      fetch(`${base}/arkgrid`, { headers }),
    ]);

    if (!profilesRes.ok) {
      return res.status(profilesRes.status).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });
    }

    const profiles = await profilesRes.json();
    const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
    const arkgrid = arkgridRes.ok ? await arkgridRes.json() : null;

    return res.status(200).json({ profiles, equipment, arkgrid });
  } catch (error) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다: ' + error.message });
  }
}