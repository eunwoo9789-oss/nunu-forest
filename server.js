const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = 'nunu8989_forest_admin';

app.use(express.json());
app.use(express.static('public'));

/* ══════════════════════════════════════
   STORAGE
══════════════════════════════════════ */
let storage;

if (process.env.MONGO_URI) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGO_URI);
  let col;

  client.connect()
    .then(() => { col = client.db('nunuforest').collection('reservations'); })
    .catch(e => { console.error('MongoDB 연결 실패:', e.message); process.exit(1); });

  storage = {
    getAll:    ()           => col.find({}, { projection: { _id: 0 } }).toArray(),
    add:       (r)          => col.insertOne(r).then(() => r),
    update:    (id, fields) => col
      .findOneAndUpdate({ id }, { $set: { ...fields, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after', projection: { _id: 0 } })
      .then(res => res.value ?? res),
    remove:    (id)         => col.deleteOne({ id }),
    findOne:   (query)      => col.findOne(query, { projection: { _id: 0 } }),
  };

  console.log('☁️  MongoDB 모드로 시작합니다.');

} else {
  const DATA_FILE = path.join(__dirname, 'data.json');

  const read = () => {
    if (!fs.existsSync(DATA_FILE))
      fs.writeFileSync(DATA_FILE, '{"reservations":[]}');
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).reservations; }
    catch { return []; }
  };
  const write = list =>
    fs.writeFileSync(DATA_FILE, JSON.stringify({ reservations: list }, null, 2));

  storage = {
    getAll:  async ()           => read(),
    add:     async (r)          => { const l = read(); l.push(r); write(l); return r; },
    update:  async (id, fields) => {
      const l = read(), i = l.findIndex(r => r.id === id);
      if (i === -1) return null;
      l[i] = { ...l[i], ...fields, updatedAt: new Date().toISOString() };
      write(l); return l[i];
    },
    remove:  async (id)         => { write(read().filter(r => r.id !== id)); },
    findOne: async (query)      => {
      const list = read();
      return list.find(r => Object.entries(query).every(([k, v]) => r[k] === v)) ?? null;
    },
  };

  console.log('💾  파일 모드로 시작합니다 (로컬 개발용).');
}

/* ══════════════════════════════════════
   API ROUTES
══════════════════════════════════════ */
app.get('/api/reservations', async (req, res) => {
  res.json(await storage.getAll());
});

app.post('/api/reservations', async (req, res) => {
  const { name, realName, date, option, token } = req.body;
  if (!name || !date || !option || !token)
    return res.status(400).json({ error: '필수 정보가 없습니다.' });

  const isAdmin = token === ADMIN_TOKEN;
  const list = await storage.getAll();

  const CAPACITY = 5;

  if (!isAdmin) {
    if (list.find(r => r.token === token))
      return res.status(400).json({ error: '이미 약속하셨습니다. 내 약속에서 수정 또는 취소 후 재신청해주세요.' });

    if (list.find(r =>
      r.name.trim().toLowerCase() === name.trim().toLowerCase() && r.token !== token
    ))
      return res.status(400).json({ error: '이미 숲에 살고 있는 닉네임이에요! 다른 닉네임을 골라주세요 🐿️' });

    if (option === 'lunch' || option === 'dinner') {
      const seatCount = list.filter(r => r.date === date && r.option === option).length;
      if (seatCount >= CAPACITY)
        return res.status(400).json({ error: `해당 세션은 이미 ${CAPACITY}명이 꽉 찼어요! 다른 날짜나 옵션을 선택해주세요. 😢` });
    }
  }

  const entryToken = isAdmin ? uuidv4() : token;
  const reservation = {
    id: uuidv4(),
    name,
    realName: realName || name,
    date, option,
    token: entryToken,
    createdAt: new Date().toISOString()
  };
  res.json(await storage.add(reservation));
});

app.put('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const { date, option, token } = req.body;

  const existing = await storage.findOne({ id });
  if (!existing) return res.status(404).json({ error: '약속을 찾을 수 없습니다.' });
  if (existing.token !== token && token !== ADMIN_TOKEN)
    return res.status(403).json({ error: '권한이 없습니다.' });

  if (token !== ADMIN_TOKEN && (option === 'lunch' || option === 'dinner')) {
    const list = await storage.getAll();
    const seatCount = list.filter(r => r.date === date && r.option === option && r.id !== id).length;
    if (seatCount >= 5)
      return res.status(400).json({ error: '해당 세션은 이미 5명이 꽉 찼어요! 다른 날짜나 옵션을 선택해주세요. 😢' });
  }

  res.json(await storage.update(id, { date, option }));
});

app.delete('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  const existing = await storage.findOne({ id });
  if (!existing) return res.status(404).json({ error: '약속을 찾을 수 없습니다.' });
  if (existing.token !== token && token !== ADMIN_TOKEN)
    return res.status(403).json({ error: '권한이 없습니다.' });

  await storage.remove(id);
  res.json({ success: true });
});

/* ══════════════════════════════════════
   START
══════════════════════════════════════ */
app.listen(PORT, () => {
  console.log('');
  console.log('🌿 =============================');
  console.log('🍃  누누의 숲 서버 시작!');
  console.log(`🔗  http://localhost:${PORT}`);
  console.log('🌿 =============================');
  console.log('');
});
