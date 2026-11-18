import * as THREE from "three";

// Deterministic RNG so the grove looks the same every load
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PINKS = ["#ffc0d3", "#ffb0c8", "#ff9fbd", "#ffd1df", "#f9a8c4", "#ffe0ea", "#f58fb0", "#ffffff"];

export function createSakura(scene, world) {
  const rnd = mulberry(20240401);
  const group = new THREE.Group();
  scene.add(group);

  // ---------- Trees ----------
  const trunkGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b3a29 });
  const leafGeo = new THREE.BoxGeometry(1, 1, 1);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const treeSpots = [[-7, -5], [6, -8], [8, 5], [-9, 6], [0, 9], [-1, -11]];
  const nTrees = 6;
  const trunks = [], leaves = [];
  const treeTops = [];

  for (let i = 0; i < nTrees; i++) {
    const [tx0, tz0] = treeSpots[i];
    const tx = Math.round(tx0 + (rnd() - 0.5) * 2), tz = Math.round(tz0 + (rnd() - 0.5) * 2);
    const gy = world.heightAt(tx, tz);
    const h = 4 + Math.floor(rnd() * 3);
    for (let y = 0; y < h; y++) trunks.push([tx, gy + 0.5 + y, tz, 1, 1, 1]);
    // little branches
    const bdx = rnd() < 0.5 ? -1 : 1, bdz = rnd() < 0.5 ? -1 : 1;
    trunks.push([tx + bdx, gy + h - 1 + 0.5, tz, 1, 1, 1]);
    trunks.push([tx, gy + h - 2 + 0.5, tz + bdz, 1, 1, 1]);
    // root flare
    trunks.push([tx + 1, gy + 0.5, tz, 1, 1, 1], [tx - 1, gy + 0.5, tz + 1, 1, 1, 1]);
    // canopy: cube clusters
    const cy = gy + h + 0.5, R = 3 + rnd() * 1.2;
    const col = new THREE.Color();
    for (let x = -4; x <= 4; x++) for (let y = -2; y <= 3; y++) for (let z = -4; z <= 4; z++) {
      const d = Math.sqrt(x * x + (y * 1.5) ** 2 + z * z);
      if (d < R && rnd() < 0.78 - d * 0.06) {
        const c = col.set(PINKS[(rnd() * (PINKS.length - 1)) | 0]).clone();
        leaves.push([tx + x, cy + y, tz + z, c]);
      }
    }
    treeTops.push({ x: tx, y: cy, z: tz, R });
  }

  const tMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunks.length);
  const m4 = new THREE.Matrix4();
  trunks.forEach((t, i) => { m4.makeTranslation(t[0], t[1], t[2]); tMesh.setMatrixAt(i, m4); });
  const lMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  leaves.forEach((l, i) => {
    m4.makeScale(0.98, 0.98, 0.98).setPosition(l[0], l[1], l[2]);
    lMesh.setMatrixAt(i, m4); lMesh.setColorAt(i, l[3]);
  });
  tMesh.castShadow = tMesh.receiveShadow = true;
  lMesh.castShadow = lMesh.receiveShadow = true;
  group.add(tMesh, lMesh);

  // ---------- Falling petals ----------
  const N = 4500;
  const petalGeo = new THREE.PlaneGeometry(0.22, 0.3);
  // curve the petal slightly
  const pp = petalGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.abs(pp.getX(i)) * 0.6);
  petalGeo.computeVertexNormals();
  const petalMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x552233, emissiveIntensity: 0.35 });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, N);
  petals.frustumCulled = false;
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(petals);

  const P = {
    x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N),
    rx: new Float32Array(N), ry: new Float32Array(N), rz: new Float32Array(N),
    sx: new Float32Array(N), sy: new Float32Array(N), sz: new Float32Array(N), // spin speeds
    fall: new Float32Array(N), ph: new Float32Array(N), sc: new Float32Array(N), sw: new Float32Array(N),
  };
  const tmpC = new THREE.Color();
  function spawn(i, initial) {
    const tr = treeTops[(rnd() * treeTops.length) | 0];
    const wide = rnd() < 0.3;
    P.x[i] = wide ? (rnd() - 0.5) * 40 : tr.x + (rnd() - 0.5) * tr.R * 2.4;
    P.z[i] = wide ? (rnd() - 0.5) * 40 : tr.z + (rnd() - 0.5) * tr.R * 2.4;
    P.y[i] = initial ? rnd() * 18 : 12 + rnd() * 8;
    P.rx[i] = rnd() * 6.28; P.ry[i] = rnd() * 6.28; P.rz[i] = rnd() * 6.28;
    P.sx[i] = (rnd() - 0.5) * 5; P.sy[i] = (rnd() - 0.5) * 4; P.sz[i] = (rnd() - 0.5) * 5;
    P.fall[i] = 0.45 + rnd() * 0.65;
    P.ph[i] = rnd() * 6.28; P.sw[i] = 0.6 + rnd() * 1.4;
    P.sc[i] = 0.6 + rnd() * 0.9;
    tmpC.set(PINKS[(rnd() * PINKS.length) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
    petals.setColorAt(i, tmpC);
  }
  for (let i = 0; i < N; i++) spawn(i, true);
  petals.instanceColor.needsUpdate = true;

  // ---------- Ground petals ----------
  const G = 1800;
  const ground = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x442233, emissiveIntensity: 0.3 }), G);
  const e = new THREE.Euler(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (let i = 0; i < G; i++) {
    const tr = treeTops[(rnd() * treeTops.length) | 0];
    const a = rnd() * 6.28, r = Math.pow(rnd(), 0.7) * (tr.R + 3.5);
    const x = tr.x + Math.cos(a) * r, z = tr.z + Math.sin(a) * r;
    const y = world.heightAt(x, z) + 0.02 + rnd() * 0.04;
    e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.25, 0, rnd() * 6.28, "YXZ");
    q.setFromEuler(e); const s = 0.8 + rnd() * 0.8; scl.set(s, s, s);
    m4.compose(pos.set(x, y, z), q, scl); ground.setMatrixAt(i, m4);
    ground.setColorAt(i, tmpC.set(PINKS[(rnd() * PINKS.length) | 0]));
  }
  group.add(ground);

  // ---------- Update ----------
  let gustT = 0, windBoost = 0;
  const dummy = new THREE.Object3D();
  function update(t, dt) {
    dt = Math.min(dt || 0.016, 0.05);
    gustT = Math.max(0, gustT - dt);
    const target = gustT > 0 ? Math.min(1, gustT / 0.6) : 0;
    windBoost += (target - windBoost) * Math.min(1, dt * 3);
    const base = 0.9 + Math.sin(t * 0.23) * 0.4 + Math.sin(t * 0.71) * 0.2;
    const wind = base + windBoost * 5;
    for (let i = 0; i < N; i++) {
      const ph = P.ph[i];
      const flutter = Math.sin(t * P.sw[i] * 2 + ph);
      const gustLocal = 0.6 + 0.4 * Math.sin(t * 0.5 + P.x[i] * 0.15 + P.z[i] * 0.1);
      P.x[i] += (wind * gustLocal + flutter * 0.7) * dt;
      P.z[i] += (wind * 0.35 + Math.cos(t * P.sw[i] * 1.6 + ph) * 0.6) * dt;
      P.y[i] -= (P.fall[i] * (0.75 + 0.25 * flutter) - windBoost * 0.2) * dt;
      const spin = 1 + windBoost * 1.5;
      P.rx[i] += P.sx[i] * dt * spin; P.ry[i] += P.sy[i] * dt * spin; P.rz[i] += P.sz[i] * dt * spin;
      const gy = world.heightAt(P.x[i], P.z[i]);
      if (P.y[i] < gy + 0.05 || P.x[i] > 30 || P.z[i] > 30) { spawn(i, false); if (P.x[i] > 22) P.x[i] -= 30; }
      dummy.position.set(P.x[i], P.y[i], P.z[i]);
      dummy.rotation.set(P.rx[i], P.ry[i], P.rz[i]);
      dummy.scale.setScalar(P.sc[i]);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    petals.instanceColor.needsUpdate = true;
    // canopy sways imperceptibly
    lMesh.rotation.z = Math.sin(t * 0.8) * 0.002 * (1 + windBoost * 4);
  }

  function gust() { gustT = 3; }

  return { update, gust };
}
