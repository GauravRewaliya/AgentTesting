import * as THREE from "three";

// Minecraft-style voxel island: 32x32 columns, cube coordinates are integers
// (cube centre at integer x,y,z, size 1). Land column of height h has its top face at y = h + 0.5.

const SIZE = 32, HALF = 16, WATER_TOP = 0.5;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function makeTex(draw) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  draw(g, rng(7 + draw.length));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(g, r, palette, rows = 16) {
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < 16; x++) {
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.fillRect(x, y, 1, 1);
    }
}

const GREEN = ["#5fa83a", "#6bb642", "#549932", "#4f9230", "#7cc84e"];
const DIRT = ["#8a5a35", "#7b4e2c", "#96663d", "#6e4526", "#835430"];
const STONE = ["#8d8d8d", "#7f7f7f", "#9a9a9a", "#707070", "#868686"];

function buildTextures() {
  const grassTop = makeTex((g, r) => speckle(g, r, GREEN));
  const dirt = makeTex((g, r) => speckle(g, r, DIRT));
  const stone = makeTex((g, r) => {
    speckle(g, r, STONE);
    g.fillStyle = "#5d5d5d";
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
  });
  const grassSide = makeTex((g, r) => {
    speckle(g, r, DIRT);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
      for (let y = 0; y < depth; y++) {
        g.fillStyle = GREEN[Math.floor(r() * GREEN.length)];
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  const path = makeTex((g, r) => {
    speckle(g, r, ["#b9b4a6", "#aaa597", "#c4bfb1", "#9f9a8c"]);
    g.fillStyle = "#6f6b60";
    for (let i = 0; i < 16; i++) { g.fillRect(i, 0, 1, 1); g.fillRect(i, 8, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(8, i, 1, 1); }
  });
  const water = makeTex((g, r) => {
    speckle(g, r, ["#2f6fd0", "#3478da", "#2a66c4", "#3a82e2"]);
    g.fillStyle = "#8fc4ff";
    for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 2, 1);
  });
  return { grassTop, dirt, stone, grassSide, path, water };
}

export function createWorld(scene) {
  const tex = buildTextures();
  const lam = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });

  // ---------- terrain heights ----------
  const heights = new Int8Array(SIZE * SIZE);
  const isPath = new Uint8Array(SIZE * SIZE);
  const idx = (i, j) => j * SIZE + i;
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) {
      const x = i - HALF, z = j - HALF;
      const d = 0.5 * Math.max(Math.abs(x), Math.abs(z)) + 0.5 * Math.hypot(x, z);
      const n = vnoise(x * 0.35 + 40, z * 0.35 + 40);
      let h = 0;
      if (d < 14.3 + n * 2.2) {
        h = 1 + Math.round(2.4 * Math.min(1, Math.max(0, (13 - d) / 8)) + (n - 0.5) * 1.6);
        h = Math.max(1, Math.min(4, h));
      }
      if (Math.abs(x) <= 5 && Math.abs(z) <= 5) h = 3; // flat plateau for the pagoda
      heights[idx(i, j)] = h;
    }
  // stone path from the shore to the pagoda
  for (let z = 5; z <= 15; z++) {
    const i = HALF, j = z + HALF;
    if (heights[idx(i, j)] > 0) isPath[idx(i, j)] = 1;
  }

  function heightAt(x, z) {
    const i = Math.round(x) + HALF, j = Math.round(z) + HALF;
    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return WATER_TOP;
    const h = heights[idx(i, j)];
    return h > 0 ? h + 0.5 : WATER_TOP;
  }

  // ---------- instanced terrain ----------
  const box = new THREE.BoxGeometry(1, 1, 1);
  const grassMats = [tex.grassSide, tex.grassSide, tex.grassTop, tex.dirt, tex.grassSide, tex.grassSide].map((m) => lam(m));
  const dirtMat = lam(tex.dirt);
  const stoneMat = lam(tex.stone);
  const pathMat = lam(tex.path);

  const lists = { grass: [], dirt: [], stone: [], path: [] };
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) {
      const h = heights[idx(i, j)];
      if (!h) continue;
      const x = i - HALF, z = j - HALF;
      for (let y = 0; y <= h; y++) {
        if (y === h) (isPath[idx(i, j)] ? lists.path : lists.grass).push([x, y, z]);
        else if (y >= h - 2) lists.dirt.push([x, y, z]);
        else lists.stone.push([x, y, z]);
      }
    }
  const dummy = new THREE.Object3D();
  function instanced(mat, list, shadowCast = true) {
    const m = new THREE.InstancedMesh(box, mat, list.length);
    list.forEach((p, k) => { dummy.position.set(p[0], p[1], p[2]); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    m.castShadow = shadowCast;
    m.receiveShadow = true;
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
    return m;
  }
  instanced(grassMats, lists.grass);
  instanced(dirtMat, lists.dirt);
  instanced(stoneMat, lists.stone);
  instanced(pathMat, lists.path);

  // ---------- water ----------
  const wl = [];
  for (let z = -42; z <= 42; z++)
    for (let x = -42; x <= 42; x++) {
      const i = x + HALF, j = z + HALF;
      if (i >= 0 && j >= 0 && i < SIZE && j < SIZE && heights[idx(i, j)] > 0) continue;
      wl.push([x, 0, z]);
    }
  const waterMat = lam(tex.water, { transparent: true, opacity: 0.78, depthWrite: false });
  const water = instanced(waterMat, wl, false);
  water.renderOrder = 1;
  const deep = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400), new THREE.MeshLambertMaterial({ color: 0x1b3f7a }));
  deep.position.y = -1;
  deep.receiveShadow = true;
  scene.add(deep);

  // ---------- pagoda + torii (coloured blocks) ----------
  const C = { red: 0xb8322a, white: 0xf2ead8, roof: 0x3b2f33, gold: 0xd9a441, black: 0x1a1a1a, stone: 0x9a9a9a, stone2: 0x858585, wood: 0x6b4423 };
  const blocks = [];
  const put = (x, y, z, c) => blocks.push([x, y, z, c]);
  const base = Math.round(heightAt(0, 0) - 0.5); // plateau height
  let y = base + 1;
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) put(x, y, z, (x + z) & 1 ? C.stone : C.stone2);
  y++;
  const tiers = [{ half: 3, wall: 3 }, { half: 2, wall: 2 }, { half: 1, wall: 2 }];
  tiers.forEach((t, ti) => {
    for (let k = 0; k < t.wall; k++, y++) {
      for (let x = -t.half; x <= t.half; x++)
        for (let z = -t.half; z <= t.half; z++) {
          if (Math.abs(x) !== t.half && Math.abs(z) !== t.half) continue;
          if (ti === 0 && z === t.half && x === 0 && k < 2) continue; // door
          const corner = Math.abs(x) === t.half && Math.abs(z) === t.half;
          put(x, y, z, corner || k === t.wall - 1 ? C.red : C.white);
        }
    }
    const rh = t.half + 1;
    for (let x = -rh; x <= rh; x++) for (let z = -rh; z <= rh; z++) put(x, y, z, C.roof);
    for (const sx of [-rh, rh]) for (const sz of [-rh, rh]) put(sx, y + 1, sz, C.gold);
    y++;
    for (let x = -t.half; x <= t.half; x++) for (let z = -t.half; z <= t.half; z++) put(x, y, z, C.roof);
    y++;
  });
  for (let k = 0; k < 3; k++) put(0, y + k, 0, C.gold);

  // torii gate on the path
  const tz = 11;
  for (const tx of [-2, 2]) {
    const g = Math.round(heightAt(tx, tz) - 0.5);
    for (let k = 1; k <= 5; k++) put(tx, g + k, tz, C.red);
  }
  const ty = Math.round(Math.max(heightAt(-2, tz), heightAt(2, tz)) - 0.5);
  for (let x = -2; x <= 2; x++) put(x, ty + 4, tz, C.red); // nuki
  for (let x = -3; x <= 3; x++) { put(x, ty + 6, tz, C.black); }
  for (let x = -2; x <= 2; x++) put(x, ty + 5, tz, C.black);
  put(0, ty + 7, tz, C.black);
  // stone lanterns beside the path
  for (const [lx, lz] of [[-2, 7], [2, 7]]) {
    const g = Math.round(heightAt(lx, lz) - 0.5);
    put(lx, g + 1, lz, C.stone); put(lx, g + 2, lz, C.stone2); put(lx, g + 3, lz, 0xffd27a); put(lx, g + 4, lz, C.stone);
  }

  const bm = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), blocks.length);
  const col = new THREE.Color();
  blocks.forEach((b, k) => {
    dummy.position.set(b[0], b[1], b[2]); dummy.updateMatrix();
    bm.setMatrixAt(k, dummy.matrix);
    col.setHex(b[3]).multiplyScalar(0.92 + hash2(b[0] * 7 + b[1], b[2] * 3 + b[1]) * 0.1);
    bm.setColorAt(k, col);
  });
  bm.castShadow = bm.receiveShadow = true;
  bm.instanceMatrix.needsUpdate = true;
  bm.instanceColor.needsUpdate = true;
  scene.add(bm);

  // ---------- sun ----------
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false });
  const sun = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), sunMat);
  scene.add(sun);

  // ---------- clouds ----------
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cbox = new THREE.BoxGeometry(1, 1, 1);
  const clouds = [];
  const cr = rng(99);
  for (let n = 0; n < 9; n++) {
    const grp = new THREE.Group();
    const pieces = 6 + Math.floor(cr() * 6);
    for (let p = 0; p < pieces; p++) {
      const m = new THREE.Mesh(cbox, cloudMat);
      m.scale.set(4 + Math.floor(cr() * 4), 1.6 + (cr() < 0.3 ? 1.6 : 0), 4 + Math.floor(cr() * 3));
      m.position.set((p % 4) * 4 - 6 + cr() * 2, (cr() < 0.25 ? 1.2 : 0), Math.floor(p / 4) * 4 - 3 + cr() * 2);
      grp.add(m);
    }
    grp.position.set(-80 + cr() * 160, 30 + cr() * 8, -70 + cr() * 140);
    grp.userData.speed = 1.2 + cr() * 1.6;
    scene.add(grp);
    clouds.push(grp);
  }

  // ---------- lights / sky ----------
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b8f4a, 0.7);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff4e0, 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
  dir.shadow.bias = -0.0006;
  dir.shadow.normalBias = 0.03;
  scene.add(dir, dir.target);
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x9fd6f0, 55, 170);

  const MODES = {
    day: {
      sky: new THREE.Color(0x87ceeb), fog: new THREE.Color(0xa8d8ef), hemiSky: new THREE.Color(0xbfe3ff), hemiGround: new THREE.Color(0x6b8f4a),
      hemiI: 0.75, dirC: new THREE.Color(0xfff4e0), dirI: 2.1, sunC: new THREE.Color(0xfff1a8), cloud: new THREE.Color(0xffffff),
      sunDir: new THREE.Vector3(0.35, 0.9, 0.28).normalize(),
    },
    sunset: {
      sky: new THREE.Color(0xf0805a), fog: new THREE.Color(0xe8946e), hemiSky: new THREE.Color(0xffb3a0), hemiGround: new THREE.Color(0x5a4a6a),
      hemiI: 0.5, dirC: new THREE.Color(0xff8f45), dirI: 1.5, sunC: new THREE.Color(0xff6a2e), cloud: new THREE.Color(0xffb890),
      sunDir: new THREE.Vector3(0.9, 0.17, 0.3).normalize(),
    },
  };
  const cur = {
    sky: MODES.day.sky.clone(), fog: MODES.day.fog.clone(), hemiSky: MODES.day.hemiSky.clone(), hemiGround: MODES.day.hemiGround.clone(),
    hemiI: MODES.day.hemiI, dirC: MODES.day.dirC.clone(), dirI: MODES.day.dirI, sunC: MODES.day.sunC.clone(), cloud: MODES.day.cloud.clone(),
    sunDir: MODES.day.sunDir.clone(),
  };
  let target = MODES.day;

  function apply() {
    scene.background.copy(cur.sky);
    scene.fog.color.copy(cur.fog);
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiI;
    dir.color.copy(cur.dirC); dir.intensity = cur.dirI;
    sunMat.color.copy(cur.sunC);
    cloudMat.color.copy(cur.cloud);
    const d = cur.sunDir.clone().normalize();
    sun.position.copy(d).multiplyScalar(95);
    sun.lookAt(0, 0, 0);
    dir.position.copy(d).multiplyScalar(70);
    dir.target.position.set(0, 0, 0);
  }
  apply();

  function setTime(mode) {
    target = MODES[mode] || MODES.day;
  }

  function update(t, dt) {
    dt = Math.min(dt || 0.016, 0.1);
    const k = 1 - Math.exp(-dt * 1.4);
    cur.sky.lerp(target.sky, k); cur.fog.lerp(target.fog, k);
    cur.hemiSky.lerp(target.hemiSky, k); cur.hemiGround.lerp(target.hemiGround, k);
    cur.dirC.lerp(target.dirC, k); cur.sunC.lerp(target.sunC, k); cur.cloud.lerp(target.cloud, k);
    cur.hemiI += (target.hemiI - cur.hemiI) * k;
    cur.dirI += (target.dirI - cur.dirI) * k;
    cur.sunDir.lerp(target.sunDir, k);
    apply();
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 95) c.position.x = -95;
    }
    tex.water.offset.x = (t * 0.03) % 1;
    tex.water.offset.y = Math.sin(t * 0.4) * 0.05;
  }

  return { update, heightAt, setTime };
}
