export default async function handler(req, res) {
  // 브라우저에서 보낸 캐릭터명 받기 (예: /api/character?name=홍길동)
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: '캐릭터명을 입력해주세요.' });
  }

  try {
    const response = await fetch(
      `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(name)}/profiles`,
      {
        headers: {
          'Authorization': `bearer ${process.env.LOSTARK_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
