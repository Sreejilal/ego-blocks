/*
 * Chat filter, run on the server so nobody can skip it. Masks swear words and slurs (also when written
 * with numbers or symbols, stretched out, or spelled with spaces), and removes links, emails, @names and
 * phone numbers, so nobody can pull younger players somewhere else or share personal details.
 */
// word roots; a word containing one is masked
const ROOTS = ['fuck', 'fuk', 'fck', 'shit', 'sht', 'bitch', 'btch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'arsehole', 'bastard', 'slut', 'whore',
  'fag', 'nigg', 'nigr', 'retard', 'rape', 'porn', 'sex', 'penis', 'vagina', 'boob', 'tits', 'wank', 'twat', 'piss', 'kys', 'stfu', 'nazi', 'hitler', 'nude', 'naked'];
const PHRASES = ['killyourself', 'killurself', 'gokillyourself', 'kill your self'];
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

// lower case, numbers-for-letters undone, repeated letters squeezed ("fuuuck" -> "fuck")
const norm = (w) => w.toLowerCase().split('').map((c) => LEET[c] || c).join('').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
// ordinary words that happen to contain a root
const ALLOW = ['grape', 'drape', 'scrape', 'trapeze', 'skyscraper', 'cockpit', 'peacock', 'hancock', 'essex', 'sussex', 'middlesex', 'sextet', 'scunthorpe', 'dickens', 'penistone', 'shitake'];
const ROOTS_N = ROOTS.map(norm), PHRASES_N = PHRASES.map(norm), ALLOW_N = ALLOW.map(norm); // the lists go through the same squeeze as the messages
const bad = (w) => {
  let n = norm(w);
  for (const a of ALLOW_N) n = n.split(a).join('_');
  return n.length > 1 && (ROOTS_N.some((r) => n.includes(r)) || PHRASES_N.some((p) => n.includes(p)));
};
const mask = (w) => w.replace(/[^\s]/g, '*');

function clean(input) {
  let text = String(input || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80).trim();
  let removed = false;
  // nothing that leads somewhere else or gives away who someone is
  const before = text;
  text = text.replace(/\b(https?:\/\/|www\.)\S+/gi, '[LINK REMOVED]')
    .replace(/\b\S+\.(com|net|org|io|gg|ly|me|xyz|tv|app|co|uk|in)\b\S*/gi, '[LINK REMOVED]')
    .replace(/\S+@\S+/g, '[REMOVED]').replace(/@\w+/g, '[REMOVED]')
    .replace(/(\d[\s-]?){7,}/g, '[NUMBER REMOVED] ');
  if (text !== before) removed = true;
  // swear words, one word at a time and with spaced-out letters joined up ("f u c k")
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    if (/^\s+$/.test(words[i])) continue;
    if (bad(words[i])) { words[i] = mask(words[i]); removed = true; continue; }
    // a run of single letters: check them joined
    let j = i, run = '';
    while (j < words.length && (/^\s+$/.test(words[j]) || norm(words[j]).length <= 1)) { if (!/^\s+$/.test(words[j])) run += words[j]; j++; }
    if (run.length >= 3 && bad(run)) { for (let k = i; k < j; k++) if (!/^\s+$/.test(words[k])) words[k] = mask(words[k]); removed = true; i = j - 1; }
  }
  // the whole message squeezed together, to catch splits like "fu ck"
  text = words.join('');
  if (bad(text.replace(/\s+/g, '')) && !removed) { text = mask(text); removed = true; }
  return { text: text.toUpperCase(), changed: removed };
}
module.exports = { clean };
