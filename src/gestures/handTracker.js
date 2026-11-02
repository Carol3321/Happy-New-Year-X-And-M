import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * MediaPipe 手部识别封装。
 * wasm 与模型都放在 public/ 下本地托管，不走外网 CDN。
 */

const BASE = import.meta.env.BASE_URL;   // './' 或 '/'

let landmarker = null;

export async function createHandTracker() {
  if (landmarker) return landmarker;

  const vision = await FilesetResolver.forVisionTasks(`${BASE}wasm`);

  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `${BASE}models/hand_landmarker.task`,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return landmarker;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

/** 单只手的几何指标：都是"相对手掌大小"的无量纲值 */
export function handMetrics(lm) {
  const palm = dist(lm[0], lm[9]) || 1e-6;
  const pinch = dist(lm[4], lm[8]) / palm;

  // 拇指、食指、中指、无名指、小指 是否伸直（指尖离掌心更远即伸直）
  const tips = [4, 8, 12, 16, 20];
  const extended = tips.map((t, i) => {
    const pip = [3, 6, 10, 14, 18][i];
    return dist(lm[t], lm[0]) / palm > dist(lm[pip], lm[0]) / palm * 1.12;
  });

  const openCount = extended.filter(Boolean).length;
  const fist = openCount <= 1 && pinch > 0.5;
  const pointing = extended[1] && openCount === 1;

  return {
    pinch,
    openCount,
    fist,
    pointing,
    x: 1 - lm[9].x,   // 镜像，符合"手往右画面往右"的直觉
    y: lm[9].y,
    palm,
  };
}

/** 简易 EMA，避免逐帧抖动 */
export function makeSmoother(alpha = 0.35) {
  let v = null;
  return (next) => {
    if (v === null) v = next;
    else v = v + (next - v) * alpha;
    return v;
  };
}
