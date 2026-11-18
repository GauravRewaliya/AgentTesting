import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";
import { createSakura } from "./sakura.js";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
camera.position.set(22, 14, 26);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.minDistance = 8;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

const world = createWorld(scene, renderer, camera);
const sakura = createSakura(scene, world, camera);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const btnRot = document.getElementById("btn-rot");
const btnTime = document.getElementById("btn-time");
const btnWind = document.getElementById("btn-wind");
let time = "day";

function labelRot() {
  if (btnRot) {
    btnRot.textContent = controls.autoRotate ? "Rotate: On" : "Rotate: Off";
    btnRot.setAttribute("aria-pressed", String(controls.autoRotate));
  }
}
function labelTime() {
  if (btnTime) btnTime.textContent = time === "day" ? "Time: Day" : "Time: Sunset";
}
labelRot();
labelTime();
btnRot?.addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; labelRot(); });
btnTime?.addEventListener("click", () => {
  time = time === "day" ? "sunset" : "day";
  world.setTime(time);
  labelTime();
});
btnWind?.addEventListener("click", () => sakura.gust());

const clock = new THREE.Clock();
let t = 0, first = true;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  controls.update();
  world.update(t, dt);
  sakura.update(t, dt);
  renderer.render(scene, camera);
  if (first) { first = false; window.__ready = true; }
}
frame();
