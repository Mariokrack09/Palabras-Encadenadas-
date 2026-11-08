const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const TURN_SECONDS = 25;
const LIVES = 3;
const rooms = new Map();

const base = s => s.toLowerCase().replace(/ñ/g, '\u0001')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'ñ');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Palabras encadenadas OK');
});
const wss = new WebSocketServer({ server });

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { players: [], words: [], current: null, deadline: 0, timer: null, over: false, winner: null });
  return rooms.get(code);
}
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

function lastLetter(r) {
  if (!r.words.length) return null;
  const w = base(r.words[r.words.length - 1].w);
  return w[w.length - 1];
}

function broadcast(r) {
  const left = Math.max(0, Math.round((r.deadline - Date.now()) / 1000));
  const state = {
    t: 'state',
    players: r.players.map(p => ({ id: p.id, name: p.name, score: p.score, lives: p.lives })),
    over: r.over,
    winner: r.winner,
    words: r.words.slice(-100),
    total: r.words.length,
    current: r.current,
    letter: lastLetter(r),
    left,
  };
  r.players.forEach(p => send(p.ws, { ...state, me: p.id }));
}

function nextAliveFrom(r, idx) {
  const n = r.players.length;
  for (let k = 0; k < n; k++) {
    const p = r.players[(idx + k) % n];
    if (p.lives > 0) return p;
  }
  return null;
}

function checkOver(r) {
  const alive = r.players.filter(p => p.lives > 0);
  if (alive.length === 0 || (r.players.length > 1 && alive.length <= 1)) {
    r.over = true;
    r.winner = alive.length === 1 ? alive[0].name : null;
    r.current = null;
    clearTimeout(r.timer);
    r.deadline = 0;
    return true;
  }
  return false;
}

function nextTurn(r) {
  clearTimeout(r.timer);
  if (r.over || !r.players.length) { r.current = null; return; }
  const i = r.players.findIndex(p => p.id === r.current);
  const p = nextAliveFrom(r, i + 1);
  r.current = p ? p.id : null;
  if (p) startTimer(r);
}

function startTimer(r) {
  clearTimeout(r.timer);
  r.deadline = Date.now() + TURN_SECONDS * 1000;
  r.timer = setTimeout(() => {
    const p = r.players.find(p => p.id === r.current);
    if (p) p.lives -= 1;
    if (!checkOver(r)) nextTurn(r);
    broadcast(r);
  }, TURN_SECONDS * 1000);
}

let nextId = 1;
const r_over = r => r.over;
wss.on('connection', ws => {
  let room = null, code = null, me = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'join' && !room) {
      code = String(m.room || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      const name = String(m.name || '').trim().slice(0, 14);
      if (!code || !name) return send(ws, { t: 'err', msg: 'Nombre y sala obligatorios.' });
      room = getRoom(code);
      if (room.players.length >= 8) return send(ws, { t: 'err', msg: 'Sala llena (máx. 8).' });
      me = { id: 'p' + nextId++, name, score: 0, lives: r_over(room) ? 0 : LIVES, ws };
      room.players.push(me);
      if (!room.current && !room.over) { room.current = me.id; startTimer(room); }
      return broadcast(room);
    }
    if (!room || !me) return;

    if (m.t === 'word') {
      if (room.over || room.current !== me.id) return send(ws, { t: 'err', msg: 'No es tu turno.' });
      const w = String(m.w || '').trim().toLowerCase();
      if (!/^[a-záéíóúüñ]{2,25}$/.test(w)) return send(ws, { t: 'err', msg: 'Usa solo letras (mínimo 2).' });
      const b = base(w), ll = lastLetter(room);
      if (ll && b[0] !== ll) return send(ws, { t: 'err', msg: `Debe empezar con «${ll.toUpperCase()}».` });
      if (room.words.some(x => base(x.w) === b)) return send(ws, { t: 'err', msg: 'Esa palabra ya se usó.' });
      room.words.push({ w, n: me.name });
      me.score += w.length;
      nextTurn(room);
      broadcast(room);
    }
    if (m.t === 'reset') {
      room.words = [];
      room.players.forEach(p => { p.score = 0; p.lives = LIVES; });
      room.over = false;
      room.winner = null;
      room.current = room.players[0].id;
      startTimer(room);
      broadcast(room);
    }
  });

  ws.on('close', () => {
    if (!room || !me) return;
    const wasCurrent = room.current === me.id;
    const i = room.players.indexOf(me);
    room.players.splice(i, 1);
    if (!room.players.length) { clearTimeout(room.timer); rooms.delete(code); return; }
    if (!room.over) {
      if (!checkOver(room) && wasCurrent) {
        const p = nextAliveFrom(room, i % room.players.length);
        room.current = p ? p.id : null;
        if (p) startTimer(room);
      }
    }
    broadcast(room);
  });
});

setInterval(() => wss.clients.forEach(ws => {
  if (!ws.isAlive) return ws.terminate();
  ws.isAlive = false; ws.ping();
}), 30000);

server.listen(PORT, () => console.log('Servidor en puerto ' + PORT));
