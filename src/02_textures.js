/* =====================================================================
   Pixel art: tiny bitmap font, canvas block textures, player skins,
   voxel ball geometry and UI icons. Everything is generated here.
   ===================================================================== */
const PF5 = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 17, 31, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], '?': [14, 17, 1, 2, 4, 0, 4], '!': [4, 4, 4, 4, 4, 0, 4],
  '.': [0, 0, 0, 0, 0, 12, 12], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};
function pfDraw(g, text, x, y, s, color, spacing = 1) {
  g.fillStyle = color;
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const gl = PF5[ch] || PF5['?'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r] & (16 >> c)) g.fillRect(cx + c * s, y + r * s, s, s);
    cx += (5 + spacing) * s;
  }
}
const pfWidth = (text, s, spacing = 1) => (String(text).length ? (String(text).length * (5 + spacing) - spacing) * s : 0);
const DIG3 = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7]];
function digDraw(g, str, x, y, color) {
  g.fillStyle = color;
  let cx = x;
  for (const ch of String(str)) {
    const d = DIG3[+ch] || DIG3[0];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (d[r] & (4 >> c)) g.fillRect(cx + c, y + r, 1, 1);
    cx += 4;
  }
}

function hexRGB(hex) { const c = new THREE.Color(hex); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; }
function hexLum(hex) { const c = hexRGB(hex); return (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255; }
function rgbStr(rgb) { return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }
function shadeRGB(rgb, k) { return [clamp(Math.round(rgb[0] * k), 0, 255), clamp(Math.round(rgb[1] * k), 0, 255), clamp(Math.round(rgb[2] * k), 0, 255)]; }
function mixRGB(a, b, t) { return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

const Tex = {
  aniso: 1,
  fromCanvas(c, o = {}) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.magFilter = THREE.NearestFilter;
    if (o.mip) { t.minFilter = THREE.NearestMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Tex.aniso; }
    else { t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.needsUpdate = true;
    return t;
  },
  /** fill a canvas from a per-pixel function returning [r,g,b] or [r,g,b,a] */
  pixels(w, h, fn, o = {}) {
    const c = mkCanvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn(x, y); const i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col.length > 3 ? col[3] : 255;
    }
    g.putImageData(img, 0, 0);
    return o.canvasOnly ? c : this.fromCanvas(c, o);
  },
};

/* ---------- block texture library (16x16 tiles, repeat-wrapped) ---------- */
const seatPix = (base, R) => (x, y) => shadeRGB(base, ((x + y) % 4 === 0 ? 0.92 : 1) * lerp(0.9, 1.06, R()) * (y < 3 ? 0.78 : 1) * (y > 13 ? 0.85 : 1));
/** recolour a stand's seat texture in place (each match dresses the stands in the clubs' colours) */
function repaintSeat(tex, hex) {
  const c = tex.image, g = c.getContext('2d'), img = g.createImageData(16, 16), f = seatPix(hexRGB(hex), mulberry32(31));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = f(x, y), i = (y * 16 + x) * 4; img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); tex.needsUpdate = true;
}
function makeBlockTextures() {
  const T = {};
  const R = mulberry32(1337);
  const n = (a = 0.9, b = 1.08) => lerp(a, b, R());
  const grassPal = [hexRGB('#5aa83f'), hexRGB('#4f9a37'), hexRGB('#66b548'), hexRGB('#47892f')];
  T.grassTop = Tex.pixels(16, 16, () => shadeRGB(grassPal[Math.floor(R() * 4)], n(0.88, 1.06)), { repeat: true, mip: true });
  const dirt = [hexRGB('#7a5233'), hexRGB('#6b4429'), hexRGB('#8a6040'), hexRGB('#5d3a22')];
  const fringe = []; for (let x = 0; x < 16; x++) fringe.push(3 + (R() < 0.45 ? 1 : 0) + (R() < 0.15 ? 1 : 0));
  T.grassSide = Tex.pixels(16, 16, (x, y) => {
    if (y < fringe[x]) return shadeRGB(grassPal[Math.floor(R() * 4)], n(0.85, 1.02));
    return shadeRGB(dirt[Math.floor(R() * 4)], n(0.85, 1.05));
  }, { repeat: true, mip: true });
  T.dirt = Tex.pixels(16, 16, () => shadeRGB(dirt[Math.floor(R() * 4)], n(0.85, 1.05)), { repeat: true, mip: true });
  const brick = hexRGB('#8c8f99'), mortar = hexRGB('#4f525c');
  T.stoneBrick = Tex.pixels(16, 16, (x, y) => {
    const row = y < 8 ? 0 : 1;
    const isM = y === 7 || y === 15 || (row === 0 ? (x === 7 || x === 15) : (x === 3 || x === 11));
    if (isM) return shadeRGB(mortar, n(0.85, 1.1));
    const hl = (y === 0 || y === 8) ? 1.12 : 1;
    return shadeRGB(brick, n(0.86, 1.04) * hl);
  }, { repeat: true, mip: true });
  const darkStone = hexRGB('#2a3156');
  T.towerStone = Tex.pixels(16, 16, (x, y) => {
    const isM = y === 7 || y === 15 || (y < 8 ? (x === 7 || x === 15) : (x === 3 || x === 11));
    return isM ? shadeRGB(darkStone, 0.6) : shadeRGB(darkStone, n(0.85, 1.1));
  }, { repeat: true, mip: true });
  T.seatHome = Tex.pixels(16, 16, seatPix(hexRGB('#2f62d8'), R), { repeat: true, mip: true });
  T.seatAway = Tex.pixels(16, 16, seatPix(hexRGB('#ec7424'), R), { repeat: true, mip: true });
  const white = hexRGB('#eef1f4');
  T.white = Tex.pixels(16, 16, (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    return shadeRGB(white, n(0.93, 1.0) * (edge ? 0.86 : 1));
  }, { repeat: true, mip: true });
  T.net = Tex.pixels(16, 16, (x, y) => ((x % 4 === 0 || y % 4 === 0) ? [238, 240, 244, 255] : [0, 0, 0, 0]), { repeat: true });
  const iron = hexRGB('#b8bec9');
  T.iron = Tex.pixels(16, 16, (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    const rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
    if (rivet) return shadeRGB(iron, 1.25);
    return shadeRGB(iron, n(0.92, 1.02) * (edge ? 0.7 : 1));
  }, { repeat: true, mip: true });
  const lamp = hexRGB('#fff4cc');
  T.lamp = Tex.pixels(16, 16, (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    const cell = (x % 5 === 0 || y % 5 === 0);
    return edge ? hexRGB('#8c8a7a') : shadeRGB(lamp, cell ? 0.86 : n(0.97, 1.05));
  }, { repeat: true });
  const bark = hexRGB('#6b4a2b');
  T.log = Tex.pixels(16, 16, (x) => shadeRGB(bark, (x % 4 === 0 ? 0.72 : 1) * n(0.85, 1.08)), { repeat: true, mip: true });
  const leaf = [hexRGB('#3c8a35'), hexRGB('#2f7329'), hexRGB('#4a9c40'), hexRGB('#25611f')];
  T.leaves = Tex.pixels(16, 16, () => shadeRGB(leaf[Math.floor(R() * 4)], n(0.8, 1.05)), { repeat: true, mip: true });
  // tower: 4x4 block glass panel with a scatter of lit windows
  const glassA = hexRGB('#16307e'), glassB = hexRGB('#1d3fa0'), frame = hexRGB('#4c7bff'), lit = hexRGB('#bfe8ff');
  const litMap = []; for (let i = 0; i < 16; i++) litMap.push(R() < 0.34);
  const towerPix = (x, y, emissive) => {
    const bx = x >> 4, by = y >> 4, lx = x & 15, ly = y & 15;
    const edge = lx === 0 || ly === 0 || lx === 15 || ly === 15;
    const win = lx >= 3 && lx <= 12 && ly >= 3 && ly <= 12 && litMap[by * 4 + bx];
    if (emissive) {
      if (win) return shadeRGB(lit, (lx + ly) % 7 === 0 ? 0.8 : 1);
      if (edge) return [24, 50, 120];
      return [0, 0, 0];
    }
    if (win) return shadeRGB(lit, 0.9);
    if (edge) return shadeRGB(frame, 0.9);
    return shadeRGB((lx + ly) % 9 === 0 ? glassB : glassA, n(0.92, 1.08));
  };
  T.towerGlass = Tex.pixels(64, 64, (x, y) => towerPix(x, y, false), { repeat: true, mip: true });
  T.towerGlow = Tex.pixels(64, 64, (x, y) => towerPix(x, y, true), { repeat: true, mip: true });
  const gold = hexRGB('#ffc93d');
  const qc = mkCanvas(16, 16), qg = qc.getContext('2d');
  qg.fillStyle = rgbStr(gold); qg.fillRect(0, 0, 16, 16);
  qg.fillStyle = rgbStr(shadeRGB(gold, 0.62)); qg.fillRect(0, 15, 16, 1); qg.fillRect(15, 0, 1, 16);
  qg.fillStyle = rgbStr(shadeRGB(gold, 1.2)); qg.fillRect(0, 0, 16, 1); qg.fillRect(0, 0, 1, 16);
  pfDraw(qg, '?', 3, 1, 2, '#6a3c00'); pfDraw(qg, '?', 2, 0, 2, '#fff7d6');
  T.itemBox = Tex.fromCanvas(qc);
  const bc = mkCanvas(32, 32), bg = bc.getContext('2d');
  bg.fillStyle = '#d23a2c'; bg.fillRect(0, 0, 32, 32);
  bg.fillStyle = '#a62519'; for (let x = 0; x < 32; x += 4) bg.fillRect(x, 0, 1, 32);
  bg.fillStyle = '#f2efe6'; bg.fillRect(0, 11, 32, 10);
  pfDraw(bg, 'BOOM', 4, 13, 1, '#1a1a1a');
  T.boom = Tex.fromCanvas(bc);
  T.slime = Tex.pixels(16, 16, (x, y) => {
    const b = ((x * 7 + y * 13) % 11 === 0);
    return b ? [170, 255, 150, 255] : shadeRGB(hexRGB('#4cd13f'), n(0.85, 1.05)).concat([255]);
  }, { repeat: true });
  T.ice = Tex.pixels(16, 16, (x, y) => {
    const streak = (x + y) % 6 === 0;
    return streak ? [240, 252, 255] : shadeRGB(hexRGB('#9fe4ff'), n(0.9, 1.05));
  });
  // advertising boards: 8 original brands
  const brands = [['SCORZ', '#1a3c9e', '#ffffff'], ['VOXEL COLA', '#c42a2a', '#fff3c9'], ['CUBE AIR', '#f2efe6', '#1a3c9e'], ['EMERALD BANK', '#0e7a48', '#d9ffe9'],
    ['BLOCKBALL', '#ffcb3d', '#2b1b00'], ['PIXEL FUEL', '#1d1f2e', '#ff8a2a'], ['STRIKER 9', '#3d7dff', '#ffffff'], ['GRASS MAX', '#2a6b2a', '#eaffd1']];
  const ac = mkCanvas(128 * brands.length, 16), ag = ac.getContext('2d');
  brands.forEach((b, i) => {
    ag.fillStyle = b[1]; ag.fillRect(i * 128, 0, 128, 16);
    ag.fillStyle = 'rgba(0,0,0,.25)'; ag.fillRect(i * 128, 14, 128, 2);
    const w = pfWidth(b[0], 1); pfDraw(ag, b[0], i * 128 + Math.floor((128 - w) / 2), 4, 1, b[2]);
  });
  T.ads = Tex.fromCanvas(ac, { repeat: true, mip: true });
  T.metalDark = Tex.pixels(16, 16, (x, y) => shadeRGB(hexRGB('#34384a'), n(0.85, 1.1) * ((x === 0 || y === 0) ? 1.2 : 1)), { repeat: true, mip: true });
  // pixel glow sprite (stepped squares)
  T.glow = Tex.pixels(32, 32, (x, y) => {
    const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
    const step = Math.floor(d / 4);
    const a = clamp(1 - step / 4, 0, 1);
    return [255, 255, 255, Math.round(a * a * 255)];
  });
  return T;
}

