# Happy New Year · X And M

手势交互的 3D 照片粒子圣诞树。Three.js + React Three Fiber + drei + Vite + zustand。

## 快速开始

```bash
pnpm install     # 或 npm install
pnpm dev         # http://127.0.0.1:5173
pnpm build       # 产物在 dist/
pnpm preview     # 本地预览构建产物
```

> 摄像头需要 **HTTPS 或 localhost**。用 `http://192.168.x.x` 打开浏览器会禁用摄像头，
> 此时应用自动回退到鼠标 / 触摸操作，功能不受影响。

没有照片时想先看效果：地址后面加 `?demo=60`，会用 `public/demo/` 里的样张循环填充。

## 玩法

| 操作 | 鼠标 | 手势 |
| --- | --- | --- |
| 切换星云 / 圣诞树 | 底部「★ 星云 / ▲ 圣诞树」 | — |
| 旋转 | 拖拽 | 张开手掌左右移动 |
| 缩放 | 滚轮 | 双手张开距离 |
| 看某张照片 | 点击照片 | 捏合（自动选离手最近的那张） |
| 关闭 | 点击空白 / ✕ / Esc | 握拳 |
| 性能模式 | 底部「性能」 | — |

## 目录结构

```
public/
  wasm/                     MediaPipe wasm（本地托管，不走 CDN）
  models/hand_landmarker.task
  demo/                     ?demo 用的样张
src/
  App.jsx                   组装页面 + 键盘兜底 + demo 注入
  store.js                  zustand：形态、照片、选中、视图
  three/
    Scene.jsx               Canvas / 相机 / 泛光 / OrbitControls 兜底
    Stars.jsx               星空（shader 闪烁）
    GoldDust.jsx            金色粒子（球⇄树双缓冲 + 错峰 morph）
    PhotoCards.jsx          照片卡片（billboard、微倾斜、聚焦、金框、变暗）
    shapes.js               球 / 树 位置生成
    cardRegistry.js         每帧写入卡片屏幕坐标，供手势挑选
  photo/
    worker.js               createImageBitmap + OffscreenCanvas → 三级 WebP
    pipeline.js             任务队列、objectURL 生命周期
    textureCache.js         LRU + 显存预算（常驻 ≤24 张）+ dispose
  gestures/
    handTracker.js          MediaPipe 封装 + 手势几何指标
    useGestures.js          手势 → store（含去抖）
  ui/
    DropZone.jsx            拖拽 / 点击上传（没有 ADD MEMORIES 按钮）
    ControlBar.jsx          形态 / 音乐 / 性能
    WebcamPiP.jsx           右下角摄像头画中画
```

## 照片质量保障

1. **Worker 里处理**，主线程零像素运算：
   `createImageBitmap` → `OffscreenCanvas` 缩放 → `convertToBlob('image/webp')`
2. **三级尺寸**
   | 层 | 尺寸 | 质量 | 用途 |
   | --- | --- | --- | --- |
   | thumb | 256 | q0.80 | 树上小卡片（预留） |
   | std | 768 | q0.83 | 星云常驻层 |
   | hi | min(4096, MAX_TEXTURE_SIZE) | q0.88 | 点开时按需 |
3. **等比 contain**：只用 `Math.min(1, edge/max(w,h))` 缩放，从不裁切，保持原始宽高比。
4. **EXIF 竖拍**：`createImageBitmap(..., { imageOrientation: 'from-image' })` 让浏览器转正，
   并用 `exifr` 读 orientation 作为兜底信息。
5. **色彩管线**：纹理 `SRGBColorSpace`，渲染器默认输出 sRGB，照片材质 `toneMapped={false}`，
   保证照片不被色调映射压暗。
6. **mipmap + anisotropy**：`LinearMipmapLinearFilter` + 最大各向异性，缩小时不闪烁。
7. **显存控制**：星云只常驻 std 层，LRU 上限 24 张，超出立即 `texture.dispose()`；
   hi 层只加载当前选中一张，关闭或切换立刻释放；`objectURL` 用完 `revokeObjectURL`。
8. **性能模式**：粒子数降到 40%，星空减半，pixelRatio 上限 1.5，泛光强度降低。

## 手势实现

- `@mediapipe/tasks-vision`，GPU delegate，本地 wasm + 本地模型，最多 2 只手。
- 指标全部按**手掌尺寸归一化**（不依赖手到镜头的距离）：
  捏合 = `dist(拇指尖4, 食指尖8) / dist(腕0, 中指根9)`。
- **去抖**：捏合需要连续 3 帧确认 + 500ms 冷却；松开需要 3 帧且间距回到 0.75 以上，
  避免一次捏合被拆成好几次。
- **兜底**：拿不到摄像头（或非安全上下文）时 `handActive=false`，
  `OrbitControls` 接管，鼠标完整可用。

## 已知限制

- MediaPipe 的 wasm + 模型约 16MB，首次加载受网络影响；之后浏览器缓存。
- 手势识别质量取决于光照和手到镜头距离（建议 40–70cm、正面光）。
- 100 张照片时 draw call 约 100，桌面无压力；低端手机建议开性能模式。

## 部署

构建产物是纯静态的，`dist/` 可直接拖到 Netlify Drop，或推到 GitHub 开 Pages。
`vite.config.js` 里 `base: './'` 保证子路径部署可用。
