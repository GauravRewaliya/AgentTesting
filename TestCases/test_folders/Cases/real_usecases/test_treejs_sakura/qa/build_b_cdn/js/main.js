import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from './world.js';
import { createPetals } from './petals.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
camera.position.set(22, 14, 22);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 6;
controls.maxDistance = 70;

const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 0.8);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 40, 20);
scene.add(hemi, sun);

const themes = {
  day:    { bg: 0x9fd8ff, fog: 0xbfe6ff, near: 40, far: 150, sky: 0xffffff, ground: 0x6a8f4a, sunC: 0xfff4dd, sunI: 1.2, hemiI: 0.8, pos: [30, 40, 20] },
  sunset: { bg: 0xff9a6b, fog: 0xe58a8a, near: 30, far: 120, sky: 0xffc8a0, ground: 0x4a3a5a, sunC: 0xff8a50, sunI: 1.0, hemiI: 0.5, pos: [-40, 8, 15] },
};
let mode = 'day';
scene.background = new THREE.Color(themes.day.bg);
scene.fog = new THREE.Fog(themes.day.fog, themes.day.near, themes.day.far);
function applyTheme(name) {
  const th = themes[name];
  scene.background.setHex(th.bg);
  scene.fog.color.setHex(th.fog);
  scene.fog.near = th.near; scene.fog.far = th.far;
  hemi.color.setHex(th.sky); hemi.groundColor.setHex(th.ground); hemi.intensity = th.hemiI;
  sun.color.setHex(th.sunC); sun.intensity = th.sunI;
  sun.position.set(...th.pos);
}

const world = createWorld(scene);
const petals = createPetals(scene);

const btnRotate = document.getElementById('btn-rotate');
const btnTime = document.getElementById('btn-time');
const btnPetals = document.getElementById('btn-petals');
btnRotate.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle('on', controls.autoRotate);
  btnRotate.textContent = 'Rotate: ' + (controls.autoRotate ? 'ON' : 'OFF');
};
btnTime.onclick = () => {
  mode = mode === 'day' ? 'sunset' : 'day';
  applyTheme(mode);
  btnTime.classList.toggle('on', mode === 'sunset');
  btnTime.textContent = 'Time: ' + (mode === 'day' ? 'Day' : 'Sunset');
};
let petalsOn = true;
btnPetals.onclick = () => {
  petalsOn = !petalsOn;
  petals.setVisible(petalsOn);
  btnPetals.classList.toggle('on', petalsOn);
  btnPetals.textContent = 'Petals: ' + (petalsOn ? 'ON' : 'OFF');
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  controls.update();
  world.update(t);
  petals.update(dt, t);
  renderer.render(scene, camera);
  if (!window.__ready) window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
