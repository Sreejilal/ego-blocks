/* =====================================================================
   World: renderer, dusk sky, stadium, crowd, floodlights, goals, tower
   ===================================================================== */
class VoxBuilder {
  /** merges axis-aligned boxes into one geometry with world-scaled UVs and simple vertex AO.
      split=true puts top / side / bottom faces in material groups 0 / 1 / 2 */
  constructor(split = false) { this.split = split; this.g = [0, 1, 2].map(() => ({ p: [], n: [], u: [], c: [] })); }
  _face(gi, v, nrm, uv, cols) {
    const G = this.g[gi];
    for (const i of [0, 1, 2, 0, 2, 3]) { G.p.push(v[i][0], v[i][1], v[i][2]); G.n.push(nrm[0], nrm[1], nrm[2]); G.u.push(uv[i][0], uv[i][1]); G.c.push(cols[i][0], cols[i][1], cols[i][2]); }
  }
  box(x0, y0, z0, x1, y1, z1, color = '#ffffff', o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    const c = (color && color.isColor) ? color : lin(color);
    const us = o.uv || 1, ao = o.ao == null ? 0.7 : o.ao, skip = o.skip || '';
    const k = (m) => [c.r * m, c.g * m, c.b * m];
    const T = 0, S = this.split ? 1 : 0, B = this.split ? 2 : 0;
    const lo = k(ao), hi = k(1);
    if (!skip.includes('px')) this._face(S, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[-z1 * us, y0 * us], [-z0 * us, y0 * us], [-z0 * us, y1 * us], [-z1 * us, y1 * us]], [lo, lo, hi, hi]);
    if (!skip.includes('nx')) this._face(S, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0 * us, y0 * us], [z1 * us, y0 * us], [z1 * us, y1 * us], [z0 * us, y1 * us]], [lo, lo, hi, hi]);
    if (!skip.includes('py')) this._face(T, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 * us, -z1 * us], [x1 * us, -z1 * us], [x1 * us, -z0 * us], [x0 * us, -z0 * us]], [hi, hi, hi, hi]);
    if (!skip.includes('ny')) { const d = k(0.55); this._face(B, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0 * us, z0 * us], [x1 * us, z0 * us], [x1 * us, z1 * us], [x0 * us, z1 * us]], [d, d, d, d]); }
    if (!skip.includes('pz')) this._face(S, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0 * us, y0 * us], [x1 * us, y0 * us], [x1 * us, y1 * us], [x0 * us, y1 * us]], [lo, lo, hi, hi]);
    if (!skip.includes('nz')) this._face(S, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[-x1 * us, y0 * us], [-x0 * us, y0 * us], [-x0 * us, y1 * us], [-x1 * us, y1 * us]], [lo, lo, hi, hi]);
    return this;
  }
  geometry() {
    const p = [], n = [], u = [], c = [];
    const geo = new THREE.BufferGeometry();
    let start = 0;
    this.g.forEach((G, gi) => {
      const cnt = G.p.length / 3;
      p.push(...G.p); n.push(...G.n); u.push(...G.u); c.push(...G.c);
      if (this.split && cnt) geo.addGroup(start, cnt, gi);
      start += cnt;
    });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  mesh(mat) { return new THREE.Mesh(this.geometry(), mat); }
}

const TOWER_POS = new THREE.Vector3(70, 0, 175);
const SUN_DIR = new THREE.Vector3(-0.42, 0.24, 0.87).normalize();
const SUN_LOBBY = new THREE.Vector3(0.3, 0.2, 0.93).normalize(); // low behind the far stand, seen from the start screen
const SUN_MATCH = SUN_DIR.clone();
const QUALITY = {
  low: { pr: 0.75, shadows: false, map: 512 },
  lite: { pr: 1, shadows: false, map: 512 }, // auto graphics only: no shadows, but still sharp
  med: { pr: 1, shadows: true, map: 1024 },
  hi1: { pr: 1, shadows: true, map: 2048, post: true }, // auto graphics only: HIGH's look at MED's sharpness (CrazyGames: the resolution stays the same as auto steps down)
  high: { pr: 1.5, shadows: true, map: 2048, post: true },
  ultra: { pr: 2, shadows: true, map: 4096, soft: true, post: true, grade: 1 }, // owner: "way more graphical at the highest end": sharpest, big soft shadows, every crowd extra, the strongest camera effects
};

// the sky and the light: a bright day (the default) or the evening sunset. World.setLook switches them (settings.sky)
const LOOKS = {
  day: {
    sky: ['#2f7fe0', '#5aa6f0', '#9fd0fa', '#e4f4ff', '#a9c7dc', '#fff1c8'], sun: '#fffbe6', halo: ['#fff0b8', 0.4], stars: false,
    fog: ['#cfe5f6', 170, 640], hemi: ['#d6e8ff', '#5f7f3e', 0.7], amb: ['#a7b8d8', 0.24], light: ['#fff1dc', 1.6, [-40, 100, -30]], fill: ['#e2ecff', 0.45],
    exposure: 0.86, cloud: ['#b9d4ee', 0.45], fans: [1, 1, 1], tower: 0.55, lamps: 0.4, sunMatch: [-0.42, 0.62, 0.66], sunLobby: [0.3, 0.55, 0.78],
  },
  sunset: {
    sky: ['#141844', '#46307a', '#c4527a', '#ff9a5c', '#3a2a3e', '#ffd08a'], sun: '#ffe39a', halo: ['#ff9a50', 0.55], stars: true,
    fog: ['#b27a86', 95, 470], hemi: ['#8d96e6', '#5a4630', 0.62], amb: ['#2c3466', 0.35], light: ['#ffb27a', 1.35, [-58, 72, -34]], fill: ['#dfe7ff', 0.62],
    exposure: 1.18, cloud: ['#c86c7a', 0.55], fans: [0.82, 0.74, 0.8], tower: 1.25, lamps: 1, sunMatch: [-0.42, 0.24, 0.87], sunLobby: [0.3, 0.2, 0.93],
  },
  // owner: "a night match with floodlights": a dark sky full of stars, the floodlights do the lighting (the main light straight down from high up)
  night: {
    sky: ['#03050f', '#081028', '#142246', '#24345e', '#0a0f1e', '#c8d6ff'], sun: '#e8eeff', halo: ['#9fb4ff', 0.25], stars: true,
    fog: ['#1a2440', 110, 470], hemi: ['#7a8ad0', '#2c3e2c', 0.78], amb: ['#3a4a80', 0.55], light: ['#f4f6ff', 2.2, [-12, 120, -8]], fill: ['#c8d6ff', 0.8],
    exposure: 1.45, cloud: ['#1a2440', 0.25], fans: [0.92, 0.94, 1.0], tower: 1.7, lamps: 1.9, sunMatch: [-0.12, 0.95, 0.2], sunLobby: [0.1, 0.9, 0.3],
  },
};

