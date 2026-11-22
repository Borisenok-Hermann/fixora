// Fixora <-> Lexware Office: kleiner Vermittler für Cloudflare Workers.
// Geheimnisse (im Worker unter "Variables and Secrets" als "Secret" anlegen):
//   LEX_KEY      = API-Schlüssel aus Lexware Office (Erweiterungen > Public API)
//   FIXORA_TOKEN = Passwort aus Fixora (Mehr > Lexware)
const ORIGIN = 'https://borisenok-hermann.github.io';
const ALLOWED = [/^\/v1\/profile$/, /^\/v1\/contacts$/, /^\/v1\/contacts\/[0-9a-f-]+$/, /^\/v1\/invoices$/, /^\/v1\/invoices\/[0-9a-f-]+$/];

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Fixora-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const json = (obj, status) => new Response(JSON.stringify(obj), { status: status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.FIXORA_TOKEN || req.headers.get('X-Fixora-Token') !== env.FIXORA_TOKEN) return json({ fixora: 'token', message: 'Fixora-Passwort passt nicht' }, 401);
    if (!env.LEX_KEY) return json({ fixora: 'key', message: 'LEX_KEY fehlt im Worker' }, 500);
    const url = new URL(req.url);
    if ((req.method !== 'GET' && req.method !== 'POST') || !ALLOWED.some(r => r.test(url.pathname))) return json({ message: 'Nicht erlaubt' }, 403);
    const headers = { 'Authorization': 'Bearer ' + env.LEX_KEY, 'Accept': 'application/json' };
    if (req.method === 'POST') headers['Content-Type'] = 'application/json';
    const res = await fetch('https://api.lexware.io' + url.pathname + url.search, { method: req.method, headers: headers, body: req.method === 'POST' ? await req.text() : undefined });
    return new Response(await res.text(), { status: res.status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
};
