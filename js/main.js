/**
 * main.js — entry point
 *
 * Orchestrates:
 *  1. Browser feature detection
 *  2. Camera permission + video stream
 *  3. MediaPipe FaceLandmarker initialisation
 *  4. Three.js scene + stereo renderer creation
 *  5. RAF animation loop
 *  6. UI event handling
 */

import { EyeTracker }     from "./eyetracker.js";
import { createScene }    from "./scene.js";
import { StereoRenderer } from "./stereo.js";

// ── DOM references ─────────────────────────────────────────────────────────
const video        = document.getElementById("video");
const canvas       = document.getElementById("canvas");
const startScreen  = document.getElementById("start-screen");
const loadingScreen= document.getElementById("loading-screen");
const loadingText  = document.getElementById("loading-text");
const compatWarn   = document.getElementById("compat-warning");
const hud          = document.getElementById("hud");
const guideDots    = document.getElementById("guide-dots");
const trackingDot  = document.getElementById("tracking-dot");
const trackingLabel= document.getElementById("tracking-label");
const ipdSlider    = document.getElementById("ipd-slider");
const ipdValue     = document.getElementById("ipd-value");
const btnStart     = document.getElementById("btn-start");
const btnToggle    = document.getElementById("btn-toggle-mode");
const btnBack      = document.getElementById("btn-back");

// ── Module state ──────────────────────────────────────────────────────────
let tracker  = null;
let renderer = null;
let sceneObj = null;
let running  = false;
let lastTime = 0;

// ── Feature detection ──────────────────────────────────────────────────────
if (!navigator.mediaDevices?.getUserMedia) {
  compatWarn.classList.remove("hidden");
}

// ── Start button ──────────────────────────────────────────────────────────
btnStart.addEventListener("click", async () => {
  btnStart.disabled = true;

  startScreen.classList.add("hidden");
  loadingScreen.classList.remove("hidden");

  try {
    // 1. Camera stream
    setLoadingText("Accediendo a la cámara…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((resolve, reject) => {
      video.addEventListener("loadeddata", resolve, { once: true });
      video.addEventListener("error", reject, { once: true });
    });

    // 2. Request landscape orientation (best for side-by-side stereo)
    try { await screen.orientation.lock("landscape"); } catch (_) { /* best-effort */ }

    // 3. Initialise MediaPipe (downloads ~10 MB model on first load)
    setLoadingText("Cargando modelo de eye tracking…");
    tracker = new EyeTracker();
    await tracker.init(video);

    // 4. Build scene & renderer
    setLoadingText("Preparando escena 3D…");
    sceneObj = createScene();
    renderer = new StereoRenderer(canvas);

    // 5. Show HUD and start loop
    loadingScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    guideDots.classList.remove("hidden");

    running  = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);

  } catch (err) {
    console.error("[3D Vision]", err);
    loadingScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    btnStart.disabled = false;
    btnStart.textContent = "Reintentar";
    alert(`No se pudo iniciar: ${err.message}`);
  }
});

// ── Back button ───────────────────────────────────────────────────────────
btnBack.addEventListener("click", () => {
  running = false;

  // Stop camera tracks
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  try { screen.orientation.unlock(); } catch (_) { /* best-effort */ }

  hud.classList.add("hidden");
  guideDots.classList.add("hidden");
  startScreen.classList.remove("hidden");
  btnStart.disabled = false;
  btnStart.textContent = "Iniciar experiencia";
});

// ── IPD slider ────────────────────────────────────────────────────────────
ipdSlider.addEventListener("input", () => {
  const val = parseFloat(ipdSlider.value);
  ipdValue.textContent = `${Math.round(val * 1000)}mm`;
  if (tracker)  tracker.setManualIPD(val);
  if (renderer) renderer.setIPD(val);
});

// ── Cross-eyed / parallel toggle ─────────────────────────────────────────
btnToggle.addEventListener("click", () => {
  if (!renderer) return;
  const crossed = renderer.toggleCrossEyed();
  btnToggle.textContent = crossed ? "Modo: Cruzado" : "Modo: Paralelo";
});

// ── Animation loop ────────────────────────────────────────────────────────
function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);

  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Run eye tracking on this frame
  tracker.update(now);

  // Update tracking HUD
  if (tracker.isTracking) {
    trackingDot.classList.add("active");
    trackingLabel.textContent = "Cara detectada";
    renderer.updateHeadTracking(tracker.headData);
    renderer.setIPD(tracker.headData.ipd);
  } else {
    trackingDot.classList.remove("active");
    trackingLabel.textContent = "Buscando cara…";
  }

  // Advance scene animations
  sceneObj.animate(delta);

  // Render stereo frame
  renderer.render(sceneObj.scene);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setLoadingText(msg) {
  loadingText.textContent = msg;
}
