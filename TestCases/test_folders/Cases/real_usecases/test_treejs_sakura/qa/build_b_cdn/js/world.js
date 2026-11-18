import * as THREE from 'three';

// Deterministic RNG so the world looks the same every load
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Small pixelated canvas texture (16x16, NearestFilter)
function tex(base, vary, kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const col = new THREE.Color(base);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = 1 + (rnd() - 0.5) * vary;
    let r = col.r * k, gg = col.g * k, b = col.b * k;
    if (kind === 'side' && y < 4) { r = 0.36 * k; gg = 0.65 * k; b = 0.25 * k; }
    if (kind === 'leaf' && rnd() < 0.12) { r = gg = b = 1; }
    g.fillStyle = `rgb(${Math.min(255, r * 255) | 0},${Math.min(255, gg * 255) | 0},${Math.min(255, b * 255) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();

// Build an InstancedMesh from [{x,y,z,color?,sx?,sy?,sz?}]
function voxels(list, material, geo = BOX, shadow = true) {
  const m = new THREE.InstancedMesh(geo, material, list.length);
  const col = new THREE.Color();
  list.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (p.color !== undefined) m.setColorAt(i, col.set(p.color));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function createWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const mat = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
  const dirtTex = tex(0x8a5a35, 0.3);
  const grassTop = tex(0x5fae3e, 0.28);
  const grassSide = tex(0x8a5a35, 0.3, 'side');
  const grassMats = [grassSide, grassSide, grassTop, mat(dirtTex).map, grassSide, grassSide]
    .map(t => mat(t));
  const dirtMat = mat(dirtTex);
  const stoneMat = mat(tex(0x9a9a9a, 0.3));
  const logMat = mat(tex(0x5a3a28, 0.35));
  const leafMat = mat(tex(0xffffff, 0.12, 'leaf'), { transparent: false });
  const waterMat = new THREE.MeshLambertMaterial({ map: tex(0x2f7be0, 0.2), transparent: true, opacity: 0.82 });

  // ---- Ground 32x32 with a pond ----
  const pond = { x0: -4, x1: 1, z0: 1, z1: 6 };
  const inPond = (x, z) => x >= pond.x0 && x <= pond.x1 && z >= pond.z0 && z <= pond.z1;
  const grass = [], dirt = [], water = [];
  for (let x = -16; x < 16; x++) for (let z = -16; z < 16; z++) {
    const tint = new THREE.Color().setHSL(0.27 + (rnd() - 0.5) * 0.03, 0.2, 0.85 + rnd() * 0.15);
    if (inPond(x, z)) {
      dirt.push({ x, y: -1.5, z, color: 0xcccccc });
      water.push({ x, y: -0.6, z, sy: 0.8 });
    } else {
      grass.push({ x, y: -0.5, z, color: tint.getHex() });
      dirt.push({ x, y: -1.5, z });
    }
  }
  // pond rim: dirt shore blocks one row below the grass are already there; add depth
  root.add(voxels(grass, grassMats));
  root.add(voxels(dirt, dirtMat, BOX, false));
  const waterMesh = voxels(water, waterMat, BOX, false);
  waterMesh.castShadow = false;
  root.add(waterMesh);

  // ---- Path of stone slabs along x=5 and a branch to the pond ----
  const path = [];
  for (let z = -13; z <= 13; z++) {
    const shade = 0x8a8a8a + ((rnd() * 24) | 0) * 0x010101;
    path.push({ x: 5, y: 0.05, z, sy: 0.1, color: shade });
    if (z % 3 !== 0) path.push({ x: 6, y: 0.05, z, sy: 0.1, color: shade - 0x101010 });
  }
  for (let x = 2; x <= 4; x++) path.push({ x, y: 0.05, z: 3, sy: 0.1, color: 0x9a9a9a });
  root.add(voxels(path, stoneMat, BOX, false));

  // ---- Stone lanterns ----
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffd877 });
  function lantern(x, z) {
    const base = [
      { x, y: 0.5, z, sx: 0.9, sz: 0.9 },
      { x, y: 1.25, z, sx: 0.5, sz: 0.5, sy: 0.5 },
      { x, y: 2.5, z, sx: 1.5, sy: 0.4, sz: 1.5 },
      { x, y: 2.85, z, sx: 0.8, sy: 0.3, sz: 0.8 },
    ];
    root.add(voxels(base, stoneMat));
    const light = new THREE.Mesh(BOX, lanternMat);
    light.position.set(x, 1.85, z);
    light.scale.set(0.8, 0.8, 0.8);
    root.add(light);
  }
  lantern(3.7, -4); lantern(7.3, 3); lantern(-5.5, -1); lantern(3.7, 9);

  // ---- Sakura trees ----
  const pinks = [0xffc1d9, 0xffa6c9, 0xf78fb3, 0xffd9e8, 0xffb7d1];
  const trees = [];
  function tree(x, z, h) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const logs = [];
    for (let y = 0; y < h; y++) logs.push({ x: 0, y: y + 0.5, z: 0 });
    // forked branches
    logs.push({ x: 1, y: h - 0.5, z: 0 }, { x: -1, y: h - 1.5, z: 0 }, { x: 0, y: h - 1.5, z: 1 });
    logs.push({ x: 1, y: h + 0.5, z: 0 }, { x: -1, y: h - 0.5, z: 0 });
    // trunk base flare
    logs.push({ x: 1, y: 0.5, z: 0 }, { x: 0, y: 0.5, z: -1 });
    g.add(voxels(logs, logMat));

    const leaves = [], seen = new Set();
    const blobs = [[0, h + 1.5, 0, 3.6], [-2.5, h, 0.5, 2.6], [2.8, h + 0.5, -0.5, 2.8], [0.5, h + 0.5, 2.5, 2.4], [-0.5, h + 0.8, -2.5, 2.4]];
    for (const [cx, cy, cz, r] of blobs) {
      for (let dx = -4; dx <= 4; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) {
        const px = Math.round(cx + dx), py = Math.round(cy + dy), pz = Math.round(cz + dz);
        const d = Math.hypot(px - cx, (py - cy) * 1.25, pz - cz);
        if (d > r - rnd() * 0.9) continue;
        const key = px + ',' + py + ',' + pz;
        if (seen.has(key) || (px === 0 && pz === 0 && py < h)) continue;
        seen.add(key);
        leaves.push({ x: px, y: py + 0.5, z: pz, color: pinks[(rnd() * pinks.length) | 0] });
      }
    }
    g.add(voxels(leaves, leafMat));
    root.add(g);
    trees.push({ g, ph: rnd() * 6.28, sp: 0.5 + rnd() * 0.3 });
  }
  tree(-9, -7, 5); tree(9, -9, 6); tree(-10, 8, 5); tree(10, 8, 4); tree(-1, -12, 6);

  // ---- Clouds ----
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888888 });
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const cells = [];
    const w = 3 + ((rnd() * 3) | 0), d = 2 + ((rnd() * 2) | 0);
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if (rnd() > 0.2) cells.push({ x: x * 2, y: 0, z: z * 2, sx: 2, sy: 1.2, sz: 2 });
    const m = voxels(cells, cloudMat, BOX, false);
    m.castShadow = false; m.receiveShadow = false;
    m.position.set(-50 + i * 18 + rnd() * 6, 24 + rnd() * 8, -30 + rnd() * 60);
    root.add(m);
    clouds.push({ m, v: 0.6 + rnd() * 0.8 });
  }

  // ---- Blocky sun ----
  const sun = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
  sun.position.set(-40, 42, -45);
  sun.rotation.set(0.3, 0.6, 0.2);
  root.add(sun);

  return {
    update(t) {
      for (const tr of trees) {
        tr.g.rotation.z = Math.sin(t * tr.sp + tr.ph) * 0.012;
        tr.g.rotation.x = Math.cos(t * tr.sp * 0.8 + tr.ph) * 0.008;
      }
      for (const c of clouds) {
        c.m.position.x += c.v * 0.016;
        if (c.m.position.x > 55) c.m.position.x = -65;
      }
      sun.rotation.y = 0.6 + t * 0.05;
      waterMesh.position.y = Math.sin(t * 1.5) * 0.03;
    },
  };
}