/* ---------- pitch texture: 16px per block, mowed stripes, half-block pixel lines ---------- */
const PITCH_BX = 49, PITCH_BZ = 75; // blocks across (x) and along (z), including run-off
function pitchLineAt(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), hw = 0.25;
  if (ax > F.W || az > F.L) return false;
  if (ax >= F.W - 0.5 || az >= F.L - 0.5 || az <= hw) return true;
  const r = Math.hypot(x, z);
  if (Math.abs(r - 6) <= hw || r <= 0.42) return true;
  const bz = F.L - az;
  if (bz <= F.BOX_D && ax >= F.BOX_W - 0.5 && ax <= F.BOX_W) return true;
  if (bz >= F.BOX_D - 0.5 && bz <= F.BOX_D && ax <= F.BOX_W) return true;
  if (bz <= 3.0 && ax >= 5.0 && ax <= 5.5) return true;
  if (bz >= 2.5 && bz <= 3.0 && ax <= 5.5) return true;
  const dr = Math.hypot(x, az - (F.L - 5.5));
  if (dr <= 0.32) return true;
  if (bz > F.BOX_D && Math.abs(dr - 4) <= hw) return true;
  if (Math.abs(Math.hypot(ax - F.W, az - F.L) - 1.0) <= hw) return true;
  return false;
}
function makePitchTexture() {
  const S = 16, w = PITCH_BX * S, h = PITCH_BZ * S;
  const c = mkCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  const R = mulberry32(99);
  const A = [hexRGB('#69bd4a'), hexRGB('#5fb243'), hexRGB('#74c853'), hexRGB('#58a83c')];
  const B = [hexRGB('#529f39'), hexRGB('#4a9433'), hexRGB('#5aa83f'), hexRGB('#438a2e')];
  const RUN = [hexRGB('#447f30'), hexRGB('#3e772b'), hexRGB('#4a8835'), hexRGB('#386d27')];
  const LN = hexRGB('#f1f4ec');
  for (let bz = 0; bz < PITCH_BZ; bz++) for (let bx = 0; bx < PITCH_BX; bx++) {
    const wx = bx - 24, wz = bz - 37;
    const inField = Math.abs(wx) <= 20 && Math.abs(wz) <= 32;
    const pal = !inField ? RUN : ((Math.floor((wz + 32) / 4)) % 2 === 0 ? A : B);
    const blockK = lerp(0.95, 1.04, R());
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = wx - 0.5 + (px + 0.5) / S, z = wz - 0.5 + (py + 0.5) / S;
      const r = R();
      let col;
      if (pitchLineAt(x, z)) col = shadeRGB(LN, lerp(0.9, 1.0, R()) * (r < 0.05 ? 0.88 : 1));
      else {
        col = pal[r < 0.5 ? 0 : r < 0.75 ? 1 : r < 0.9 ? 2 : 3];
        col = shadeRGB(col, blockK * lerp(0.94, 1.04, R()));
        if (px === 0 || py === 0) col = shadeRGB(col, 0.95);
      }
      const i = ((bz * S + py) * w + (bx * S + px)) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return Tex.fromCanvas(c, { mip: true });
}

/* ---------- player skin atlas (64x64, Minecraft-style layout) ---------- */
const ATLAS = {
  head: { py: [8, 0, 8, 8], ny: [16, 0, 8, 8], nx: [0, 8, 8, 8], pz: [8, 8, 8, 8], px: [16, 8, 8, 8], nz: [24, 8, 8, 8] },
  body: { py: [20, 16, 8, 4], ny: [28, 16, 8, 4], nx: [16, 20, 4, 12], pz: [20, 20, 8, 12], px: [28, 20, 4, 12], nz: [32, 20, 8, 12] },
  arm: { py: [44, 16, 4, 4], ny: [48, 16, 4, 4], nx: [40, 20, 4, 12], pz: [44, 20, 4, 12], px: [48, 20, 4, 12], nz: [52, 20, 4, 12] },
  leg: { py: [4, 16, 4, 4], ny: [8, 16, 4, 4], nx: [0, 20, 4, 12], pz: [4, 20, 4, 12], px: [8, 20, 4, 12], nz: [12, 20, 4, 12] },
};
/** BoxGeometry with faces mapped into a square atlas of size S */
function boxAtlas(w, h, d, rects, S = 64) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const e = 0.02;
  for (let f = 0; f < 6; f++) {
    const r = rects[order[f]];
    const x = r[0] + e, y = r[1] + e, rw = r[2] - 2 * e, rh = r[3] - 2 * e;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const u0 = uv.getX(i), v0 = uv.getY(i);
      uv.setXY(i, (x + u0 * rw) / S, 1 - (y + rh) / S + v0 * rh / S);
    }
  }
  uv.needsUpdate = true;
  return geo;
}
function makePlayerSkin(o) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  const R = mulberry32(o.seed || 1);
  const fillN = (x, y, w, h, hex, a = 0.9, b = 1.06) => {
    const base = hexRGB(hex);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { g.fillStyle = rgbStr(shadeRGB(base, lerp(a, b, R()))); g.fillRect(x + xx, y + yy, 1, 1); }
  };
  const px = (x, y, hex) => { g.fillStyle = hex; g.fillRect(x, y, 1, 1); };
  const { kit: K, crest, boots, skin, hair, number, gloves, eye, sparkle } = o;
  // head
  fillN(8, 0, 8, 8, hair, 0.82, 1.08);                       // top
  fillN(16, 0, 8, 8, skin, 0.92, 1.0);                       // bottom (chin)
  for (const sx of [0, 16]) { fillN(sx, 8, 8, 8, skin, 0.95, 1.02); fillN(sx, 8, 8, 3, hair, 0.8, 1.05); px(sx + (sx === 0 ? 3 : 4), 12, rgbStr(shadeRGB(hexRGB(skin), 0.85))); }
  fillN(24, 8, 8, 8, hair, 0.8, 1.05); fillN(24, 14, 8, 2, skin, 0.9, 0.98); // back
  fillN(8, 8, 8, 8, skin, 0.96, 1.03);                       // face
  fillN(8, 8, 8, 1, hair, 0.8, 1.05);
  for (let x = 0; x < 8; x++) if (R() < 0.55 || x === 0 || x === 7) px(8 + x, 9, rgbStr(shadeRGB(hexRGB(hair), lerp(0.8, 1, R()))));
  const brow = rgbStr(shadeRGB(hexRGB(hair), 0.65));
  px(9, 11, brow); px(10, 11, brow); px(13, 11, brow); px(14, 11, brow);
  px(9, 12, '#f7f7f2'); px(10, 12, eye); px(13, 12, eye); px(14, 12, '#f7f7f2');
  px(11, 14, rgbStr(shadeRGB(hexRGB(skin), 0.62))); px(12, 14, rgbStr(shadeRGB(hexRGB(skin), 0.62)));
  // shirt: the strip x 16..39, rows 20..29 wraps round the body (left side, front, right side, back)
  const shirt = hexRGB(K.shirt), alt = hexRGB(K.alt);
  const onAlt = (x, y) => {
    const r = y - 20;
    switch (K.pattern) {
      case 'stripes': return ((x - 16) >> 1) % 2 === 1;
      case 'hoops': return (r >> 1) % 2 === 1;
      case 'halves': return x >= 24 && x <= 35; // the +x half: right of the front, the right side, left of the back
      case 'sash': // shoulder to hip across the front, hip to shoulder across the back
        if (x >= 20 && x <= 27) return Math.abs(x - 20 - r * 0.75 - 0.4) < 1.3;
        if (x >= 32) return Math.abs(x - 32 - (7 - r * 0.75) + 0.4) < 1.3;
        return x >= 28 ? r >= 8 : r <= 1;
      default: return x === 16 || x === 31; // plain: thin side panels
    }
  };
  for (let y = 20; y < 30; y++) for (let x = 16; x < 40; x++) { g.fillStyle = rgbStr(shadeRGB(onAlt(x, y) ? alt : shirt, lerp(0.9, 1.06, R()))); g.fillRect(x, y, 1, 1); }
  fillN(20, 16, 8, 4, K.shirt); fillN(22, 17, 4, 2, K.collar); // shoulders, collar ring under the head
  fillN(28, 16, 8, 4, K.shorts);
  for (const [x, w] of [[16, 4], [20, 8], [28, 4], [32, 8]]) fillN(x, 30, w, 2, K.shorts);
  g.fillStyle = K.collar; g.fillRect(22, 20, 4, 1); g.fillRect(23, 21, 2, 1); g.fillRect(34, 20, 4, 1);
  // crest on the left chest, small number on the right, big number on the back (on a plain panel over stripes and hoops)
  const cr = crest || ['#ffffff', '#000000'];
  g.fillStyle = K.number; g.fillRect(21, 22, 3, 2); g.fillRect(22, 24, 1, 1);
  g.fillStyle = cr[0] === K.number ? cr[1] : cr[0]; g.fillRect(22, 22, 1, 2);
  const num = String(number), panel = K.pattern === 'stripes' || K.pattern === 'hoops';
  const bx = 32 + Math.floor((8 - (num.length * 4 - 1)) / 2);
  if (panel) { fillN(bx - 1, 21, num.length * 4 + 1, 7, K.shirt, 0.95, 1.02); if (num.length === 1) fillN(24, 21, 4, 7, K.shirt, 0.95, 1.02); }
  digDraw(g, num, bx, 22, K.number);
  if (num.length === 1) digDraw(g, num, 25, 22, K.number); else { g.fillStyle = K.number; g.fillRect(25, 23, 2, 1); }
  // arms: sleeve, cuff, then skin or gloves
  fillN(44, 16, 4, 4, K.sleeve); fillN(48, 16, 4, 4, gloves || skin);
  for (let s = 0; s < 4; s++) { fillN(40 + s * 4, 20, 4, 4, K.sleeve); fillN(40 + s * 4, 24, 4, 1, K.cuff, 0.95, 1.02); fillN(40 + s * 4, 25, 4, 7, skin, 0.94, 1.02); if (gloves) fillN(40 + s * 4, 29, 4, 3, gloves); }
  // legs: shorts with a side stripe, socks with a band, boots
  fillN(4, 16, 4, 4, K.shorts);
  for (let s = 0; s < 4; s++) { fillN(s * 4, 20, 4, 4, K.shorts); fillN(s * 4, 24, 4, 6, K.socks); g.fillStyle = K.sockTrim; g.fillRect(s * 4, 25, 4, 1); fillN(s * 4, 30, 4, 2, boots, 0.85, 1.1); }
  g.fillStyle = K.shortsTrim; g.fillRect(1, 20, 1, 4); g.fillRect(10, 20, 1, 4);
  if (sparkle) for (let s = 0; s < 4; s++) { px(s * 4 + (s % 2), 30, '#ffffff'); px(s * 4 + 2 + (s % 2), 31, '#ffe9a8'); }
  fillN(8, 16, 4, 4, boots, 0.7, 0.85); // boot soles
  return Tex.fromCanvas(c);
}
function makePrismTexture() {
  const cols = ['#ff4d5e', '#ff9a3c', '#ffcb3d', '#2ee38f', '#4aa8ff', '#b65cff'].map(hexRGB);
  return Tex.pixels(12, 8, (x, y) => shadeRGB(cols[Math.floor((x + y) / 2) % 6], y === 0 ? 1.1 : 0.95), { repeat: true });
}
function makeHairTexture(hex, seed) {
  const R = mulberry32(seed);
  const base = hexRGB(hex);
  return Tex.pixels(8, 8, (x, y) => shadeRGB(base, lerp(0.78, 1.1, R()) * (y === 0 ? 1.1 : 1)), { repeat: true });
}

