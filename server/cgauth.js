/*
 * CrazyGames sign-in check (owner, Nov 2026: "check names online" so nobody can fake someone's name).
 * On their portal a signed-in player's game sends getUserToken(): a JWT signed by CrazyGames (RS256, lives 1 hour,
 * docs.crazygames.com/sdk/user). We check the signature with their public keys (a JWKS; the token's `kid` says which
 * key), that it has not run out and, when CG_GAME_ID is set (the game id under the game's name on their developer
 * portal), that it is for our game. Node's own crypto reads the keys and checks the signature: no extra libraries.
 * CG_JWKS_URL can point somewhere else (the tests serve their own keys).
 */
const crypto = require('crypto');
const JWKS_URL = process.env.CG_JWKS_URL || 'https://userportal.crazygames.com/.well-known/jwks.json';
const GAME_ID = String(process.env.CG_GAME_ID || '');
const KEEP = 60 * 60 * 1000; // the keys are fetched again after an hour
let keys = new Map(), fetchedAt = 0, loading = null, forcedAt = 0;

/** their public keys by kid (fetched once an hour, or again when a token names a key we do not have, at most once a minute) */
function loadKeys(force) {
  if (!force && keys.size && Date.now() - fetchedAt < KEEP) return Promise.resolve(keys);
  if (force) { if (Date.now() - forcedAt < 60000) return Promise.resolve(keys); forcedAt = Date.now(); }
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
      const j = await r.json(), next = new Map();
      for (const k of (j && Array.isArray(j.keys) ? j.keys : [])) {
        try { next.set(String(k.kid || ''), crypto.createPublicKey({ key: k, format: 'jwk' })); } catch (e) { /* not an RSA key we can read */ }
      }
      if (next.size) { keys = next; fetchedAt = Date.now(); }
    } catch (e) { console.warn('CrazyGames keys could not be fetched:', e && e.message); }
    loading = null;
    return keys;
  })();
  return loading;
}

const part = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** a token from their getUserToken(): { id, username } when it is real, not run out and for our game; null otherwise */
async function verify(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const bits = token.split('.');
  if (bits.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(part(bits[0]).toString('utf8')); body = JSON.parse(part(bits[1]).toString('utf8')); } catch (e) { return null; }
  if (!head || head.alg !== 'RS256' || !body || typeof body !== 'object') return null;
  const kid = String(head.kid || '');
  let ks = await loadKeys(false), key = ks.get(kid);
  if (!key) { ks = await loadKeys(true); key = ks.get(kid); }
  if (!key) return null;
  let ok = false;
  try { ok = crypto.verify('RSA-SHA256', Buffer.from(bits[0] + '.' + bits[1]), key, part(bits[2])); } catch (e) { ok = false; }
  if (!ok) return null;
  const now = Date.now() / 1000;
  if (typeof body.exp !== 'number' || body.exp < now - 30) return null; // run out (30s for clocks that differ a little)
  if (GAME_ID && String(body.gameId) !== GAME_ID) return null; // a token for another game
  if (typeof body.userId !== 'string' || !body.userId || typeof body.username !== 'string' || !body.username) return null;
  return { id: body.userId.slice(0, 64), username: body.username.slice(0, 40) };
}

module.exports = { verify, loadKeys, checksGame: () => !!GAME_ID };
