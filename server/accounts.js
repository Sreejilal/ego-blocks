/*
 * Optional accounts: a username and a password, nothing else (no email, no real names).
 * Passwords are stored as scrypt hashes with a salt, sign-in tokens only as SHA-256 hashes.
 * Progress is the game's own save, kept on the server. Friends see a profile card made from it,
 * never the whole save. Everything lives in one JSON file in DATA_DIR (default server/data).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'accounts.json');
const MAX_SAVE = 120 * 1024, MAX_FRIENDS = 100, TOKEN_DAYS = 90;
// names nobody should be able to take (a short list; chat has the full filter)
const BLOCKED = ['ADMIN', 'MOD', 'SCORZ', 'OWNER', 'SUPPORT', 'FUCK', 'SHIT', 'BITCH', 'CUNT', 'DICK', 'PUSSY', 'NIGG', 'FAG', 'SLUT', 'WHORE', 'RAPE', 'NAZI', 'HITLER', 'PENIS', 'VAGINA', 'SEX', 'PORN'];

let db = { users: {} }, dirty = false;
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!db.users) db.users = {}; } catch (e) { /* first run */ }
function flush() {
  if (!dirty) return; dirty = false;
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error('could not save accounts:', e.message); dirty = true; }
}
setInterval(flush, 2000).unref();
process.on('exit', flush);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { flush(); process.exit(0); }); // hosts send these when they restart the server
const touch = () => { dirty = true; };

const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const now = () => Date.now();

/** usernames: 3 to 12 letters and numbers, no rude or official-looking names */
function nameError(user) {
  if (!/^[A-Z0-9]{3,12}$/.test(user)) return 'NAMES ARE 3 TO 12 LETTERS AND NUMBERS';
  if (BLOCKED.some((w) => user.includes(w))) return 'PICK A DIFFERENT NAME';
  return null;
}
const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function issueToken(u) {
  const token = crypto.randomBytes(32).toString('hex');
  u.tokens = (u.tokens || []).filter((t) => t.exp > now()).slice(-4);
  u.tokens.push({ h: hashToken(token), exp: now() + TOKEN_DAYS * 864e5 });
  touch();
  return token;
}

const A = {
  register(user, pass) {
    user = clean(user);
    const err = nameError(user); if (err) return { error: err };
    if (String(pass || '').length < 6) return { error: 'PASSWORDS NEED 6 OR MORE CHARACTERS' };
    if (db.users[user]) return { error: 'THAT NAME IS TAKEN' };
    const salt = crypto.randomBytes(16).toString('hex');
    const u = db.users[user] = { user, salt, pass: hashPass(pass, salt), created: now(), save: null, friends: [], requests: [], tokens: [] };
    return { user, token: issueToken(u) };
  },
  login(user, pass) {
    const u = db.users[clean(user)];
    if (!u || !crypto.timingSafeEqual(Buffer.from(hashPass(pass, u.salt), 'hex'), Buffer.from(u.pass, 'hex'))) return { error: 'WRONG NAME OR PASSWORD' };
    return { user: u.user, token: issueToken(u) };
  },
  /** the account a sign-in token belongs to */
  byToken(token) {
    if (!token) return null;
    const h = hashToken(token);
    for (const u of Object.values(db.users)) if ((u.tokens || []).some((t) => t.h === h && t.exp > now())) return u;
    return null;
  },
  logout(u, token) { u.tokens = (u.tokens || []).filter((t) => t.h !== hashToken(token)); touch(); },
  setSave(u, save) {
    const s = JSON.stringify(save);
    if (s.length > MAX_SAVE) return { error: 'SAVE TOO BIG' };
    u.save = save; u.saved = now(); touch();
    return { ok: true };
  },
  /** what friends may see: the profile card, never the whole save */
  card(u) {
    const d = u.save || {};
    return { user: u.user, xp: d.xp || 0, rp: d.rp || 0, style: d.style || 'ROOKIE', flow: d.flow || null, look: d.look || {}, club: d.club || 'ROVERS',
      best: d.best || {}, stats: d.stats || {}, history: Array.isArray(d.history) ? d.history.slice(-5) : [] };
  },
  get(user) { return db.users[clean(user)] || null; },
  /** ask to be friends; if they already asked you, you are friends now */
  addFriend(u, other) {
    const o = db.users[clean(other)];
    if (!o || o === u) return { error: 'NO PLAYER WITH THAT NAME' };
    if (u.friends.includes(o.user)) return { ok: true, already: true };
    if (u.friends.length >= MAX_FRIENDS) return { error: 'YOUR FRIEND LIST IS FULL' };
    if (u.requests.includes(o.user)) { this.accept(u, o.user); return { ok: true, friends: true }; }
    if (!o.requests.includes(u.user)) o.requests.push(u.user);
    touch();
    return { ok: true, sent: true };
  },
  accept(u, other) {
    const o = db.users[clean(other)];
    if (!o || !u.requests.includes(o.user)) return { error: 'NO REQUEST FROM THAT PLAYER' };
    u.requests = u.requests.filter((r) => r !== o.user);
    if (!u.friends.includes(o.user)) u.friends.push(o.user);
    if (!o.friends.includes(u.user)) o.friends.push(u.user);
    o.requests = o.requests.filter((r) => r !== u.user);
    touch(); return { ok: true };
  },
  decline(u, other) { u.requests = u.requests.filter((r) => r !== clean(other)); touch(); return { ok: true }; },
  remove(u, other) {
    const o = db.users[clean(other)];
    u.friends = u.friends.filter((f) => f !== clean(other));
    if (o) o.friends = o.friends.filter((f) => f !== u.user);
    touch(); return { ok: true };
  },
  flush,
};
module.exports = A;
