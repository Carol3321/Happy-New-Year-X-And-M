/**
 * 位置生成：球（星云）与树（锥面螺旋）。
 * 都是纯函数，按 index/total 确定性地算，方便切形态时 lerp。
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** 斐波那契球面，均匀铺开 */
export function spherePosition(i, n, radius = 8) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  const y = 1 - t * 2;                 // 1 -> -1
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN * i;
  // 让球略微扁平一点，视觉上更像"光球"
  return [
    Math.cos(theta) * r * radius,
    y * radius * 0.82,
    Math.sin(theta) * r * radius,
  ];
}

/** 锥形螺旋：从上到下绕圈，越往下半径越大 */
export function treePosition(i, n, height = 15, baseRadius = 5.2) {
  const t = n === 1 ? 0.5 : i / (n - 1);      // 0 顶 -> 1 底
  const turns = 7;                             // 绕几圈
  const angle = t * turns * Math.PI * 2 + (i % 3) * 0.4;
  const taper = Math.pow(t, 0.92);             // 顶部收得慢一点，树形更饱满
  const r = baseRadius * taper;
  const y = height / 2 - t * height;
  // 半径方向上做一点随机厚度，别贴在同一个锥面上
  const jitter = 0.86 + ((i * 37) % 100) / 100 * 0.28;
  return [Math.cos(angle) * r * jitter, y, Math.sin(angle) * r * jitter];
}

/** 树顶那颗星的位置 */
export const TREE_TOP = [0, 15 / 2 + 0.8, 0];

/** 每张卡片的随机倾斜（固定种子，刷新不变） */
export function tiltFor(i) {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const c = Math.sin(i * 39.425) * 24634.6345;
  const rnd = (v) => (v - Math.floor(v)) - 0.5;
  return [rnd(a) * 0.5, rnd(b) * 0.5, rnd(c) * 0.35];
}