/* ---------- voxel ball: 7x7x7 shell, real sphere physics ---------- */
function makeBallGeometry() {
  const N = 7, R = BALL_R, vs = (2 * R) / N, half = (N - 1) / 2;
  const inside = (i, j, k) => {
    if (i < 0 || j < 0 || k < 0 || i >= N || j >= N || k >= N) return false;
    const x = i - half, y = j - half, z = k - half;
    return x * x + y * y + z * z <= (half + 0.62) * (half + 0.62);
  };
  const t = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((v) => new THREE.Vector3(v[0], v[1], v[2]).normalize());
  const pos = [], nor = [], col = [];
  const white = lin('#f3f3ef'), black = lin('#1b1c22');
  const faces = [
    [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
  ];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    if (!inside(i, j, k)) continue;
    const cx = (i - half), cy = (j - half), cz = (k - half);
    const dir = new THREE.Vector3(cx, cy, cz).normalize();
    let mx = -1; for (const v of ico) mx = Math.max(mx, dir.dot(v));
    const c = mx > 0.93 ? black : white;
    const jitter = 0.94 + ((i * 7 + j * 13 + k * 3) % 5) * 0.015;
    for (const [nrm, quad] of faces) {
      if (inside(i + nrm[0], j + nrm[1], k + nrm[2])) continue;
      const v = quad.map((q) => [(i + q[0] - N / 2) * vs, (j + q[1] - N / 2) * vs, (k + q[2] - N / 2) * vs]);
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        pos.push(v[idx][0], v[idx][1], v[idx][2]); nor.push(nrm[0], nrm[1], nrm[2]);
        col.push(c.r * jitter, c.g * jitter, c.b * jitter);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/* ---------- UI icons (pixel maps rendered to data URLs) ---------- */
const ICON_MAPS = {
  emerald: ['.....kk.....', '....kLLk....', '...kLlEEk...', '..kLlEEEek..', '.kLlEEEEEek.', 'kLlEEEEEEeek', 'kEEEEEEEEeek', '.kEEEEEEeek.', '..kEEEEeek..', '...kEEeek...', '....keek....', '.....kk.....'],
  drum: ['.........ww.', '........wwww', '.........ww.', '........kw..', '......kkmk..', '....kkmMMk..', '...kmMMMMk..', '..kmMMMhMk..', '..kMMMhMMk..', '..kMMMMMk...', '...kMMMk....', '....kkk.....'],
  shot: ['............', '............', '.......kkkk.', '......kwwwwk', 'AAAA.kwwkwwk', '.....kwkkkwk', 'AAA..kwwkwwk', '......kwwwwk', 'AAAA...kkkk.', '............', '............', '............'],
  dash: ['............', '............', '.AA...AA....', '..AA...AA...', '...AA...AA..', '....AA...AA.', '....AA...AA.', '...AA...AA..', '..AA...AA...', '.AA...AA....', '............', '............'],
  pass: ['............', '............', '.......A....', '.......AA...', 'AAAAAAAAAA..', 'AAAAAAAAAAA.', 'AAAAAAAAAA..', '.......AA...', '.......A....', '............', '............', '............'],
  grab: ['............', '..A.A.A.....', '..A.A.A.A...', '..A.A.A.A...', '..AAAAAAA...', 'A.AAAAAAA...', 'AAAAAAAAA...', '.AAAAAAAA...', '..AAAAAA....', '...AAAAA....', '...AAAAA....', '............'],
  buff: ['............', '......AAA...', '.....AAA....', '....AAA.....', '...AAAAAA...', '......AAA...', '.....AAA....', '....AAA.....', '...AA.......', '..A.........', '............', '............'],
  eye: ['............', '............', '....AAAA....', '..AA....AA..', '.A..wwww..A.', 'A..wwkkww..A', 'A..wwkkww..A', '.A..wwww..A.', '..AA....AA..', '....AAAA....', '............', '............'],
  fake: ['............', '....AAAA....', '...AA..AA...', '.......AA...', '......AA....', '.....AA.....', '.....AA.....', '............', '.....AA.....', '.....AA.....', '............', '............'],
  trap: ['............', '.www....www.', '.www....www.', '.AAA....AAA.', '.AAA....AAA.', '.AAA....AAA.', '.AAA....AAA.', '.AAAA..AAAA.', '..AAAAAAAA..', '...AAAAAA...', '............', '............'],
  beam: ['............', '............', '........kkk.', '.......kwwwk', 'AAAAAAAkwkwk', 'wwwwwwwkwwwk', 'AAAAAAAkwkwk', '.......kwwwk', '........kkk.', '............', '............', '............'],
  flip: ['............', '...AAAAA....', '..A.....A...', '.A.......A..', '.A.......A..', '.A......AAA.', '.A.......A..', '............', '....kkk.....', '...kwwwk....', '...kwwwk....', '....kkk.....'],
  shield: ['............', '..AAAAAAAA..', '..AwwwwwwA..', '..AwwwwwwA..', '..AwwwwwwA..', '..AwwwwwwA..', '...AwwwwA...', '...AwwwwA...', '....AwwA....', '.....AA.....', '............', '............'],
  call: ['............', '..AAAAAAAA..', '.AAAAwwAAAA.', '.AAAAwwAAAA.', '.AAAAwwAAAA.', '.AAAAwwAAAA.', '.AAAAAAAAAA.', '.AAAAwwAAAA.', '..AAAAAAAA..', '....AA......', '...AA.......', '............'],
  tackle: ['............', '............', '............', '............', '.....kkk....', '....kAAAk...', 'kkkkAAAAk...', 'kAAAAAAAk...', 'kAAAAAAAAkk.', '.kkkkkkkkkk.', 'd.d.d.d.....', '............'],
  flame: ['............', '.....A......', '....AA......', '....AAA..A..', '...AAwAA.A..', '..AAwwAAAA..', '..AwwwwAAA..', '..AwwwwwAA..', '..AAwwwAA...', '...AAAAA....', '............', '............'],
  fist: ['............', '...rrrrrr...', '..rRRRRRRr..', '..rRRhRRRr..', '..rRRRRRRr..', '..rrRRRRRr..', '...rrrrrr...', '...wwwwww...', '...wwwwww...', '............', '............', '............'],
  boom: ['............', '.kkkkkkkkkk.', '.kRRRRRRRRk.', '.kRRRRRRRRk.', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwwwwwwwwk.', '.kRRRRRRRRk.', '.kRRRRRRRRk.', '.kkkkkkkkkk.', '............', '............'],
  slime: ['............', '............', '............', '....GGGG....', '...GgggwG...', '..GgggggwG..', '..GgggggggG.', '.GgggggggggG', '.GGGGGGGGGGG', '............', '............', '............'],
  jet: ['............', '..ss....ss..', '.sggs..sggs.', '.sggs..sggs.', '.sggssssggs.', '.sggs..sggs.', '.sggs..sggs.', '..ss....ss..', '..oo....oo..', '..Oo....oO..', '...O....O...', '............'],
  snow: ['............', '............', '....wwww....', '...wwwwbw...', '..wwwwwwbw..', '..wwwwwwbw..', '..wwwwwbbw..', '...wwbbbw...', '....wwww....', '............', '............', '............'],
  magnet: ['............', '.www....www.', '.www....www.', '.RRR....RRR.', '.RRR....RRR.', '.RRR....RRR.', '.RRR....RRR.', '.RRRR..RRRR.', '..RRRRRRRR..', '...RRRRRR...', '............', '............'],
  bubble: ['............', '...cccccc...', '..c......c..', '.c..ww....c.', '.c.w......c.', '.c........c.', '.c........c.', '.c........c.', '..c......c..', '...cccccc...', '............', '............'],
  wall: ['............', '............', 'kkkkkkkkkkkk', 'kgggkgggggkk', 'kgggkgggggkk', 'kkkkkkkkkkkk', 'kgkgggggkggk', 'kgkgggggkggk', 'kkkkkkkkkkkk', '............', '............', '............'],
  mine: ['............', '............', '............', '............', '.....rr.....', '.....rr.....', '...kkkkkk...', '..kggggggk..', '.kggggggggk.', '.kkkkkkkkkk.', '............', '............'],
  bolt: ['............', '......YYY...', '.....YYY....', '....YYY.....', '...YYYYYY...', '......YYY...', '.....YYY....', '....YYY.....', '...YY.......', '..Y.........', '............', '............'],
  lock: ['............', '....kkkk....', '...k....k...', '...k....k...', '..kkkkkkkk..', '..kggggggk..', '..kggkkggk..', '..kggkkggk..', '..kggggggk..', '..kkkkkkkk..', '............', '............'],
  jump: ['............', '.....kk.....', '....kwwk....', '...kwwwwk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kkkkwwkkkk.', '....kwwk....', '....kwwk....', '....kwwk....', '....kkkk....', '............'],
  boot: ['............', '............', '............', '...kkkk.....', '...kAAk.....', '...kAAk.....', '...kAAkkkk..', '..kAAAAAAAk.', '..kAAAAAAAAk', '..kkkkkkkkkk', '...w.w.w.w..', '............'],
  glove: ['............', '....k.k.k...', '...kAkAkAk..', '...kAkAkAk..', '.k.kAAAAAk..', 'kAkkAAAAAk..', 'kAAAAAAAAk..', '.kAAAAAAAk..', '..kAAAAAk...', '..kwwwwwk...', '..kkkkkkk...', '............'],
  band: ['............', '...kkkkkk...', '..kHHHHHHk..', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kSSSSSSSSk.', '.kSwkSSkwSk.', '.kSSSSSSSSk.', '.kSSSSSSSSk.', '..kSSSSSSk..', '...kkkkkk...', '............'],
  mask: ['............', '...kkkkkk...', '..kHHHHHHk..', '.kHHHHHHHHk.', '.kSSSSSSSSk.', '.kSwkSSkwSk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '..kAAAAAAk..', '...kkkkkk...', '............'],
  chain: ['............', '.A........A.', '.A........A.', '..A......A..', '..A......A..', '...A....A...', '...A....A...', '....A..A....', '.....AA.....', '....kAAk....', '....kAAk....', '.....kk.....'],
  celeb: ['............', '..A......A..', '..A..kk..A..', '...A.kk.A...', '....AAAA....', '.....AA.....', '.....AA.....', '....A..A....', '...A....A...', '..A......A..', '............', '............'],
  pause: ['............', '............', '.kkkk..kkkk.', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kkkk..kkkk.', '............', '............'],
};
const ICON_PAL_BASE = {
  k: '#0a0c17', w: '#f5f1e6', L: '#c9ffe4', l: '#7ff5bd', E: '#2ee38f', e: '#149e5c', m: '#8a3a1c', M: '#c4622d', h: '#e89a5c', d: '#7a5233',
  r: '#7a1010', R: '#e0302a', G: '#1f7a18', g: '#9aa1ad', s: '#3a3f4f', o: '#ff8a2a', O: '#ffd23d', b: '#9fd4ff', c: '#8fd8ff', Y: '#ffd23d',
  H: '#3b2a22', S: '#e8b48a',
};
const PRISM_COLS = ['#ff4d5e', '#ff9a3c', '#ffcb3d', '#2ee38f', '#4aa8ff', '#b65cff'];
const _iconCache = new Map();
function iconURL(name, aura = '#ffffff', variant = '') {
  const key = name + '|' + aura + '|' + variant;
  if (_iconCache.has(key)) return _iconCache.get(key);
  const url = iconCanvas(name, aura, variant).toDataURL('image/png');
  _iconCache.set(key, url);
  return url;
}
/** the same pixel icon as a 48x48 canvas */
function iconCanvas(name, aura = '#ffffff', variant = '') {
  let map = ICON_MAPS[name];
  const pal = Object.assign({}, ICON_PAL_BASE, { A: aura });
  if (name === 'emerald') Object.assign(pal, { k: '#0a3d27' });
  if (name === 'drum') Object.assign(pal, { k: '#2a140a', w: '#f3ead6' });
  if (variant === 'empty' || variant === 'half') {
    map = map.map((row, y) => row.split('').map((ch, x) => {
      if (variant === 'half' && x < 7) return ch;
      if ('mMh'.includes(ch)) return 'Z';
      if (ch === 'w') return 'z';
      return ch;
    }).join(''));
    pal.Z = '#2c3150'; pal.z = '#565c80';
  }
  const S = 4, c = mkCanvas(12 * S, 12 * S), g = c.getContext('2d');
  map.forEach((row, y) => row.split('').forEach((ch, x) => {
    const fill = variant === 'prism' && ch === 'A' ? PRISM_COLS[Math.floor((x + y) / 2) % 6] : pal[ch];
    if (fill) { g.fillStyle = fill; g.fillRect(x * S, y * S, S, S); }
  }));
  return c;
}
const TIER_MATS = [
  { name: 'WOOD', a: '#a8743f', b: '#7d5229', hl: '#d29a5c', pat: 'plank' },
  { name: 'STONE', a: '#8d909a', b: '#686b75', hl: '#b7bac4', pat: 'speck' },
  { name: 'IRON', a: '#d9dde4', b: '#a9afbb', hl: '#ffffff', pat: 'shine' },
  { name: 'GOLD', a: '#ffcb3d', b: '#d99a12', hl: '#fff1b0', pat: 'shine' },
  { name: 'DIAMOND', a: '#5fe6e0', b: '#2aa8b8', hl: '#e3fffd', pat: 'gem' },
  { name: 'OBSIDIAN', a: '#2a1840', b: '#160b25', hl: '#8a5cff', pat: 'speck' },
];
function badgeURL(tier) {
  const key = 'badge' + tier;
  if (_iconCache.has(key)) return _iconCache.get(key);
  const m = TIER_MATS[tier];
  const shape = ['................', '.kkkkkkkkkkkkkk.', '.kHHHHHHHHHHHHk.', '.kHMMMMMMMMMMDk.', '.kHMMMMMMMMMMDk.', '.kHMMMMMMMMMMDk.', '.kHMMMMMMMMMMDk.', '.kHMMMMMMMMMMDk.', '.kHMMMMMMMMMMDk.', '..kHMMMMMMMMDk..', '..kHMMMMMMMMDk..', '...kHMMMMMMDk...', '....kHMMMMDk....', '.....kHMMDk.....', '......kDDk......', '.......kk.......'];
  const R = mulberry32(tier * 31 + 5);
  const S = 4, c = mkCanvas(16 * S, 16 * S), g = c.getContext('2d');
  shape.forEach((row, y) => row.split('').forEach((ch, x) => {
    let col = null;
    if (ch === 'k') col = '#0a0c17';
    else if (ch === 'H') col = m.hl;
    else if (ch === 'D') col = m.b;
    else if (ch === 'M') {
      col = m.a;
      if (m.pat === 'plank' && y % 3 === 0) col = m.b;
      if (m.pat === 'speck' && R() < 0.22) col = R() < 0.5 ? m.b : m.hl;
      if (m.pat === 'shine' && (x + y) % 7 === 0) col = m.hl;
      if (m.pat === 'gem' && ((x + y) % 5 === 0 || (x - y + 16) % 5 === 0)) col = m.hl;
    }
    if (col) { g.fillStyle = col; g.fillRect(x * S, y * S, S, S); }
  }));
  // emblem: tier pips
  g.fillStyle = tier === 5 ? '#c9a6ff' : '#0a0c17';
  const pips = tier + 1, startX = 8 - pips;
  for (let i = 0; i < pips; i++) g.fillRect((startX + i * 2) * S, 6 * S, S, S * 2);
  const url = c.toDataURL('image/png');
  _iconCache.set(key, url);
  return url;
}
/** pixel portrait of a style (head front + hair + aura frame); `look` can swap the haircut and colour */
function portraitCanvas(styleId, size = 96, look = null) {
  const st = STYLES[styleId] || STYLES.ROOKIE;
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  g.fillStyle = st.aura; g.globalAlpha = 0.28; g.fillRect(0, 0, 16, 16); g.globalAlpha = 1;
  const skin = '#e8b48a', hair = (look && look.hair) || st.hair, shape = (look && look.hairShape) || st.hairShape;
  g.fillStyle = '#0a0c17'; g.fillRect(3, 3, 10, 11);
  g.fillStyle = skin; g.fillRect(4, 4, 8, 9);
  g.fillStyle = hair; g.fillRect(4, 3, 8, 3); g.fillRect(3, 4, 1, 4); g.fillRect(12, 4, 1, 4);
  if (look && look.prism) ['#ff4d5e', '#ff9a3c', '#ffcb3d', '#2ee38f', '#4aa8ff', '#b65cff', '#ff4d5e', '#ffcb3d'].forEach((h, i) => { g.fillStyle = h; g.fillRect(4 + i, 3, 1, 3); });
  g.fillStyle = hair;
  if (shape === 'long') { g.fillRect(3, 4, 1, 9); g.fillRect(12, 4, 1, 9); }
  if (shape === 'bob') { g.fillRect(3, 4, 1, 6); g.fillRect(12, 4, 1, 6); }
  if (shape === 'fluffy') { g.fillRect(3, 2, 10, 2); }
  if (shape === 'spiky') { g.fillRect(4, 2, 1, 1); g.fillRect(7, 2, 1, 1); g.fillRect(10, 2, 1, 1); }
  if (shape === 'messy') { g.fillRect(5, 2, 2, 1); g.fillRect(9, 2, 1, 1); }
  if (shape === 'swept') { g.fillRect(4, 2, 8, 1); g.fillRect(11, 1, 2, 1); }
  if (shape === 'bun') { g.fillRect(6, 1, 4, 2); }
  if (shape === 'flattop') { g.fillRect(4, 0, 8, 3); }
  if (shape === 'mohawk') { g.fillStyle = skin; g.fillRect(4, 3, 3, 2); g.fillRect(9, 3, 3, 2); g.fillStyle = hair; g.fillRect(7, 0, 2, 5); }
  g.fillStyle = '#f7f7f2'; g.fillRect(5, 8, 2, 1); g.fillRect(9, 8, 2, 1);
  g.fillStyle = st.aura; g.fillRect(6, 8, 1, 1); g.fillRect(9, 8, 1, 1);
  g.fillStyle = '#7a4a30'; g.fillRect(7, 11, 2, 1);
  const out = mkCanvas(size, size), og = out.getContext('2d');
  og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, size, size);
  out.className = 'px';
  return out;
}
/* ---------- club crests and kit swatches ---------- */
const CREST_SHIELD = ['.kkkkkkkkkk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '.kAAAAAAAAk.', '..kAAAAAAk..', '..kAAAAAAk..', '...kAAAAk...', '....kAAk....', '.....kk.....'];
const CREST_SYMBOLS = {
  star: ['..BB..', '..BB..', 'BBBBBB', '.BBBB.', '.B..B.', 'B....B'], flame: ['..B...', '..BB..', '.BBB.B', '.BBBBB', 'BBBBBB', '.BBBB.'],
  leaf: ['....BB', '..BBBB', '.BBBB.', 'BBBB..', 'BBB...', 'B.....'], anchor: ['..BB..', '..BB..', 'BBBBBB', '..BB..', 'B.BB.B', '.BBBB.'],
  moon: ['..BBB.', '.BB...', 'BB....', 'BB....', '.BB...', '..BBB.'], sun: ['B.BB.B', '.BBBB.', 'BBBBBB', 'BBBBBB', '.BBBB.', 'B.BB.B'],
};
function crestCanvas(clubId, size = 48) {
  const cr = CLUBS[clubId].crest, c = mkCanvas(12, 12), g = c.getContext('2d');
  CREST_SHIELD.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch !== '.') { g.fillStyle = ch === 'k' ? '#0a0c17' : cr[0]; g.fillRect(x, y, 1, 1); } }));
  CREST_SYMBOLS[cr[2]].forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === 'B') { g.fillStyle = cr[1]; g.fillRect(3 + x, 2 + y, 1, 1); } }));
  const out = mkCanvas(size, size), og = out.getContext('2d');
  og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, size, size); out.className = 'px';
  return out;
}
const KIT_ICON = ['............', '...kkCCkk...', '.kkXXXXXXkk.', 'kLLXXXXXXLLk', 'kLLXXXXXXLLk', '.kkXXXXXXkk.', '..kXXXXXXk..', '..kXXXXXXk..', '..kXXXXXXk..', '..kXXXXXXk..', '..kkkkkkkk..', '............'];
/** a little shirt in a kit's colours and pattern */
function kitCanvas(k, size = 48) {
  const c = mkCanvas(12, 12), g = c.getContext('2d');
  KIT_ICON.forEach((row, y) => row.split('').forEach((ch, x) => {
    let col = null;
    if (ch === 'k') col = '#0a0c17'; else if (ch === 'C') col = k.collar; else if (ch === 'L') col = k.sleeve;
    else if (ch === 'X') {
      const u = x - 3, v = y - 2;
      const a = k.pattern === 'stripes' ? u % 2 === 1 : k.pattern === 'hoops' ? (v >> 1) % 2 === 1 : k.pattern === 'halves' ? u >= 3 : k.pattern === 'sash' ? Math.abs(u - v * 0.7) < 1.1 : false;
      col = a ? k.alt : k.shirt;
    }
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }));
  const out = mkCanvas(size, size), og = out.getContext('2d');
  og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, size, size); out.className = 'px';
  return out;
}
/** card art for a skin: a portrait for hair and colours, a pixel icon for the rest */
const SKIN_ICON = { boots: 'boot', gloves: 'glove', band: 'band', mask: 'mask', chain: 'chain', celeb: 'celeb' };
function skinCanvas(id, size = 96) {
  const sk = SKINS[id];
  if (sk.slot === 'hair') return portraitCanvas('ROOKIE', size, { hairShape: sk.shape || 'short', hair: '#6b3e22' });
  if (sk.slot === 'color') return portraitCanvas('ROOKIE', size, { hair: sk.hex || '#3b2a22', prism: sk.prism });
  const name = sk.acc ? SKIN_ICON[sk.acc] : sk.slot === 'acc' ? 'lock' : SKIN_ICON[sk.slot];
  const src = iconCanvas(name, sk.hex || (sk.slot === 'celeb' ? RARITY_HEX[sk.rarity] : '#8a8fa8'), sk.prism || sk.sparkle || sk.rarity === 'Generational' ? 'prism' : '');
  const out = mkCanvas(size, size), og = out.getContext('2d');
  og.imageSmoothingEnabled = false; og.drawImage(src, 0, 0, size, size);
  out.className = 'px';
  return out;
}
function flowEmblemCanvas(flowId, size = 96) {
  const fl = FLOWS[flowId];
  const c = mkCanvas(12, 12), g = c.getContext('2d');
  const col = fl ? fl.color : '#a4a9cf';
  ICON_MAPS.flame.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (ch === 'A') { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    if (ch === 'w') { g.fillStyle = '#fff6dc'; g.fillRect(x, y, 1, 1); }
  }));
  const out = mkCanvas(size, size), og = out.getContext('2d');
  og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, size, size);
  out.className = 'px';
  return out;
}