const World = {
  renderer: null, scene: null, camera: null, T: null, quality: 'med', scale: 1, time: 0,
  excite: [0, 0], netBulge: [0, 0], fanMat: null,
  init(canvas) {
    const q = Save.data.settings.quality;
    let r;
    try { r = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance', stencil: false }); }
    catch (e) { r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default', stencil: false }); } // some phones refuse the first ask: a simpler one (if that fails too, bootFail says so)
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.18;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    Tex.aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(lin('#b27a86'), 95, 470);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900);
    this.T = makeBlockTextures();
    this.buildLights();
    this.buildSky();
    this.buildPitch();
    this.buildGoals();
    this.buildStands();
    this.buildFans();
    this.buildCrowdExtras();
    this.buildRoofs(); this.buildRain();
    this.buildFloodlights();
    this.buildTower();
    this.buildTrees();
    this.buildClouds();
    this.weather = Save.data.settings.weather === 'rain' ? 'rain' : 'clear';
    this.setLook(Save.data.settings.sky);
    if (this.rain) this.rain.visible = this.weather === 'rain';
    this.setQuality(q === 'auto' ? 'med' : q);
    this.resize();
  },
  /** scale: the auto setting draws fewer pixels (0.7 to 1) before it gives up anything else */
  setQuality(q, scale = 1) {
    if (!QUALITY[q]) q = 'med';
    const Q = QUALITY[q], shadowsChange = this.renderer.shadowMap.enabled !== Q.shadows;
    const sType = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap, typeChange = this.renderer.shadowMap.type !== sType;
    this.renderer.shadowMap.type = sType;
    this.quality = q; this.scale = scale;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr) * scale);
    this.renderer.shadowMap.enabled = Q.shadows;
    this.sun.castShadow = Q.shadows;
    if (this.sun.shadow.mapSize.x !== Q.map) {
      this.sun.shadow.mapSize.set(Q.map, Q.map);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    // rebuilding every shader freezes the game for a moment, so only when shadows go on or off (the only change that needs it)
    if (shadowsChange || typeChange) this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    if (this.extras) { // the crowd extras: banners always, posters and flashes from MED, giant flags from HIGH
      const E = this.extras, lowish = q === 'low';
      E.posters.visible = !lowish; E.flashes.visible = !lowish && q !== 'lite'; E.flags.forEach((f) => { f.visible = !!Q.post; });
    }
    this.postOn = !!Q.post && this.initPost(); this.postGrade = Q.grade || 0;
    this.resize();
  },
  resize() {
    const w = window.innerWidth || 800, h = window.innerHeight || 600;
    this.renderer.setSize(w, h, false);
    const a = w / h;
    this.camera.aspect = a;
    // a phone held upright gets a taller field of view so the sides of the pitch stay in shot
    this.camera.fov = this.baseFov = a >= 1 ? 68 : Math.min(96, 68 + (1 - a) * 52);
    this.camera.updateProjectionMatrix();
  },
  buildLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(lin('#8d96e6'), lin('#5a4630'), 0.62);
    s.add(this.hemi);
    const amb = new THREE.AmbientLight(lin('#2c3466'), 0.35); s.add(amb); this.amb = amb;
    const sun = new THREE.DirectionalLight(lin('#ffb27a'), 1.35);
    sun.position.set(-58, 72, -34);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const SR = Math.max(F.BOARD_X, F.BOARD_Z) + 12; // the shadows cover the whole pitch and the front of the stands
    const sc = sun.shadow.camera; sc.left = -SR; sc.right = SR; sc.top = SR; sc.bottom = -SR; sc.near = 20; sc.far = 240;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(lin('#dfe7ff'), 0.62);
    fill.position.set(40, 90, 30); s.add(fill); this.fill = fill;
  },
  buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        cTop: { value: lin('#141844') }, cMid: { value: lin('#46307a') }, cLow: { value: lin('#c4527a') }, cHor: { value: lin('#ff9a5c') },
        cBot: { value: lin('#3a2a3e') }, sunDir: { value: SUN_DIR.clone() }, sunCol: { value: lin('#ffd08a') },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: [
        'uniform vec3 cTop, cMid, cLow, cHor, cBot, sunDir, sunCol; varying vec3 vDir;',
        'void main(){',
        ' vec3 d = normalize(vDir); float h = d.y;',
        ' vec3 col = mix(cHor, cLow, smoothstep(0.0, 0.10, h));',
        ' col = mix(col, cMid, smoothstep(0.08, 0.32, h));',
        ' col = mix(col, cTop, smoothstep(0.30, 0.85, h));',
        ' if (h < 0.0) col = mix(cHor, cBot, smoothstep(0.0, -0.18, h));',
        ' float s = max(dot(d, sunDir), 0.0);',
        ' col += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6);',
        ' col = floor(col * 48.0 + 0.5) / 48.0;',
        ' gl_FragColor = vec4(col, 1.0);',
        ' #include <encodings_fragment>',
        '}',
      ].join('\n'),
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    });
    this.sky = new THREE.Mesh(geo, mat); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    // square sun + pixel halo
    const sunMat = new THREE.MeshBasicMaterial({ color: lin('#ffe39a'), fog: false, toneMapped: false, depthWrite: false });
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), sunMat);
    const haloMat = new THREE.MeshBasicMaterial({ map: this.T.glow, color: lin('#ff9a50'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false });
    this.sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), haloMat);
    this.sunMesh.renderOrder = -9; this.sunHalo.renderOrder = -9;
    this.scene.add(this.sunHalo, this.sunMesh);
    // stars: square points, only in the upper sky
    const sp = [], R = mulberry32(5);
    for (let i = 0; i < 260; i++) {
      const th = R() * TAU, y = 0.32 + R() * 0.66, r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(th) * r * 560, y * 560, Math.sin(th) * r * 560);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  },
  buildPitch() {
    const T = this.T;
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_BX, PITCH_BZ), new THREE.MeshLambertMaterial({ map: makePitchTexture() }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch); this.pitchTex = pitch.material.map;
    const gGeo = new THREE.PlaneGeometry(1600, 1600);
    const uv = gGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1600, uv.getY(i) * 1600);
    const ground = new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ map: T.grassTop }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03;
    this.scene.add(ground);
    // advertising boards ring
    const adMat = new THREE.MeshLambertMaterial({ map: T.ads });
    const backMat = new THREE.MeshLambertMaterial({ map: T.metalDark });
    const vb = new VoxBuilder();
    const mkBoard = (len, px, pz, rotY, offset) => {
      const g = new THREE.PlaneGeometry(len, 1);
      const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) * len / 64 + offset);
      const m = new THREE.Mesh(g, adMat); m.position.set(px, 0.5, pz); m.rotation.y = rotY; this.scene.add(m);
    };
    const BX = F.BOARD_X, BZ = F.BOARD_Z;
    mkBoard(BZ * 2, -BX + 0.16, 0, Math.PI / 2, 0.0);
    mkBoard(BZ * 2, BX - 0.16, 0, -Math.PI / 2, 0.37);
    mkBoard(BX * 2, 0, -BZ + 0.16, 0, 0.62);
    mkBoard(BX * 2, 0, BZ - 0.16, Math.PI, 0.12);
    // the easter egg: one board near a corner carries a gift code (CODES: HIDDEN GIFT)
    const eg = mkCanvas(128, 16), egc = eg.getContext('2d'), eggTxt = 'SECRET CODE TOPBINS';
    egc.fillStyle = '#2b0f45'; egc.fillRect(0, 0, 128, 16); egc.fillStyle = 'rgba(0,0,0,.25)'; egc.fillRect(0, 14, 128, 2);
    pfDraw(egc, eggTxt, Math.floor((128 - pfWidth(eggTxt, 1)) / 2), 4, 1, '#ffe066');
    const egg = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshLambertMaterial({ map: Tex.fromCanvas(eg, { mip: true }) }));
    egg.position.set(-BX + 0.19, 0.5, BZ - 7); egg.rotation.y = Math.PI / 2; this.scene.add(egg);
    vb.box(-BX - 0.15, 0, -BZ, -BX + 0.15, 1, BZ, '#ffffff', { uv: 1 });
    vb.box(BX - 0.15, 0, -BZ, BX + 0.15, 1, BZ, '#ffffff', { uv: 1 });
    vb.box(-BX, 0, -BZ - 0.15, BX, 1, -BZ + 0.15, '#ffffff', { uv: 1 });
    vb.box(-BX, 0, BZ - 0.15, BX, 1, BZ + 0.15, '#ffffff', { uv: 1 });
    const boards = vb.mesh(Object.assign(backMat.clone(), { vertexColors: true }));
    boards.position.y = -0.001; boards.scale.set(1, 0.999, 1);
    this.scene.add(boards);
  },
  buildGoals() {
    const vb = new VoxBuilder();
    this.goalBoxes = [];
    const P = F.POST, gw = F.GW, gh = F.GH, L = F.L, back = F.L + F.GD;
    for (const s of [1, -1]) {
      const z0 = s * (L - P), z1 = s * L, zb0 = s * (back - P), zb1 = s * back;
      const boxes = [
        [-gw - P, 0, z0, -gw, gh + P, z1], [gw, 0, z0, gw + P, gh + P, z1], [-gw - P, gh, z0, gw + P, gh + P, z1],
        [-gw - P, 0, zb0, -gw, gh + P, zb1], [gw, 0, zb0, gw + P, gh + P, zb1], [-gw - P, gh, zb0, gw + P, gh + P, zb1],
        [-gw - P, gh, z1, -gw, gh + P, zb0], [gw, gh, z1, gw + P, gh + P, zb0],
        [-gw - P, 0, z1, -gw, 0.25, zb0], [gw, 0, z1, gw + P, 0.25, zb0], [-gw, 0, zb0, gw, 0.25, zb1],
      ];
      for (const b of boxes) {
        vb.box(b[0], b[1], b[2], b[3], b[4], b[5], '#ffffff', { uv: 2, ao: 0.82 });
        this.goalBoxes.push({ min: V3(Math.min(b[0], b[3]), Math.min(b[1], b[4]), Math.min(b[2], b[5])), max: V3(Math.max(b[0], b[3]), Math.max(b[1], b[4]), Math.max(b[2], b[5])) });
      }
    }
    const frame = vb.mesh(new THREE.MeshLambertMaterial({ map: this.T.white, vertexColors: true }));
    frame.castShadow = true; frame.receiveShadow = true;
    this.scene.add(frame);
    const netMat = new THREE.MeshLambertMaterial({ map: this.T.net, alphaTest: 0.5, side: THREE.DoubleSide });
    this.nets = [];
    let nm = netMat;
    const mkNet = (w, h, uw, uh) => { const g = new THREE.PlaneGeometry(w, h); const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uw, a.getY(i) * uh); return new THREE.Mesh(g, nm); };
    for (const s of [1, -1]) {
      nm = netMat.clone(); nm.transparent = true; // each goal its own, so the one the camera is behind can fade
      const grp = new THREE.Group();
      const backNet = mkNet(gw * 2, gh, gw * 2, gh); backNet.position.set(0, gh / 2, s * (back - P / 2)); grp.add(backNet);
      const top = mkNet(gw * 2, F.GD - P, gw * 2, F.GD - P); top.rotation.x = -Math.PI / 2; top.position.set(0, gh + P / 2, s * (L + (F.GD - P) / 2)); grp.add(top);
      for (const sx of [1, -1]) { const side = mkNet(F.GD - P, gh, F.GD - P, gh); side.rotation.y = Math.PI / 2; side.position.set(sx * (gw + P / 2), gh / 2, s * (L + (F.GD - P) / 2)); grp.add(side); }
      this.scene.add(grp);
      this.nets.push({ s, back: backNet, baseZ: backNet.position.z, grp, mat: nm });
    }
  },
  buildStands() {
    const T = this.T;
    const { ROWS, DEP, RISE, BASE } = STAND; // the ball bounces off these (standTop)
    this.standRows = { ROWS, DEP, RISE, BASE };
    const blue = new VoxBuilder(true), orange = new VoxBuilder(true);
    const sideIn = STAND.SIDE, endIn = STAND.END, sideLen = STAND.SIDE_LEN, endLen = STAND.SIDE;
    for (let i = 0; i < ROWS; i++) {
      const top = BASE + i * RISE;
      // west (x<0) blue, east orange
      blue.box(-sideIn - (i + 1) * DEP, 0, -sideLen, -sideIn - i * DEP, top, sideLen, '#ffffff', { uv: 1, ao: 0.62 });
      orange.box(sideIn + i * DEP, 0, -sideLen, sideIn + (i + 1) * DEP, top, sideLen, '#ffffff', { uv: 1, ao: 0.62 });
      // south (z<0) blue, north orange
      blue.box(-endLen, 0, -endIn - (i + 1) * DEP, endLen, top, -endIn - i * DEP, '#ffffff', { uv: 1, ao: 0.62 });
      orange.box(-endLen, 0, endIn + i * DEP, endLen, top, endIn + (i + 1) * DEP, '#ffffff', { uv: 1, ao: 0.62 });
    }
    // back walls and corner blocks
    const outerX = sideIn + ROWS * DEP, outerZ = endIn + ROWS * DEP, wallTop = STAND.WALL;
    const grey = new VoxBuilder();
    grey.box(-outerX - 1, 0, -sideLen - 1, -outerX, wallTop, sideLen + 1, '#ffffff', { uv: 1 });
    grey.box(outerX, 0, -sideLen - 1, outerX + 1, wallTop, sideLen + 1, '#ffffff', { uv: 1 });
    grey.box(-endLen - 1, 0, -outerZ - 1, endLen + 1, wallTop, -outerZ, '#ffffff', { uv: 1 });
    grey.box(-endLen - 1, 0, outerZ, endLen + 1, wallTop, outerZ + 1, '#ffffff', { uv: 1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      grey.box(sx * sideIn, 0, sz * sideLen, sx * (outerX + 1), wallTop - 0.6, sz * (outerZ + 1), '#d7d9e2', { uv: 1, ao: 0.6 });
    }
    // low wall between run-off and first row
    grey.box(-sideIn, 0, -sideLen, -sideIn + 0.6, 1.2, sideLen, '#9fa3b3', { uv: 1 });
    grey.box(sideIn - 0.6, 0, -sideLen, sideIn, 1.2, sideLen, '#9fa3b3', { uv: 1 });
    grey.box(-endLen, 0, -endIn, endLen, 1.2, -endIn + 0.6, '#9fa3b3', { uv: 1 });
    grey.box(-endLen, 0, endIn - 0.6, endLen, 1.2, endIn, '#9fa3b3', { uv: 1 });
    const stone = new THREE.MeshLambertMaterial({ map: T.stoneBrick, vertexColors: true });
    const mkMats = (seat) => [new THREE.MeshLambertMaterial({ map: seat, vertexColors: true }), stone, stone];
    const bm = blue.mesh(mkMats(T.seatHome)), om = orange.mesh(mkMats(T.seatAway)), gm = grey.mesh(stone);
    bm.receiveShadow = om.receiveShadow = gm.receiveShadow = false;
    this.scene.add(bm, om, gm);
    this.stand = { sideIn, endIn, sideLen, endLen, outerX, outerZ, wallTop };
    // upper deck behind and above the bowl, opened up for the higher tiers
    const UP = 5, ub = new VoxBuilder(true), uo = new VoxBuilder(true), ug = new VoxBuilder();
    const ux = outerX + 1, uz = outerZ + 1, uBase = wallTop + 0.4, uRise = 1.15;
    for (let i = 0; i < UP; i++) {
      const top = uBase + (i + 1) * uRise;
      ub.box(-ux - (i + 1) * DEP, uBase - 2, -sideLen, -ux - i * DEP, top, sideLen, '#ffffff', { uv: 1, ao: 0.62 });
      uo.box(ux + i * DEP, uBase - 2, -sideLen, ux + (i + 1) * DEP, top, sideLen, '#ffffff', { uv: 1, ao: 0.62 });
      ub.box(-endLen, uBase - 2, -uz - (i + 1) * DEP, endLen, top, -uz - i * DEP, '#ffffff', { uv: 1, ao: 0.62 });
      uo.box(-endLen, uBase - 2, uz + i * DEP, endLen, top, uz + (i + 1) * DEP, '#ffffff', { uv: 1, ao: 0.62 });
    }
    const uox = ux + UP * DEP, uoz = uz + UP * DEP, uTop = uBase + UP * uRise + 1.4;
    ug.box(-uox - 1, 0, -sideLen - 1, -uox, uTop, sideLen + 1, '#ffffff', { uv: 1 });
    ug.box(uox, 0, -sideLen - 1, uox + 1, uTop, sideLen + 1, '#ffffff', { uv: 1 });
    ug.box(-endLen - 1, 0, -uoz - 1, endLen + 1, uTop, -uoz, '#ffffff', { uv: 1 });
    ug.box(-endLen - 1, 0, uoz, endLen + 1, uTop, uoz + 1, '#ffffff', { uv: 1 });
    this.upper = new THREE.Group();
    this.upper.add(ub.mesh(mkMats(T.seatHome)), uo.mesh(mkMats(T.seatAway)), ug.mesh(stone));
    this.scene.add(this.upper);
    this.upperRows = { UP, ux, uz, uBase, uRise };
  },
  buildFans() {
    const { ROWS, DEP, RISE, BASE } = this.standRows;
    const { sideIn, endIn, sideLen, endLen } = this.stand;
    const R = mulberry32(42);
    const spots = [];
    const add = (x, y, z, yaw, team) => { if (R() < 0.86) spots.push({ x: x + (R() - 0.5) * 0.25, y, z: z + (R() - 0.5) * 0.25, yaw, team }); };
    for (let i = 0; i < ROWS; i++) {
      const top = BASE + i * RISE;
      for (let z = -sideLen + 0.6; z <= sideLen - 0.6; z += 1.05) {
        add(-sideIn - (i + 0.5) * DEP, top, z, Math.PI / 2, R() < 0.86 ? 0 : 1);
        add(sideIn + (i + 0.5) * DEP, top, z, -Math.PI / 2, R() < 0.86 ? 1 : 0);
      }
      for (let x = -endLen + 0.6; x <= endLen - 0.6; x += 1.05) {
        add(x, top, -endIn - (i + 0.5) * DEP, 0, R() < 0.9 ? 0 : 1);
        add(x, top, endIn + (i + 0.5) * DEP, Math.PI, R() < 0.9 ? 1 : 0);
      }
    }
    // upper deck fans come last, so a half-full stadium fills from the front rows
    const U = this.upperRows;
    this.lowerFans = spots.length;
    for (let i = 0; i < U.UP; i++) {
      const top = U.uBase + (i + 1) * U.uRise;
      for (let z = -sideLen + 0.6; z <= sideLen - 0.6; z += 1.05) {
        add(-U.ux - (i + 0.5) * DEP, top, z, Math.PI / 2, R() < 0.86 ? 0 : 1);
        add(U.ux + (i + 0.5) * DEP, top, z, -Math.PI / 2, R() < 0.86 ? 1 : 0);
      }
      for (let x = -endLen + 0.6; x <= endLen - 0.6; x += 1.05) {
        add(x, top, -U.uz - (i + 0.5) * DEP, 0, R() < 0.9 ? 0 : 1);
        add(x, top, U.uz + (i + 0.5) * DEP, Math.PI, R() < 0.9 ? 1 : 0);
      }
    }
    // fan geometry: shirt body + head + two raised-able arms
    const vb = new VoxBuilder();
    const parts = [];
    const pushPart = (x0, y0, z0, x1, y1, z1, part) => { const before = vb.g[0].p.length / 3; vb.box(x0, y0, z0, x1, y1, z1, '#ffffff', { ao: 0.75, skip: 'ny' }); const after = vb.g[0].p.length / 3; for (let i = before; i < after; i++) parts.push(part); };
    pushPart(-0.27, 0, -0.15, 0.27, 0.78, 0.15, 0);
    pushPart(-0.21, 0.78, -0.21, 0.21, 1.2, 0.21, 1);
    pushPart(-0.43, 0.2, -0.08, -0.27, 0.74, 0.08, 2);
    pushPart(0.27, 0.2, -0.08, 0.43, 0.74, 0.08, 2);
    const geo = vb.geometry();
    // per-vertex shade from normal (no lighting in this shader)
    const nrm = geo.attributes.normal, col = geo.attributes.color, shade = [];
    for (let i = 0; i < nrm.count; i++) {
      const ny = nrm.getY(i), nz = nrm.getZ(i);
      shade.push((ny > 0.5 ? 1.0 : ny < -0.5 ? 0.5 : nz > 0.5 ? 0.86 : nz < -0.5 ? 0.55 : 0.7) * col.getX(i));
    }
    geo.setAttribute('part', new THREE.Float32BufferAttribute(parts, 1));
    geo.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
    const n = spots.length;
    const aColor = new Float32Array(n * 3), aSkin = new Float32Array(n * 3), aData = new Float32Array(n * 2);
    const teamCols = [['#2f62d8', '#3d7dff', '#1f4fb8', '#f2f2f2'], ['#ec7424', '#ff8a2a', '#c95c14', '#2a2a2a']];
    const skins = ['#f1c7a0', '#d9a07a', '#a8714c', '#7a4e33', '#f6d9bd'];
    spots.forEach((s, i) => {
      const c = lin(pick(teamCols[s.team])); aColor.set([c.r, c.g, c.b], i * 3);
      const k = lin(pick(skins)); aSkin.set([k.r, k.g, k.b], i * 3);
      aData[i * 2] = R(); aData[i * 2 + 1] = s.team;
    });
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
    geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(aSkin, 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uExcite: { value: new THREE.Vector2(0, 0) }, uLight: { value: new THREE.Vector3(0.82, 0.74, 0.8) } }]),
      vertexShader: [
        'attribute vec3 aColor; attribute vec3 aSkin; attribute vec2 aData; attribute float part; attribute float shade;',
        'uniform float uTime; uniform vec2 uExcite; uniform vec3 uLight; varying vec3 vCol;',
        '#include <fog_pars_vertex>',
        'void main(){',
        ' vec3 p = position; float ex = mix(uExcite.x, uExcite.y, aData.y);',
        ' float j = max(0.0, sin(uTime * (6.0 + ex * 5.0) + aData.x * 6.2831));',
        ' p.y += j * (0.05 + ex * 0.6);',
        ' if (part > 1.5) { p.y += ex * 0.52; p.x *= 1.0 + ex * 0.25; }',
        ' vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);',
        ' gl_Position = projectionMatrix * mvPosition;',
        ' vec3 c = (part > 0.5 && part < 1.5) ? aSkin : aColor;',
        ' vCol = c * shade * uLight;',
        ' #include <fog_vertex>',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vCol;',
        '#include <common>',
        '#include <fog_pars_fragment>',
        'void main(){',
        ' gl_FragColor = vec4(vCol, 1.0);',
        ' #include <tonemapping_fragment>',
        ' #include <encodings_fragment>',
        ' #include <fog_fragment>',
        '}',
      ].join('\n'),
      fog: true,
    });
    const im = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    spots.forEach((s, i) => { m.makeRotationY(s.yaw); m.setPosition(s.x, s.y, s.z); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    this.scene.add(im);
    this.fanMat = mat; this.fans = im; this.fanCount = n; this.fanSpots = spots;
  },
  /** banners over the front wall, fans holding up posters, giant flags waving in the end stands and camera flashes
      (owner, Nov 2026: "make the crowd have posters and banners"). All in the clubs' colours (paintCrowdExtras) */
  buildCrowdExtras() {
    const S = this.stand, rows = this.standRows, spots = this.fanSpots, R = mulberry32(77), fog = THREE.UniformsLib.fog;
    const fogFrag = ['#include <common>', '#include <fog_pars_fragment>'], tail = [' #include <tonemapping_fragment>', ' #include <encodings_fragment>', ' #include <fog_fragment>', '}'];
    const E = this.extras = {};
    // 1) banners: one mesh, 6 per club (4 along the side wall, 2 along the end wall), hanging over the front rail
    E.bannerCv = mkCanvas(128, 16 * 12); E.bannerTex = Tex.fromCanvas(E.bannerCv, { mip: true });
    const pos = [], uv = [], idx = [], H = 1.4, W = 11.2;
    const quad = (cx, cy, cz, nx, nz, row) => { // facing (nx, 0, nz); its right is up x normal
      const rx = nz, rz = -nx, b = pos.length / 3, v0 = 1 - (row + 1) / 12, v1 = 1 - row / 12;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(cx + rx * sx * W / 2, cy + sy * H / 2, cz + rz * sx * W / 2);
      uv.push(0, v0, 1, v0, 1, v1, 0, v1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const wy = 1.75, sx = S.sideIn - 0.62, ez = S.endIn - 0.62; // high enough to show over the advert boards
    [-0.68, -0.23, 0.23, 0.68].forEach((k, i) => { quad(-sx, wy, -k * S.sideLen, 1, 0, i); quad(sx, wy, k * S.sideLen, -1, 0, 6 + i); });
    [-0.45, 0.45].forEach((k, i) => { quad(k * S.endLen, wy, -ez, 0, 1, 4 + i); quad(-k * S.endLen, wy, ez, 0, -1, 10 + i); });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); bg.computeVertexNormals();
    E.banners = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ map: E.bannerTex }));
    this.scene.add(E.banners);
    // 2) posters held up by about one fan in eleven: an atlas of 8 designs per club (4 x 4 cells of 32 x 16)
    E.posterCv = mkCanvas(128, 64); E.posterTex = Tex.fromCanvas(E.posterCv, { mip: true });
    const picks = []; spots.forEach((sp, i) => { if (R() < 0.09) picks.push(i); });
    E.posterIdx = picks;
    const pg = new THREE.PlaneGeometry(1.3, 0.68), n = picks.length;
    const aCell = new Float32Array(n * 2), aData = new Float32Array(n * 2);
    picks.forEach((si, k) => { const sp = spots[si], d = Math.floor(R() * 8); aCell[k * 2] = (d % 4) * 0.25; aCell[k * 2 + 1] = 1 - (Math.floor(d / 4) + sp.team * 2 + 1) * 0.25; aData[k * 2] = this.fans.geometry.attributes.aData.getX(si); aData[k * 2 + 1] = sp.team; });
    pg.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2)); pg.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 2));
    const pm = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([fog, { map: { value: null } }]),
      vertexShader: ['attribute vec2 aCell; attribute vec2 aData; uniform float uTime; uniform vec2 uExcite; varying vec2 vUv;', '#include <fog_pars_vertex>', 'void main(){',
        ' vec3 p = position; float ex = mix(uExcite.x, uExcite.y, aData.y);',
        ' float j = max(0.0, sin(uTime * (6.0 + ex * 5.0) + aData.x * 6.2831));', // in time with the fan holding it
        ' p.y += j * (0.05 + ex * 0.6) + ex * 0.3;',
        ' vUv = aCell + uv * vec2(0.25, 0.25);',
        ' vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);', ' gl_Position = projectionMatrix * mvPosition;', ' #include <fog_vertex>', '}'].join('\n'),
      fragmentShader: ['uniform sampler2D map; uniform vec3 uLight; varying vec2 vUv;'].concat(fogFrag, ['void main(){', ' vec3 c = pow(texture2D(map, vUv).rgb, vec3(2.2));', ' gl_FragColor = vec4(c * uLight * 1.15, 1.0);'], tail).join('\n'),
      fog: true, side: THREE.DoubleSide,
    });
    pm.uniforms.map.value = E.posterTex;
    pm.uniforms.uTime = this.fanMat.uniforms.uTime; pm.uniforms.uExcite = this.fanMat.uniforms.uExcite; pm.uniforms.uLight = this.fanMat.uniforms.uLight; // the same as the fans'
    E.posters = new THREE.InstancedMesh(pg, pm, n);
    const m4 = new THREE.Matrix4();
    picks.forEach((si, k) => { const sp = spots[si]; m4.makeRotationY(sp.yaw); m4.setPosition(sp.x + Math.sin(sp.yaw) * 0.18, sp.y + 1.75, sp.z + Math.cos(sp.yaw) * 0.18); E.posters.setMatrixAt(k, m4); });
    E.posters.instanceMatrix.needsUpdate = true; E.posters.frustumCulled = false;
    this.scene.add(E.posters);
    // 3) giant flags waving over the fans in each end stand
    E.flagCv = [mkCanvas(48, 28), mkCanvas(48, 28)]; E.flagTex = E.flagCv.map((c) => Tex.fromCanvas(c, { mip: true }));
    E.flagMat = E.flagTex.map((t) => {
      const fm = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([fog, { map: { value: null }, uTime: { value: 0 } }]),
        vertexShader: ['attribute float aPhase; uniform float uTime; varying vec2 vUv; varying float vShade;', '#include <fog_pars_vertex>', 'void main(){',
          ' vec3 p = position; float k = uv.x;', // the pole side (left) stays put
          ' float w = sin(p.x * 0.9 - uTime * 3.2 + aPhase) * 0.45 * k + sin(p.y * 1.3 - uTime * 2.1 + aPhase) * 0.12 * k;',
          ' p.z += w; p.y -= k * k * 0.25; vShade = 0.82 + 0.3 * cos(p.x * 0.9 - uTime * 3.2 + aPhase) * k; vUv = uv;',
          ' vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);', ' gl_Position = projectionMatrix * mvPosition;', ' #include <fog_vertex>', '}'].join('\n'),
        fragmentShader: ['uniform sampler2D map; uniform vec3 uLight; varying vec2 vUv; varying float vShade;'].concat(fogFrag, ['void main(){', ' vec3 c = pow(texture2D(map, vUv).rgb, vec3(2.2));', ' gl_FragColor = vec4(c * uLight * vShade * 1.1, 1.0);'], tail).join('\n'),
        fog: true, side: THREE.DoubleSide,
      });
      fm.uniforms.map.value = t; fm.uniforms.uLight = this.fanMat.uniforms.uLight;
      return fm;
    });
    E.flags = [];
    const fy = rows.BASE + 3 * rows.RISE + 2.4, fz = S.endIn + 3.5 * rows.DEP;
    for (const [x, team] of [[-14, 0], [14, 0], [-14, 1], [14, 1]]) {
      const g = new THREE.PlaneGeometry(7.2, 4.2, 16, 8), ph = new Float32Array(g.attributes.position.count).fill(R() * 6.28);
      g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
      const f = new THREE.Mesh(g, E.flagMat[team]);
      const zs = team === 0 ? -1 : 1; // the home end is south (z < 0)
      f.position.set(x * (team ? -1 : 1), fy, zs * fz); f.rotation.set(zs * 0.42, team ? Math.PI : 0, 0); f.frustumCulled = false;
      E.flags.push(f); this.scene.add(f);
    }
    // 4) camera flashes popping all round the crowd (lots more after a goal)
    const fl = 320, fpos = new Float32Array(fl * 3), fph = new Float32Array(fl), frt = new Float32Array(fl);
    E.flashIdx = Array.from({ length: fl }, () => Math.floor(R() * spots.length)).sort((p1, p2) => p1 - p2); // front rows first, like the fans (setTier shows only those who came)
    E.flashIdx.forEach((si, i) => { const sp = spots[si]; fpos.set([sp.x, sp.y + 1.05, sp.z], i * 3); fph[i] = R(); frt[i] = 0.05 + R() * 0.1; }); // each one pops every 7 to 20 seconds (much more often after a goal)
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('aPhase', new THREE.BufferAttribute(fph, 1)); fg.setAttribute('aRate', new THREE.BufferAttribute(frt, 1));
    E.flashMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uScale: { value: 600 } },
      vertexShader: ['attribute float aPhase; attribute float aRate; uniform float uTime; uniform float uFlash; uniform float uScale; varying float vA;', 'void main(){',
        ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        ' float spd = aRate * (1.0 + uFlash * 6.0), f = fract(uTime * spd + aPhase);', ' vA = 1.0 - smoothstep(0.0, 0.1 * spd, f);',
        ' gl_PointSize = vA > 0.01 ? max(2.0, 0.55 * uScale / max(1.0, -mv.z)) : 0.0;', ' gl_Position = projectionMatrix * mv;', '}'].join('\n'),
      fragmentShader: ['varying float vA;', 'void main(){', ' vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;', ' float a = vA * (1.0 - r * 2.0);', ' gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a * 1.8, a);', '}'].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    E.flashes = new THREE.Points(fg, E.flashMat); E.flashes.frustumCulled = false;
    this.scene.add(E.flashes);
  },
  /** owner: "a stadium roof": over the lower stands in a small stadium, over the upper deck once it opens (setTier), with a row of lights under the front edge */
  buildRoofs() {
    const S = this.stand, U = this.upperRows, T = this.T;
    const mat = new THREE.MeshLambertMaterial({ map: T.metalDark, vertexColors: true }), glow = new THREE.MeshBasicMaterial({ color: lin('#fff3d0'), toneMapped: false });
    const make = (outX, outZ, y, depth) => {
      const vb = new VoxBuilder(), lights = new VoxBuilder(), L = S.sideLen + 1, E = S.endLen + 1;
      vb.box(-outX - 1, y, -L, -outX + depth, y + 0.5, L, '#9aa0b4', { uv: 1 }); vb.box(outX - depth, y, -L, outX + 1, y + 0.5, L, '#9aa0b4', { uv: 1 }); // the sides
      vb.box(-E, y, -outZ - 1, E, y + 0.5, -outZ + depth, '#9aa0b4', { uv: 1 }); vb.box(-E, y, outZ - depth, E, y + 0.5, outZ + 1, '#9aa0b4', { uv: 1 }); // the ends
      for (const sx of [-1, 1]) vb.box(sx * (outX - depth) - 0.3, y - 0.7, -L, sx * (outX - depth) + 0.3, y + 0.5, L, '#e8ecf4', { uv: 1 }); // white front edges
      for (const sz of [-1, 1]) vb.box(-E, y - 0.7, sz * (outZ - depth) - 0.3, E, y + 0.5, sz * (outZ - depth) + 0.3, '#e8ecf4', { uv: 1 });
      for (let z = -L + 4; z < L; z += 8) for (const sx of [-1, 1]) lights.box(sx * (outX - depth) - 0.2, y - 0.95, z - 0.5, sx * (outX - depth) + 0.2, y - 0.7, z + 0.5, '#ffffff');
      for (let x = -E + 4; x < E; x += 8) for (const sz of [-1, 1]) lights.box(x - 0.5, y - 0.95, sz * (outZ - depth) - 0.2, x + 0.5, y - 0.7, sz * (outZ - depth) + 0.2, '#ffffff');
      const g = new THREE.Group(), m = vb.mesh(mat); m.castShadow = true; g.add(m, lights.mesh(glow));
      this.scene.add(g); return g;
    };
    this.roofLow = make(S.outerX, S.outerZ, S.wallTop + 1.6, 9);
    const ux = U.ux + U.UP * this.standRows.DEP, uz = U.uz + U.UP * this.standRows.DEP;
    this.roofHigh = make(ux, uz, U.uBase + U.UP * U.uRise + 2.6, 11);
  },
  /** owner: "rain": streaks falling round the camera (they keep their place in the world, so moving does not drag them), and a greyer sky. settings.weather */
  buildRain() {
    const n = 3000, seed = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2), pos = new Float32Array(n * 2 * 3), R = mulberry32(5);
    for (let i = 0; i < n; i++) { const a = R(), b = R(), c = R(); for (let k = 0; k < 2; k++) { seed.set([a, b, c], (i * 2 + k) * 3); end[i * 2 + k] = k; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: ['attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;', 'void main(){',
        ' float B = 64.0, H = 34.0;',
        ' vec3 p = vec3(uCam.x + mod(aSeed.x * B - uCam.x, B) - B * 0.5, mod(aSeed.y * H - uTime * (22.0 + aSeed.z * 8.0), H) - 2.0, uCam.z + mod(aSeed.z * B - uCam.z, B) - B * 0.5);',
        ' p.y -= aEnd * 0.75; p.x -= aEnd * 0.12; vA = 0.42 - aEnd * 0.3;',
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }'].join('\n'),
      fragmentShader: ['varying float vA;', 'void main(){ gl_FragColor = vec4(0.78, 0.84, 0.95, vA); }'].join('\n'),
      transparent: true, depthWrite: false,
    });
    this.rain = new THREE.LineSegments(g, this.rainMat); this.rain.frustumCulled = false; this.rain.visible = false;
    this.scene.add(this.rain);
  },
  setWeather(w) {
    this.weather = w === 'rain' ? 'rain' : 'clear';
    if (this.rain) this.rain.visible = this.weather === 'rain';
    this.setLook(this.look || 'day'); // the look, greyed for rain
  },
  /** paint the banners, posters and flags in the two clubs' colours (home: west and south, away: east and north) */
  paintCrowdExtras(a, b) {
    const E = this.extras; if (!E) return;
    const sides = [a, b], kit = (s) => CLUBS[s.club].home, ink = (hex) => (hexLum(hex) > 0.55 ? '#14161f' : '#ffffff');
    // banners: 6 lines per club
    const bc = E.bannerCv.getContext('2d');
    sides.forEach((s, t) => {
      const k = kit(s), nm = s.short || 'FC', lines = ['GO ' + nm + ' GO', 'WE BELIEVE', 'BLOCK PARTY', nm + ' FOREVER', 'NO FEAR', 'ONE TEAM ONE DREAM'];
      lines.forEach((txt, i) => {
        const y = (t * 6 + i) * 16, bgc = i % 2 ? k.alt : k.shirt, fg = ink(bgc);
        bc.fillStyle = bgc; bc.fillRect(0, y, 128, 16);
        bc.fillStyle = i % 2 ? k.shirt : k.alt; bc.fillRect(0, y, 128, 2); bc.fillRect(0, y + 14, 128, 2);
        for (let x = 4; x < 128; x += 24) { bc.fillStyle = fg; bc.globalAlpha = 0.25; bc.fillRect(x, y + 6, 3, 3); bc.globalAlpha = 1; }
        const w = pfWidth(txt, 1); pfDraw(bc, txt, Math.floor((128 - w) / 2), y + 5, 1, fg);
      });
    });
    E.bannerTex.needsUpdate = true;
    // posters: 8 designs per club
    const pc = E.posterCv.getContext('2d');
    sides.forEach((s, t) => {
      const k = kit(s), nm = s.short || 'FC';
      for (let d = 0; d < 8; d++) {
        const x = (d % 4) * 32, y = (t * 2 + Math.floor(d / 4)) * 16, white = d % 3 !== 1, bgc = white ? '#f6f3ea' : k.shirt, fg = white ? (hexLum(k.shirt) > 0.7 ? k.alt : k.shirt) : ink(k.shirt);
        pc.fillStyle = '#20222c'; pc.fillRect(x, y, 32, 16); pc.fillStyle = bgc; pc.fillRect(x + 1, y + 1, 30, 14);
        const word = ['GOAL!', '', '10', nm, 'WOW', '', 'GO!', 'OLE'][d];
        if (word) { const w = pfWidth(word, 1); pfDraw(pc, word, x + Math.floor((32 - w) / 2), y + 5, 1, fg); }
        else if (d === 1) { pc.fillStyle = '#ff4d6d'; [[2, 0, 2], [6, 0, 2], [1, 1, 8], [1, 2, 8], [2, 3, 6], [3, 4, 4], [4, 5, 2]].forEach(([dx, dy, ww]) => pc.fillRect(x + 11 + dx, y + 4 + dy, ww, 1)); } // a heart
        else { pc.fillStyle = '#ffcb3d'; [[4, 0, 1], [4, 1, 1], [0, 2, 9], [2, 3, 5], [2, 4, 5], [1, 5, 2], [6, 5, 2]].forEach(([dx, dy, ww]) => pc.fillRect(x + 11 + dx, y + 4 + dy, ww, 1)); } // a star
      }
    });
    E.posterTex.needsUpdate = true;
    // giant flags: halves in the club's colours with its name
    sides.forEach((s, t) => {
      const c = E.flagCv[t], g = c.getContext('2d'), k = kit(s), nm = s.short || 'FC';
      g.fillStyle = k.shirt; g.fillRect(0, 0, 48, 28); g.fillStyle = k.alt; g.fillRect(0, 0, 48, 7); g.fillRect(0, 21, 48, 7);
      const w = pfWidth(nm, 2); pfDraw(g, nm, Math.floor((48 - w) / 2), 9, 2, ink(k.shirt));
      E.flagTex[t].needsUpdate = true;
    });
  },
  buildFloodlights() {
    const T = this.T;
    const { outerX, outerZ } = this.stand;
    const ironMat = new THREE.MeshLambertMaterial({ map: T.iron, vertexColors: true });
    const lampMat = new THREE.MeshBasicMaterial({ map: T.lamp, color: lin('#fff6dc'), toneMapped: false });
    const glowMat = new THREE.SpriteMaterial({ map: T.glow, color: lin('#ffe7b0'), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const H = 30;
    const vb = new VoxBuilder();
    vb.box(-1, 0, -1, 1, H, 1, '#ffffff', { uv: 1, ao: 0.5 });
    vb.box(-4.5, H, -1.2, 4.5, H + 5, 0.4, '#8d92a0', { uv: 1, ao: 0.8 });
    const towerGeo = vb.geometry();
    const lampGeo = new THREE.PlaneGeometry(8, 4.2);
    const la = lampGeo.attributes.uv; for (let i = 0; i < la.count; i++) la.setXY(i, la.getX(i) * 8, la.getY(i) * 4);
    this.lampSprites = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * (outerX + 4), 0, sz * (outerZ + 4));
      g.rotation.y = Math.atan2(-sx, -sz);
      const t = new THREE.Mesh(towerGeo, ironMat); g.add(t);
      const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.set(0, H + 2.5, 0.42); lamp.rotation.x = 0.32; g.add(lamp);
      this.scene.add(g);
      const sp = new THREE.Sprite(glowMat); sp.scale.set(15, 15, 1);
      const wp = new THREE.Vector3(0, H + 2.5, 1.5).applyMatrix4(new THREE.Matrix4().makeRotationY(g.rotation.y)).add(g.position);
      sp.position.copy(wp); this.scene.add(sp); this.lampSprites.push(sp);
    }
  },
  buildTower() {
    const T = this.T;
    const g = new THREE.Group(); g.position.copy(TOWER_POS);
    const glass = this.towerGlass = new THREE.MeshLambertMaterial({ map: T.towerGlass, emissiveMap: T.towerGlow, emissive: lin('#ffffff'), emissiveIntensity: 1.25, vertexColors: true });
    const base = new THREE.MeshLambertMaterial({ map: T.towerStone, vertexColors: true });
    const vb = new VoxBuilder(), vs = new VoxBuilder();
    vs.box(-17, 0, -17, 17, 10, 17, '#ffffff', { uv: 1 });
    vs.box(-13, 10, -13, 13, 13, 13, '#ffffff', { uv: 1 });
    const tiers = [[12, 13, 56], [9, 56, 98], [6.5, 98, 130], [4, 130, 146]];
    for (const [h, y0, y1] of tiers) vb.box(-h, y0, -h, h, y1, h, '#ffffff', { uv: 0.25, ao: 0.8 });
    g.add(vs.mesh(base), vb.mesh(glass));
    const neon = new THREE.MeshBasicMaterial({ color: lin('#5fd2ff'), toneMapped: false });
    const vn = new VoxBuilder();
    for (const [h, y0, y1] of tiers) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) vn.box(sx * h - 0.5, y0, sz * h - 0.5, sx * h + 0.5, y1, sz * h + 0.5, '#ffffff');
      vn.box(-h - 0.6, y1 - 0.8, -h - 0.6, h + 0.6, y1, h + 0.6, '#ffffff', { skip: 'ny' });
    }
    vn.box(-1.5, 146, -1.5, 1.5, 160, 1.5, '#ffffff');
    g.add(vn.mesh(neon));
    const beamMat = new THREE.MeshBasicMaterial({ color: lin('#4fb8ff'), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3, 420, 3), beamMat); beam.position.y = 160 + 210; g.add(beam);
    // orbiting blocks around the crown
    const orbGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    this.orbit = new THREE.InstancedMesh(orbGeo, neon, 10);
    this.orbit.position.y = 120; g.add(this.orbit);
    this.towerGroup = g;
    this.scene.add(g);
  },
  buildTrees() {
    const T = this.T;
    const trunks = new VoxBuilder(), leaves = new VoxBuilder();
    const R = mulberry32(77);
    let placed = 0, tries = 0;
    while (placed < 46 && tries < 500) {
      tries++;
      const a = R() * TAU, r = Math.hypot(this.stand.outerX, this.stand.outerZ) + 13 + R() * 110; // outside the stadium
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      if (Math.hypot(x - TOWER_POS.x, z - TOWER_POS.z) < 34) continue;
      const h = 4 + Math.floor(R() * 4);
      trunks.box(x - 0.5, 0, z - 0.5, x + 0.5, h, z + 0.5, '#ffffff', { uv: 1, ao: 0.6 });
      const w = 2 + Math.floor(R() * 2);
      leaves.box(x - w - 0.5, h - 1, z - w - 0.5, x + w + 0.5, h + 1, z + w + 0.5, '#ffffff', { uv: 1, ao: 0.7 });
      leaves.box(x - w + 0.5, h + 1, z - w + 0.5, x + w - 0.5, h + 2.5, z + w - 0.5, '#ffffff', { uv: 1, ao: 0.8 });
      placed++;
    }
    this.scene.add(trunks.mesh(new THREE.MeshLambertMaterial({ map: T.log, vertexColors: true })));
    this.scene.add(leaves.mesh(new THREE.MeshLambertMaterial({ map: T.leaves, vertexColors: true })));
    // a few stepped hills on the horizon
    const hills = new VoxBuilder(true);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + 0.3, r = 230 + R() * 60;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const steps = 3 + Math.floor(R() * 4);
      for (let s = 0; s < steps; s++) {
        const half = (steps - s) * 9 + R() * 6;
        hills.box(cx - half, s * 4, cz - half * 0.8, cx + half, (s + 1) * 4, cz + half * 0.8, '#ffffff', { uv: 0.25, ao: 0.75 });
      }
    }
    this.scene.add(hills.mesh([new THREE.MeshLambertMaterial({ map: T.grassTop, vertexColors: true }), new THREE.MeshLambertMaterial({ map: T.grassSide, vertexColors: true }), new THREE.MeshLambertMaterial({ map: T.dirt, vertexColors: true })]));
  },
  buildClouds() {
    const R = mulberry32(2024);
    const boxes = [];
    for (let c = 0; c < 22; c++) {
      const a = R() * TAU, r = 160 + R() * 300, y = 85 + R() * 60;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const nb = 5 + Math.floor(R() * 8);
      for (let b = 0; b < nb; b++) boxes.push([cx + (R() - 0.5) * 34, y + (R() < 0.3 ? 4 : 0), cz + (R() - 0.5) * 22, 10 + R() * 12, 4 + R() * 3, 8 + R() * 10]);
    }
    const mat = this.cloudMat = new THREE.MeshLambertMaterial({ color: lin('#ffffff'), emissive: lin('#c86c7a'), emissiveIntensity: 0.55 });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, boxes.length);
    const m = new THREE.Matrix4();
    boxes.forEach((b, i) => { m.makeScale(b[3], b[4], b[5]); m.setPosition(b[0], b[1], b[2]); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true;
    this.clouds = im;
    this.scene.add(im);
  },
  update(dt) {
    this.time += dt;
    const cam = this.camera;
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
    _v1.copy(SUN_DIR).multiplyScalar(540).add(cam.position);
    this.sunMesh.position.copy(_v1); this.sunMesh.lookAt(cam.position);
    _v1.copy(SUN_DIR).multiplyScalar(560).add(cam.position);
    this.sunHalo.position.copy(_v1); this.sunHalo.lookAt(cam.position);
    this.clouds.rotation.y += dt * 0.0035;
    this.excite[0] = Math.max(0, this.excite[0] - dt * 0.22);
    this.excite[1] = Math.max(0, this.excite[1] - dt * 0.22);
    if (this.fanMat) { this.fanMat.uniforms.uTime.value = this.time; this.fanMat.uniforms.uExcite.value.set(this.excite[0], this.excite[1]); }
    if (this.rain && this.rain.visible) { this.rainMat.uniforms.uTime.value = this.time; this.rainMat.uniforms.uCam.value.copy(cam.position); }
    if (this.extras) {
      const E = this.extras;
      E.flagMat.forEach((fm) => { fm.uniforms.uTime.value = this.time; });
      E.flashMat.uniforms.uTime.value = this.time; E.flashMat.uniforms.uFlash.value = Math.max(this.excite[0], this.excite[1]);
      E.flashMat.uniforms.uScale.value = this.renderer.domElement.height * 0.5 / Math.tan(this.camera.fov * Math.PI / 360);
    }
    const cp = cam.position;
    for (const n of this.nets) {
      // owner: the net is always there and always solid (fading it backfired); the keeper camera stays in front of the frame instead
      const i = n.s > 0 ? 0 : 1;
      this.netBulge[i] = damp(this.netBulge[i], 0, 5, dt);
      n.back.position.z = n.baseZ + n.s * this.netBulge[i] * 0.9;
    }
    if (this.orbit) {
      const t = this.time * 0.25;
      for (let i = 0; i < 10; i++) {
        const a = t + i / 10 * TAU;
        _m1.makeRotationY(a * 2); _m1.setPosition(Math.cos(a) * 18, Math.sin(a * 3 + i) * 4, Math.sin(a) * 18);
        this.orbit.setMatrixAt(i, _m1);
      }
      this.orbit.instanceMatrix.needsUpdate = true;
    }
    if (this.lampSprites.length) this.lampSprites[0].material.opacity = (0.36 + Math.sin(this.time * 1.7) * 0.03) * (this.lampGlow == null ? 1 : this.lampGlow); // floodlights glow less by day
  },
  /** dress the stands for a match: seats in each club's crest colour, fans in their club's home shirts */
  /** owner: "add some net variety": the goal nets' pattern and colour (each match picks one, paintCrowd) */
  setNet(kind, hex) {
    const tex = this.T.net, c = tex.image, g = c.getContext('2d'), col = hexRGB(hex || '#eef0f4'), img = g.createImageData(16, 16), d = img.data;
    const on = {
      classic: (x, y) => x % 4 === 0 || y % 4 === 0,
      diamond: (x, y) => (x + y) % 4 === 0 || (x - y + 16) % 4 === 0,
      hex: (x, y) => { const r = Math.floor(y / 4), ox = (r % 2) * 2; return (y % 4 === 0 && (x + ox) % 4 !== 2) || (x + ox) % 4 === 0 && y % 4 !== 0; },
      big: (x, y) => x % 8 < 2 || y % 8 < 2,
      fine: (x, y) => x % 2 === 0 || y % 2 === 0,
    }[kind] || ((x, y) => x % 4 === 0 || y % 4 === 0);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4, v = on(x, y); d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = v ? 255 : 0; }
    g.putImageData(img, 0, 0); tex.needsUpdate = true;
    this.netKind = kind; this.netHex = hex || '#eef0f4';
  },
  paintCrowd(a, b) {
    const sides = [a, b];
    this.setNet('classic', '#eef0f4'); // owner: the other net styles looked bad: the classic white net
    repaintSeat(this.T.seatHome, a.crest[0]); repaintSeat(this.T.seatAway, b.crest[0]);
    const pals = sides.map((s) => { const k = CLUBS[s.club].home; return [k.shirt, k.shirt, k.alt, k.sleeve, k.shirt].map((h) => lin(h)); });
    const geo = this.fans.geometry, col = geo.attributes.aColor, data = geo.attributes.aData, R = mulberry32(9);
    for (let i = 0; i < this.fanCount; i++) {
      const c = pals[data.getY(i) > 0.5 ? 1 : 0][Math.floor(R() * 5)], k = lerp(0.82, 1.04, R());
      col.setXYZ(i, c.r * k, c.g * k, c.b * k);
    }
    col.needsUpdate = true;
    this.paintCrowdExtras(a, b);
  },
  /** the stadium for a rank tier: how full it is, the upper deck from Gold up, and how loud */
  setTier(tier) {
    this.tier = tier;
    const n = Math.round(this.fanCount * TIER_FANS[tier]);
    this.fans.count = n;
    this.upper.visible = tier >= 3;
    if (this.roofLow) { this.roofLow.visible = !this.upper.visible; this.roofHigh.visible = this.upper.visible; }
    if (!this.upper.visible) this.fans.count = Math.min(n, this.lowerFans);
    if (this.extras) { // only fans who came hold posters and take photos
      const c = this.fans.count, E = this.extras, upTo = (A) => { let k = 0; while (k < A.length && A[k] < c) k++; return k; };
      E.posters.count = upTo(E.posterIdx); E.flashes.geometry.setDrawRange(0, upTo(E.flashIdx));
    }
    Sfx.setLoud(TIER_LOUD[tier]);
  },
  setSun(dir) { this.sunRef = dir; SUN_DIR.copy(dir); if (this.sky) this.sky.material.uniforms.sunDir.value.copy(dir); },
  /** day or sunset: sky, sun, fog, lights, clouds, crowd, tower and floodlights */
  setLook(id) {
    const L = LOOKS[id] || LOOKS.day; this.look = LOOKS[id] ? id : 'day';
    const u = this.sky.material.uniforms;
    ['cTop', 'cMid', 'cLow', 'cHor', 'cBot', 'sunCol'].forEach((k, i) => u[k].value.copy(lin(L.sky[i])));
    this.sunMesh.material.color.copy(lin(L.sun)); this.sunHalo.material.color.copy(lin(L.halo[0])); this.sunHalo.material.opacity = L.halo[1];
    this.stars.visible = L.stars;
    const f = this.scene.fog; f.color.copy(lin(L.fog[0])); f.near = L.fog[1]; f.far = L.fog[2];
    this.hemi.color.copy(lin(L.hemi[0])); this.hemi.groundColor.copy(lin(L.hemi[1])); this.hemi.intensity = L.hemi[2];
    this.amb.color.copy(lin(L.amb[0])); this.amb.intensity = L.amb[1];
    this.sun.color.copy(lin(L.light[0])); this.sun.intensity = L.light[1]; this.sun.position.set(L.light[2][0], L.light[2][1], L.light[2][2]);
    this.fill.color.copy(lin(L.fill[0])); this.fill.intensity = L.fill[1];
    this.renderer.toneMappingExposure = L.exposure;
    if (this.weather === 'rain') { f.color.lerp(lin('#6f7888'), 0.6); f.near *= 0.55; f.far *= 0.6; this.sun.intensity = L.light[1] * 0.6; this.hemi.intensity = L.hemi[2] * 0.85; this.renderer.toneMappingExposure = L.exposure * 0.92; } // rain: a greyer, closer world
    this.cloudMat.emissive.copy(lin(L.cloud[0])); this.cloudMat.emissiveIntensity = L.cloud[1];
    this.fanMat.uniforms.uLight.value.set(L.fans[0], L.fans[1], L.fans[2]);
    this.towerGlass.emissiveIntensity = L.tower;
    this.lampGlow = L.lamps;
    SUN_MATCH.set(L.sunMatch[0], L.sunMatch[1], L.sunMatch[2]).normalize(); SUN_LOBBY.set(L.sunLobby[0], L.sunLobby[1], L.sunLobby[2]).normalize();
    this.setSun(this.sunRef || SUN_MATCH);
  },
  /* camera effects for HIGH and ULTRA (owner, Nov 2026: "the graphics are too low ... like GTA 6, I know it is not possible
     but try"): the scene is drawn into a texture, then bright things bloom (a soft glow from floodlights, the sun, white
     kits, flashes), the colours get a little richer (more contrast and colour, warm highlights, cool shadows) and the edges
     darken slightly. three r128 tone maps and sRGB-encodes into the texture itself (its encoding is sRGB), so the passes
     work on the finished picture and write it straight out. WebGL2 keeps antialiasing (a multisampled target) */
  initPost() {
    if (this.post) return true;
    try {
      const r = this.renderer, ms = r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget;
      const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
      const rt = (w, h, depth) => { const t = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: !!depth }, opt)); t.texture.encoding = THREE.sRGBEncoding; t.texture.generateMipmaps = false; return t; };
      const sceneRT = ms ? new THREE.WebGLMultisampleRenderTarget(4, 4, Object.assign({ depthBuffer: true }, opt)) : rt(4, 4, true);
      if (ms) sceneRT.samples = 4;
      sceneRT.texture.encoding = THREE.sRGBEncoding; sceneRT.texture.generateMipmaps = false;
      const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const mat = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false });
      const bright = mat(['uniform sampler2D tIn; varying vec2 vUv;', 'void main(){ vec3 c = texture2D(tIn, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));',
        ' gl_FragColor = vec4(c * smoothstep(0.9, 1.0, l), 1.0); }'].join('\n'), { tIn: { value: null } });
      const blur = mat(['uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;', 'void main(){',
        ' vec3 c = texture2D(tIn, vUv).rgb * 0.227;',
        ' c += (texture2D(tIn, vUv + uDir * 1.385).rgb + texture2D(tIn, vUv - uDir * 1.385).rgb) * 0.316;',
        ' c += (texture2D(tIn, vUv + uDir * 3.231).rgb + texture2D(tIn, vUv - uDir * 3.231).rgb) * 0.07;',
        ' gl_FragColor = vec4(c, 1.0); }'].join('\n'), { tIn: { value: null }, uDir: { value: new THREE.Vector2() } });
      const comp = mat(['uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uGrade; varying vec2 vUv;', 'void main(){',
        ' vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;',
        ' float l = dot(c, vec3(0.299, 0.587, 0.114));',
        ' c = mix(vec3(l), c, 1.05 + 0.04 * uGrade);', // a little more colour
        ' c = (c - 0.5) * (1.03 + 0.03 * uGrade) + 0.5 - 0.02;', // a little more contrast, a touch darker (owner: it looked like a flash bang)
        ' c += vec3(0.022, 0.008, -0.018) * smoothstep(0.45, 1.0, l) - vec3(0.012, 0.0, -0.016) * (1.0 - smoothstep(0.0, 0.45, l));', // warm highlights, cool shadows
        ' vec2 q = vUv - 0.5; c *= 1.0 - (0.2 + 0.08 * uGrade) * smoothstep(0.3, 0.85, dot(q, q) * 2.2);', // a soft vignette
        ' gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }'].join('\n'), { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.22 }, uGrade: { value: 0 } });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); quad.frustumCulled = false;
      const qScene = new THREE.Scene(); qScene.add(quad);
      this.post = { sceneRT, a: rt(4, 4), b: rt(4, 4), c: rt(4, 4), bright, blur, comp, quad, qScene, qCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), w: 0, h: 0, sz: new THREE.Vector2() };
      return true;
    } catch (e) { this.post = null; return false; } // no camera effects on this device; the plain picture still works
  },
  render() {
    const r = this.renderer, P = this.post;
    if (!this.postOn || !P) { r.render(this.scene, this.camera); return; }
    const sz = r.getDrawingBufferSize(P.sz), w = Math.max(4, sz.x | 0), h = Math.max(4, sz.y | 0);
    if (P.w !== w || P.h !== h) { P.w = w; P.h = h; P.sceneRT.setSize(w, h); P.a.setSize(w >> 1, h >> 1); P.b.setSize(w >> 2, h >> 2); P.c.setSize(w >> 2, h >> 2); }
    const pass = (m, target) => { P.quad.material = m; r.setRenderTarget(target); r.render(P.qScene, P.qCam); };
    r.setRenderTarget(P.sceneRT); r.render(this.scene, this.camera);
    P.bright.uniforms.tIn.value = P.sceneRT.texture; pass(P.bright, P.a); // the bright parts, at half size
    const bw = P.b.width, bh = P.b.height, U = P.blur.uniforms;
    U.tIn.value = P.a.texture; U.uDir.value.set(1 / bw, 0); pass(P.blur, P.b); // a wide soft blur at quarter size, twice
    U.tIn.value = P.b.texture; U.uDir.value.set(0, 1 / bh); pass(P.blur, P.c);
    U.tIn.value = P.c.texture; U.uDir.value.set(2 / bw, 0); pass(P.blur, P.b);
    U.tIn.value = P.b.texture; U.uDir.value.set(0, 2 / bh); pass(P.blur, P.c);
    const C = P.comp.uniforms; C.tScene.value = P.sceneRT.texture; C.tBloom.value = P.c.texture; C.uGrade.value = this.postGrade;
    pass(P.comp, null);
  },
};
