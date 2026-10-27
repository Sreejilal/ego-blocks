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
  med: { pr: 1, shadows: true, map: 1024 },
  high: { pr: 1.5, shadows: true, map: 2048 },
};

const World = {
  renderer: null, scene: null, camera: null, T: null, quality: 'med', time: 0,
  excite: [0, 0], netBulge: [0, 0], fanMat: null,
  init(canvas) {
    const q = Save.data.settings.quality;
    const r = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance', stencil: false });
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
    this.buildFloodlights();
    this.buildTower();
    this.buildTrees();
    this.buildClouds();
    this.setQuality(q === 'auto' ? 'med' : q);
    this.resize();
  },
  setQuality(q) {
    if (!QUALITY[q]) q = 'med';
    this.quality = q;
    const Q = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    this.renderer.shadowMap.enabled = Q.shadows;
    this.sun.castShadow = Q.shadows;
    if (this.sun.shadow.mapSize.x !== Q.map) {
      this.sun.shadow.mapSize.set(Q.map, Q.map);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    this.resize();
  },
  resize() {
    const w = window.innerWidth || 800, h = window.innerHeight || 600;
    this.renderer.setSize(w, h, false);
    const a = w / h;
    this.camera.aspect = a;
    // a phone held upright gets a taller field of view so the sides of the pitch stay in shot
    this.camera.fov = a >= 1 ? 68 : Math.min(96, 68 + (1 - a) * 52);
    this.camera.updateProjectionMatrix();
  },
  buildLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(lin('#8d96e6'), lin('#5a4630'), 0.62);
    s.add(this.hemi);
    const amb = new THREE.AmbientLight(lin('#2c3466'), 0.35); s.add(amb);
    const sun = new THREE.DirectionalLight(lin('#ffb27a'), 1.35);
    sun.position.set(-58, 72, -34);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 20; sc.far = 220;
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
    this.scene.add(pitch);
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
    const mkNet = (w, h, uw, uh) => { const g = new THREE.PlaneGeometry(w, h); const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uw, a.getY(i) * uh); return new THREE.Mesh(g, netMat); };
    for (const s of [1, -1]) {
      const grp = new THREE.Group();
      const backNet = mkNet(gw * 2, gh, gw * 2, gh); backNet.position.set(0, gh / 2, s * (back - P / 2)); grp.add(backNet);
      const top = mkNet(gw * 2, F.GD - P, gw * 2, F.GD - P); top.rotation.x = -Math.PI / 2; top.position.set(0, gh + P / 2, s * (L + (F.GD - P) / 2)); grp.add(top);
      for (const sx of [1, -1]) { const side = mkNet(F.GD - P, gh, F.GD - P, gh); side.rotation.y = Math.PI / 2; side.position.set(sx * (gw + P / 2), gh / 2, s * (L + (F.GD - P) / 2)); grp.add(side); }
      this.scene.add(grp);
      this.nets.push({ s, back: backNet, baseZ: backNet.position.z });
    }
  },
  buildStands() {
    const T = this.T;
    const ROWS = 7, DEP = 1.6, RISE = 1.0, BASE = 1.3;
    this.standRows = { ROWS, DEP, RISE, BASE };
    const blue = new VoxBuilder(true), orange = new VoxBuilder(true);
    const sideIn = 26, endIn = 39.5, sideLen = 37, endLen = 26;
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
    const outerX = sideIn + ROWS * DEP, outerZ = endIn + ROWS * DEP, wallTop = BASE + ROWS * RISE + 1.4;
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
    this.fanMat = mat; this.fans = im; this.fanCount = n;
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
    const glass = new THREE.MeshLambertMaterial({ map: T.towerGlass, emissiveMap: T.towerGlow, emissive: lin('#ffffff'), emissiveIntensity: 1.25, vertexColors: true });
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
      const a = R() * TAU, r = 75 + R() * 120;
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
    const mat = new THREE.MeshLambertMaterial({ color: lin('#ffffff'), emissive: lin('#c86c7a'), emissiveIntensity: 0.55 });
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
    for (const n of this.nets) {
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
    if (this.lampSprites.length) this.lampSprites[0].material.opacity = 0.36 + Math.sin(this.time * 1.7) * 0.03;
  },
  /** dress the stands for a match: seats in each club's crest colour, fans in their club's home shirts */
  paintCrowd(a, b) {
    const sides = [a, b];
    repaintSeat(this.T.seatHome, a.crest[0]); repaintSeat(this.T.seatAway, b.crest[0]);
    const pals = sides.map((s) => { const k = CLUBS[s.club].home; return [k.shirt, k.shirt, k.alt, k.sleeve, k.shirt].map((h) => lin(h)); });
    const geo = this.fans.geometry, col = geo.attributes.aColor, data = geo.attributes.aData, R = mulberry32(9);
    for (let i = 0; i < this.fanCount; i++) {
      const c = pals[data.getY(i) > 0.5 ? 1 : 0][Math.floor(R() * 5)], k = lerp(0.82, 1.04, R());
      col.setXYZ(i, c.r * k, c.g * k, c.b * k);
    }
    col.needsUpdate = true;
  },
  setSun(dir) { SUN_DIR.copy(dir); if (this.sky) this.sky.material.uniforms.sunDir.value.copy(dir); },
  render() { this.renderer.render(this.scene, this.camera); },
};
