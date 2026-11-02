import { create } from 'zustand';

/**
 * 全局状态。照片本身（纹理）不进 store，只放轻量元数据，
 * 避免 React 反复 diff 大对象。
 */
export const useStore = create((set, get) => ({
  // ---- 形态 ----
  shape: 'sphere',        // 'sphere' | 'tree'
  morphAt: 0,             // 最近一次切换的时间戳（performance.now）
  toggleShape: () => set((s) => ({
    shape: s.shape === 'sphere' ? 'tree' : 'sphere',
    morphAt: performance.now(),
  })),
  setShape: (shape) => set((s) => (s.shape === shape ? s : { shape, morphAt: performance.now() })),

  // ---- 照片 ----
  photos: [],             // [{ id, aspect, stdUrl, thumbUrl }]
  addPhotos: (list) => set((s) => ({ photos: [...s.photos, ...list].slice(0, 100) })),
  clearPhotos: () => set({ photos: [], selectedId: null }),

  // ---- 选中 ----
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  clearSelection: () => set({ selectedId: null }),
  toggleSelect: (id) => set((s) => ({ selectedId: s.selectedId === id ? null : id })),

  // ---- 视图 ----
  zoom: 1,
  setZoom: (z) => set({ zoom: Math.min(2.5, Math.max(0.45, z)) }),
  worldRot: { x: 0, y: 0 },
  nudgeRot: (dx, dy) => set((s) => ({
    worldRot: { x: s.worldRot.x + dy, y: s.worldRot.y + dx },
  })),

  // ---- 运行时 ----
  perfMode: false,
  togglePerf: () => set((s) => ({ perfMode: !s.perfMode })),
  handActive: false,
  setHandActive: (v) => set({ handActive: v }),
  loading: { total: 0, done: 0 },
  setLoading: (p) => set({ loading: p }),
  musicOn: false,
  toggleMusic: () => set((s) => ({ musicOn: !s.musicOn })),
}));

// 调试/自动化用：控制台可直接 __store.getState()
if (typeof window !== 'undefined') window.__store = useStore;
