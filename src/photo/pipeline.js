import exifr from 'exifr';
import { useStore } from '../store.js';

/**
 * 照片管线：文件 -> Worker 生成三级 WebP -> objectURL。
 * 主线程只负责排队、发任务、收结果，不做任何像素运算。
 */

const MAX_PHOTOS = 100;
const CONCURRENCY = 2;

let worker = null;
let seq = 0;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const msg = e.data;
    const task = pending.get(msg.id);
    if (!task) return;
    pending.delete(msg.id);
    if (msg.ok) task.resolve(msg);
    else task.reject(new Error(msg.error));
  };
  return worker;
}

const queue = [];
let running = 0;

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift();
    running++;
    runJob(job).finally(() => {
      running--;
      pump();
    });
  }
}

async function runJob({ id, file }) {
  try {
    const orientation = await exifr.orientation(file).catch(() => 1);
    const w = ensureWorker();
    const result = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, file, orientation });
    });

    const urls = {};
    for (const [key, v] of Object.entries(result.tiers)) {
      urls[key] = URL.createObjectURL(v.blob);
    }

    useStore.getState().addPhotos([{
      id,
      aspect: result.aspect,
      stdUrl: urls.std,
      thumbUrl: urls.thumb,
      hiUrl: urls.hi,
    }]);
    useStore.getState().setLoading((p) => ({ done: p.done + 1 }));
  } catch (err) {
    console.error('[photo] 处理失败', file && file.name, err);
    useStore.getState().setLoading((p) => ({ done: p.done + 1 }));
  }
}

/** 接收一批文件（最多 100 张） */
export function ingestFiles(fileList) {
  const files = Array.from(fileList).filter((f) => /^image\//.test(f.type));
  if (!files.length) return;

  const state = useStore.getState();
  const room = MAX_PHOTOS - state.photos.length - queue.length;
  const take = files.slice(0, Math.max(0, room));
  if (!take.length) return;

  state.setLoading((p) => ({ total: p.total + take.length, done: p.done }));
  console.log('[photo] 入队', take.length, '张');
  for (const file of take) {
    queue.push({ id: `p${seq++}`, file });
  }
  pump();
}

/** 释放所有 objectURL（清空相册时） */
export function releaseAll(photos) {
  for (const p of photos) {
    for (const k of ['stdUrl', 'thumbUrl', 'hiUrl']) {
      if (p[k]) URL.revokeObjectURL(p[k]);
    }
  }
}
