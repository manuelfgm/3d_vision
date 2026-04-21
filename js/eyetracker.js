/**
 * eyetracker.js
 *
 * Wraps MediaPipe FaceLandmarker to extract:
 *  - Interpupillary distance (IPD) in scene units
 *  - Head position offset (X, Y) normalised to [-1, 1]
 *  - Head depth scale relative to calibration distance
 *
 * Iris landmark indices (478-point mesh):
 *   Left  iris center: 468
 *   Right iris center: 473
 */

const MEDIAPIPE_VERSION = "0.10.12";
const VISION_BUNDLE_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM_DIR =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const LEFT_IRIS  = 468;
const RIGHT_IRIS = 473;

export class EyeTracker {
  constructor() {
    this._faceLandmarker = null;
    this._video          = null;
    this._refIpdPx       = null;   // IPD in pixels at calibration distance
    this._manualIpd      = 0.063;  // scene-unit IPD controlled by user

    this.isTracking = false;

    /** Exposed to the renderer every frame */
    this.headData = {
      ipd:        0.063,  // stereo eye separation in scene units
      headX:      0,      // [-1, 1] horizontal (mirror-corrected)
      headY:      0,      // [-1, 1] vertical
      headScale:  1,      // 1 = reference distance; >1 farther; <1 closer
    };
  }

  /** Load MediaPipe and create the FaceLandmarker. */
  async init(videoElement) {
    this._video = videoElement;

    // Dynamic import so the heavy bundle is fetched only when needed
    const { FaceLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);

    const vision = await FilesetResolver.forVisionTasks(WASM_DIR);

    this._faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
    });
  }

  /**
   * Process one video frame.
   * Must be called every animation frame with performance.now() timestamp.
   */
  update(timestampMs) {
    const v = this._video;
    if (!this._faceLandmarker || !v || v.readyState < 2) return;

    const vw = v.videoWidth  || 1;
    const vh = v.videoHeight || 1;

    const result = this._faceLandmarker.detectForVideo(v, timestampMs);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      this.isTracking = false;
      return;
    }

    this.isTracking = true;
    const lm = result.faceLandmarks[0];

    const L = lm[LEFT_IRIS];
    const R = lm[RIGHT_IRIS];

    // IPD in normalised video coordinates → convert to pixel scale
    const ipdPx = Math.hypot((R.x - L.x) * vw, (R.y - L.y) * vh);

    // Establish reference on first detection
    if (this._refIpdPx === null) {
      this._refIpdPx = ipdPx;
    }

    this.headData.headScale = this._refIpdPx / ipdPx;

    // Head centre, normalised. Flip X because front camera is mirrored.
    const cx = (L.x + R.x) / 2;
    const cy = (L.y + R.y) / 2;
    this.headData.headX = (0.5 - cx) * 2;   // [-1, 1]
    this.headData.headY = (0.5 - cy) * 2;   // [-1, 1]

    this.headData.ipd = this._manualIpd;
  }

  /** Called when the user moves the IPD slider. */
  setManualIPD(value) {
    this._manualIpd = value;
    this.headData.ipd = value;
  }

  /** Force a fresh calibration reference on the next detected frame. */
  resetCalibration() {
    this._refIpdPx = null;
  }
}
