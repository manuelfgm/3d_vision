/**
 * stereo.js
 *
 * Manages the WebGL renderer and produces a side-by-side stereo image using
 * Three.js StereoCamera (off-axis / asymmetric-frustum projection).
 *
 * Layout (parallel viewing, default):
 *   LEFT  half → left-eye  camera image
 *   RIGHT half → right-eye camera image
 *
 * Layout (cross-eyed mode):
 *   LEFT  half → right-eye camera image
 *   RIGHT half → left-eye  camera image
 *
 * Head tracking moves the master camera rig so the scene appears to "look
 * through a window" as the viewer's head shifts.
 */

import * as THREE from "three";

// Smoothing factor for head-tracking interpolation (higher = snappier)
const LERP_POS   = 0.12;
const LERP_SCALE = 0.06;

// How much head movement translates to camera shift (tweak for comfort)
const HEAD_X_SCALE = 0.9;
const HEAD_Y_SCALE = 0.45;

export class StereoRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    // ── Renderer ──────────────────────────────────────────────────────────
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.autoClear = true;

    // ── Master camera (controls view direction & frustum parameters) ───────
    this._master = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );
    this._master.position.set(0, 0, 5);
    this._master.lookAt(0, 0, 0);

    // ── Stereo camera (derives cameraL / cameraR via off-axis projection) ──
    this._stereo = new THREE.StereoCamera();
    this._stereo.eyeSep = 0.063;   // 63 mm default IPD in scene units

    // ── State ──────────────────────────────────────────────────────────────
    this.crossEyed = false;   // parallel viewing by default

    this._smoothX     = 0;
    this._smoothY     = 0;
    this._smoothScale = 1;

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Update the stereo eye separation from IPD (in scene units). */
  setIPD(value) {
    this._stereo.eyeSep = value;
  }

  /**
   * Smoothly blend new head-tracking data into the camera rig.
   * Safe to call every frame even when isTracking is false.
   */
  updateHeadTracking(headData) {
    this._smoothX     += (headData.headX     - this._smoothX)     * LERP_POS;
    this._smoothY     += (headData.headY     - this._smoothY)     * LERP_POS;
    this._smoothScale += (headData.headScale - this._smoothScale) * LERP_SCALE;
  }

  /** Toggle between parallel and cross-eyed viewing. Returns new state. */
  toggleCrossEyed() {
    this.crossEyed = !this.crossEyed;
    return this.crossEyed;
  }

  /**
   * Render one stereo frame.
   * @param {THREE.Scene} scene
   */
  render(scene) {
    // Apply smoothed head tracking to the master camera position
    const tx = this._smoothX * HEAD_X_SCALE;
    const ty = this._smoothY * HEAD_Y_SCALE;
    this._master.position.x = tx;
    this._master.position.y = ty;
    // Slight look-at offset gives a natural parallax pivot
    this._master.lookAt(tx * 0.1, ty * 0.1, 0);

    // Derive stereo cameras from master
    this._stereo.update(this._master);

    const camL = this.crossEyed ? this._stereo.cameraR : this._stereo.cameraL;
    const camR = this.crossEyed ? this._stereo.cameraL : this._stereo.cameraR;

    const w = this._renderer.domElement.width;
    const h = this._renderer.domElement.height;
    const half = Math.floor(w / 2);

    this._renderer.setScissorTest(true);

    // Left half
    this._renderer.setScissor(0, 0, half, h);
    this._renderer.setViewport(0, 0, half, h);
    this._renderer.render(scene, camL);

    // Right half
    this._renderer.setScissor(half, 0, w - half, h);
    this._renderer.setViewport(half, 0, w - half, h);
    this._renderer.render(scene, camR);

    this._renderer.setScissorTest(false);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._renderer.setSize(w, h);
    this._master.aspect = w / h;
    this._master.updateProjectionMatrix();
  }
}
