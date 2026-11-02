import * as THREE from 'three';

/**
 * 纹理缓存 + LRU。
 * 星云里只常驻 std 层，GPU 上限 24 张；超了就把最久没用的 dispose 掉。
 * hi 层（点开才用）单独一张，关闭时立刻释放。
 */

const MAX_RESIDENT = 24;

const cache = new Map();   // id -> { texture, lastUsed }
let loader = null;

function getLoader() {
  if (!loader) loader = new THREE.TextureLoader();
  return loader;
}

function configure(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function loadTexture(url, anisotropy = 8) {
  return new Promise((resolve, reject) => {
    getLoader().load(
      url,
      (tex) => {
        configure(tex);
        tex.anisotropy = anisotropy;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/** 取 std 层纹理；未加载则异步加载，返回 null 表示还在路上 */
export function getStdTexture(photo) {
  const hit = cache.get(photo.id);
  if (hit) {
    hit.lastUsed = performance.now();
    return hit.texture;
  }
  if (photo._loadingStd) return null;
  photo._loadingStd = true;
  loadTexture(photo.stdUrl)
    .then((tex) => {
      cache.set(photo.id, { texture: tex, lastUsed: performance.now() });
      photo._loadingStd = false;
      evict();
    })
    .catch(() => { photo._loadingStd = false; });
  return null;
}

function evict() {
  if (cache.size <= MAX_RESIDENT) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [id, entry] of entries) {
    if (cache.size <= MAX_RESIDENT) break;
    entry.texture.dispose();
    cache.delete(id);
  }
}

/** 永不驱逐的当前选中项，避免刚点开就被回收 */
export function pinTexture(id) {
  const hit = cache.get(id);
  if (hit) hit.lastUsed = performance.now() + 1e9;
}

export function disposeAll() {
  for (const [, entry] of cache) entry.texture.dispose();
  cache.clear();
}
