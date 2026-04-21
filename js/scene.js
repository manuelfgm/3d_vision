/**
 * scene.js
 *
 * Creates a Three.js scene with objects placed at various depths so the
 * stereo parallax is clearly visible. Returns { scene, animate }.
 */

import * as THREE from "three";

export function createScene() {
  // ── Core scene ──────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06060f);
  scene.fog = new THREE.FogExp2(0x06060f, 0.04);

  // ── Lighting ────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const bluePoint = new THREE.PointLight(0x3399ff, 4, 12);
  bluePoint.position.set(-4, 3, 2);
  scene.add(bluePoint);

  const orangePoint = new THREE.PointLight(0xff6633, 3, 10);
  orangePoint.position.set(3, -2, 0);
  scene.add(orangePoint);

  // ── Grid floor ──────────────────────────────────────────────────────────
  const grid = new THREE.GridHelper(30, 30, 0x1a2233, 0x1a2233);
  grid.position.y = -2.5;
  scene.add(grid);

  // ── Central torus knot — floats clearly in front of the screen (z=2) ────
  const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.65, 0.22, 128, 20),
    new THREE.MeshPhongMaterial({
      color: 0x22ddff,
      emissive: 0x003344,
      shininess: 120,
      specular: 0x88eeff,
    })
  );
  torusKnot.position.z = 2;   // in front of screen plane (z=0)
  scene.add(torusKnot);

  // ── Foreground cubes — maximum pop-out, closest to the viewer ──────────
  const fgCubes = [
    { pos: [-1.4,  0.6, 3.2], hue: 0.10 },
    { pos: [ 1.6, -0.4, 3.6], hue: 0.55 },
  ];
  const fgMeshes = fgCubes.map(({ pos, hue }) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 0.9, 0.55),
        shininess: 80,
      })
    );
    mesh.position.set(...pos);
    scene.add(mesh);
    return mesh;
  });

  // ── Background spheres (z < 0 → recede into depth) ────────────────────
  const bgSpheres = [
    { pos: [-3.0,  1.2, -3.5], hue: 0.85 },
    { pos: [ 3.2, -0.8, -4.0], hue: 0.15 },
    { pos: [-1.0, -1.8, -2.5], hue: 0.40 },
    { pos: [ 0.5,  2.5, -5.5], hue: 0.65 },
    { pos: [-4.0, -0.5, -6.0], hue: 0.30 },
    { pos: [ 4.5,  1.5, -7.0], hue: 0.75 },
  ];
  const bgMeshes = bgSpheres.map(({ pos, hue }, i) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 0.75, 0.5),
        shininess: 70,
      })
    );
    mesh.position.set(...pos);
    mesh.userData.floatPhase = i * 1.1;
    scene.add(mesh);
    return mesh;
  });

  // ── Ring — sits right on the screen plane (z=0), zero parallax ─────────
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.06, 16, 80),
    new THREE.MeshPhongMaterial({ color: 0xffcc44, shininess: 90 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0, 0);  // exactly on screen plane
  scene.add(ring);

  // ── Stars in deep background ────────────────────────────────────────────
  const starCount = 600;
  const starPos   = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3]     = (Math.random() - 0.5) * 50;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 25;
    starPos[i * 3 + 2] = -(Math.random() * 25 + 8);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06 })));

  // ── Animation ───────────────────────────────────────────────────────────
  let elapsed = 0;

  function animate(delta) {
    elapsed += delta;

    // Torus knot rotates continuously
    torusKnot.rotation.x = elapsed * 0.35;
    torusKnot.rotation.y = elapsed * 0.55;

    // Foreground cubes spin
    fgMeshes.forEach((m, i) => {
      m.rotation.x += delta * (0.6 + i * 0.3);
      m.rotation.z += delta * (0.4 + i * 0.2);
    });

    // Background spheres gently float
    bgMeshes.forEach((m) => {
      m.position.y += Math.sin(elapsed * 0.8 + m.userData.floatPhase) * 0.001;
    });

    // Ring orbits the torus knot slowly
    ring.rotation.z = elapsed * 0.2;
  }

  return { scene, animate };
}
