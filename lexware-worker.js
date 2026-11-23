// Fixora-Worker für Cloudflare (Version 4: Lexware Office + Synchronisierung zwischen iPhone, Mac und Windows)
// Geheimnisse (im Worker unter "Einstellungen > Variablen und Geheimnisse" als "Geheimnis" anlegen):
//   LEX_KEY      = API-Schlüssel aus Lexware Office (Erweiterungen > Public API)
//   FIXORA_TOKEN = Passwort aus Fixora (Mehr > Lexware)
// Bindung für die Synchronisierung (im Worker unter "Bindungen" > "D1-Datenbank"):
//   DB           = D1-Datenbank "fixora-sync"
// Die Daten werden in Fixora mit deinem Sync-Passwort verschlüsselt, bevor sie hier ankommen.
// Der Worker und Cloudflare sehen nur verschlüsselte Zeichenketten.
const ORIGIN = 'https://borisenok-hermann.github.io';
const ALLOWED_PUT = [/^\/v1\/contacts\/[0-9a-f-]+$/];
const ALLOWED = [/^\/v1\/invoices\/[0-9a-f-]+\/document$/, /^\/v1\/files\/[0-9a-f-]+$/, /^\/v1\/profile$/, /^\/v1\/contacts$/, /^\/v1\/contacts\/[0-9a-f-]+$/, /^\/v1\/invoices$/, /^\/v1\/invoices\/[0-9a-f-]+$/];

let ready = false;
async function setup(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS items (k TEXT PRIMARY KEY, v TEXT, rev INTEGER NOT NULL, at TEXT)'),
    db.prepare('CREATE INDEX IF NOT EXISTS items_rev ON items(rev)'),
    db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)')
  ]);
  ready = true;
}

async function sync(req, env, url, json) {
  if (!env.DB) return json({ fixora: 'nodb', message: 'D1-Datenbank ist im Worker nicht als "DB" verbunden' }, 500);
  const db = env.DB; await setup(db);
  const p = url.pathname;
  if (p === '/sync/meta' && req.method === 'GET') {
    const r = await db.prepare("SELECT v FROM meta WHERE k = 'crypt'").first();
    const m = await db.prepare('SELECT COALESCE(MAX(rev), 0) AS rev, COUNT(*) AS n FROM items').first();
    return json({ crypt: r ? JSON.parse(r.v) : null, rev: m.rev, n: m.n });
  }
  if (p === '/sync/init' && req.method === 'POST') {
    const b = await req.json();
    if (!b || !b.crypt || !b.crypt.salt || !b.crypt.check) return json({ message: 'Ungültig' }, 400);
    await db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('crypt', ?)").bind(JSON.stringify(b.crypt)).run();
    const r = await db.prepare("SELECT v FROM meta WHERE k = 'crypt'").first();
    return json({ crypt: JSON.parse(r.v) });
  }
  if (p === '/sync/reset' && req.method === 'POST') {
    await db.batch([db.prepare('DELETE FROM items'), db.prepare('DELETE FROM meta')]);
    return json({ ok: true });
  }
  if (p === '/sync/pull' && req.method === 'GET') {
    const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
    const res = await db.prepare('SELECT k, v, rev FROM items WHERE rev > ? ORDER BY rev LIMIT 300').bind(since).all();
    const rows = res.results || [];
    return json({ rows, more: rows.length === 300 });
  }
  if (p === '/sync/push' && req.method === 'POST') {
    const b = await req.json();
    const rows = (b && Array.isArray(b.rows)) ? b.rows.slice(0, 100) : [];
    if (!rows.length) return json({ rev: 0 });
    const at = new Date().toISOString();
    const st = db.prepare('INSERT INTO items (k, v, rev, at) VALUES (?, ?, (SELECT COALESCE(MAX(rev), 0) + 1 FROM items), ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = excluded.rev, at = excluded.at');
    await db.batch(rows.filter(r => typeof r.k === 'string' && r.k.length < 200).map(r => st.bind(r.k, typeof r.v === 'string' ? r.v : null, at)));
    const m = await db.prepare('SELECT COALESCE(MAX(rev), 0) AS rev FROM items').first();
    return json({ rev: m.rev });
  }
  return json({ message: 'Nicht erlaubt' }, 403);
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Fixora-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.FIXORA_TOKEN || req.headers.get('X-Fixora-Token') !== env.FIXORA_TOKEN) return json({ fixora: 'token', message: 'Fixora-Passwort passt nicht' }, 401);
    const url = new URL(req.url);
    if (url.pathname.startsWith('/sync/')) {
      try { return await sync(req, env, url, json); } catch (e) { return json({ fixora: 'sync', message: String(e && e.message || e) }, 500); }
    }
    if (!env.LEX_KEY) return json({ fixora: 'key', message: 'LEX_KEY fehlt im Worker' }, 500);
    const ok = (req.method === 'GET' || req.method === 'POST') ? ALLOWED.some(r => r.test(url.pathname)) : req.method === 'PUT' ? ALLOWED_PUT.some(r => r.test(url.pathname)) : false;
    if (!ok) return json({ message: 'Nicht erlaubt' }, 403);
    const isFile = /^\/v1\/files\//.test(url.pathname);
    const headers = { 'Authorization': 'Bearer ' + env.LEX_KEY, 'Accept': isFile ? 'application/pdf' : 'application/json' };
    const hasBody = req.method === 'POST' || req.method === 'PUT';
    if (hasBody) headers['Content-Type'] = 'application/json';
    const res = await fetch('https://api.lexware.io' + url.pathname + url.search, { method: req.method, headers: headers, body: hasBody ? await req.text() : undefined });
    return new Response(await res.arrayBuffer(), { status: res.status, headers: Object.assign({ 'Content-Type': res.headers.get('Content-Type') || 'application/json' }, cors) });
  }
};
