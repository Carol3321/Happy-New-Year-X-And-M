/**
 * 照片处理 Worker：
 *   File/Blob -> createImageBitmap(EXIF 转正) -> OffscreenCanvas 缩放 -> WebP Blob ×3
 *
 * 三级尺寸：
 *   thumb 256 / q0.80   树上的小卡片
 *   std   768 / q0.83   星云常驻层
 *   hi    min(4096, MAX)/ q0.88  点开时才要
 */

const TIERS = [
  { key: 'thumb', edge: 256, quality: 0.8 },
  { key: 'std', edge: 768, quality: 0.83 },
  { key: 'hi', edge: 4096, quality: 0.88, maxEdge: true },
];

let maxTextureEdge = 4096;

function drawToCanvas(bitmap, edge, orientation) {
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, edge / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));

  // 竖拍由 EXIF Orientation 决定：浏览器已按 from-image 转过就直接画
  const rotated = orientation >= 5 && orientation <= 8;
  const canvas = new OffscreenCanvas(rotated ? dh : dw, rotated ? dw : dh);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingQuality = 'high';

  if (rotated) {
    // 6: 顺时针 90°；8: 逆时针 90°
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(orientation === 6 ? Math.PI / 2 : -Math.PI / 2);
    ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(bitmap, 0, 0, dw, dh);
  }
  return { canvas, width: canvas.width, height: canvas.height };
}

self.onmessage = async (e) => {
  const { id, file, orientation = 1, edgeLimit } = e.data;
  if (edgeLimit) maxTextureEdge = edgeLimit;

  try {
    // imageOrientation: 'from-image' 让浏览器自己按 EXIF 转正（Chrome 81+）
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file);
    }

    const out = { id, tiers: {}, aspect: bitmap.width / bitmap.height };

    for (const tier of TIERS) {
      const edge = tier.maxEdge ? Math.min(tier.edge, maxTextureEdge) : tier.edge;
      // from-image 已经转正，这里不再二次旋转
      const { canvas, width, height } = drawToCanvas(bitmap, edge, 1);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: tier.quality });
      out.tiers[tier.key] = { blob, width, height };
    }

    bitmap.close?.();
    self.postMessage({ ok: true, ...out });
  } catch (err) {
    self.postMessage({ ok: false, id, error: String(err && err.message || err) });
  }
};
