import * as THREE from 'three';

const COUNT = 600;
const BOX_X = 40, BOX_Z = 40, TOP = 22;

function petalGeometry() {
  // small flat sakura petal with a notch at the tip
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.45, -0.35, 0.5, 0.25, 0.14, 0.5);
  s.lineTo(0, 0.4);
  s.lineTo(-0.14, 0.5);
  s.bezierCurveTo(-0.5, 0.25, -0.45, -0.35, 0, -0.5);
  const g = new THREE.ShapeGeometry(s, 6);
  g.scale(0.5, 0.5, 0.5);
  return g;
}

export function createPetals(scene) {
  const geo = petalGeometry();
  const mat = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x3a1020),
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const shades = [0xffc4d6, 0xff9fbd, 0xffe0ea].map((c) => new THREE.Color(c));
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT); // fall speed
  const rot = new Float32Array(COUNT * 3);
  const spin = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT * 2);
  const size = new Float32Array(COUNT);

  const spawn = (i, anywhere) => {
    pos[i * 3] = (Math.random() - 0.5) * BOX_X;
    pos[i * 3 + 1] = anywhere ? Math.random() * TOP : TOP - Math.random() * 2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX_Z;
  };

  for (let i = 0; i < COUNT; i++) {
    spawn(i, true);
    vel[i] = 0.6 + Math.random() * 0.9;
    for (let k = 0; k < 3; k++) {
      rot[i * 3 + k] = Math.random() * Math.PI * 2;
      spin[i * 3 + k] = (Math.random() - 0.5) * 3.5;
    }
    phase[i * 2] = Math.random() * Math.PI * 2;
    phase[i * 2 + 1] = Math.random() * Math.PI * 2;
    size[i] = 0.7 + Math.random() * 0.8;
    mesh.setColorAt(i, shades[Math.floor(Math.random() * shades.length)]);
  }
  mesh.instanceColor.needsUpdate = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();

  scene.add(mesh);

  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    // wind: slow base breeze plus periodic gusts
    const gust = Math.max(0, Math.sin(t * 0.35) * Math.sin(t * 0.13 + 1)) ;
    const windX = 0.6 + gust * 3.5;
    const windZ = 0.25 + gust * 1.2;
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const ph = phase[i * 2], ph2 = phase[i * 2 + 1];
      pos[i3] += (windX + Math.sin(t * 0.9 + ph) * 0.9) * dt;
      pos[i3 + 2] += (windZ + Math.cos(t * 0.7 + ph2) * 0.7) * dt;
      pos[i3 + 1] -= vel[i] * (1 - gust * 0.2) * dt;
      const f = 1 + gust * 2.2;
      rot[i3] += spin[i3] * f * dt;
      rot[i3 + 1] += spin[i3 + 1] * f * dt;
      rot[i3 + 2] += spin[i3 + 2] * f * dt;

      if (pos[i3 + 1] < 0) spawn(i, false);
      if (pos[i3] > BOX_X / 2) pos[i3] -= BOX_X;
      if (pos[i3 + 2] > BOX_Z / 2) pos[i3 + 2] -= BOX_Z;

      p.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      e.set(rot[i3], rot[i3 + 1], rot[i3 + 2]);
      q.setFromEuler(e);
      sc.setScalar(size[i]);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function setVisible(v) { mesh.visible = !!v; }

  update(0, 0);
  return { update, setVisible };
}
