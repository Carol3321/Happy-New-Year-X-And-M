import { useEffect, useRef } from 'react';
import { useStore } from '../store.js';
import { createHandTracker, handMetrics, makeSmoother } from './handTracker.js';
import { cardRegistry } from '../three/cardRegistry.js';

/**
 * 手势 -> 状态。
 * 兜底：拿不到摄像头就保持 handActive=false，由 OrbitControls 接管。
 */
export function useGestures(videoRef, enabled = true) {
  const stateRef = useRef({
    pinchOn: false,
    pinchSeen: 0,
    releaseSeen: 0,
    lastPinchAt: 0,
    votes: [],
    lastFistAt: 0,
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let raf = 0;
    let landmarker = null;
    const smoothX = makeSmoother(0.3);
    const smoothY = makeSmoother(0.3);
    const smoothZoom = makeSmoother(0.25);

    async function boot() {
      const video = videoRef.current;
      if (!video) return;

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        console.warn('[gesture] 需要 https 或 localhost 才能开摄像头');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        console.warn('[gesture] 摄像头打不开，回退鼠标操作', err);
        return;
      }

      landmarker = await createHandTracker();
      useStore.getState().setHandActive(true);

      let last = -1;
      const loop = () => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        if (video.readyState < 2) return;
        if (video.currentTime === last) return;
        last = video.currentTime;

        let res;
        try {
          res = landmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }
        handleResult(res);
      };
      loop();
    }

    function handleResult(res) {
      const s = stateRef.current;
      const st = useStore.getState();
      const hands = res?.landmarks || [];

      if (hands.length === 0) {
        s.votes.length = 0;
        return;
      }

      const m0 = handMetrics(hands[0]);
      const now = performance.now();

      // ---- 双手：张开距离 = 整体缩放 ----
      if (hands.length >= 2) {
        const m1 = handMetrics(hands[1]);
        const spread = Math.hypot(m0.x - m1.x, m0.y - m1.y);
        const target = 0.45 + spread * 3.2;
        st.setZoom(smoothZoom(target));
      }

      // ---- 张开手掌左右移动 = 旋转 ----
      if (m0.openCount >= 4) {
        const sx = smoothX(m0.x);
        const sy = smoothY(m0.y);
        st.nudgeRot((sx - 0.5) * 0.06, (sy - 0.5) * 0.03);
      }

      // ---- 握拳 = 关闭 ----
      if (m0.fist) {
        if (now - s.lastFistAt > 600) {
          s.lastFistAt = now;
          st.clearSelection();
        }
      }

      // ---- 捏合 = 选中最近的照片 ----
      const pinching = m0.pinch < 0.42;
      if (pinching) {
        s.pinchSeen++;
        s.releaseSeen = 0;
        if (!s.pinchOn && s.pinchSeen >= 3 && now - s.lastPinchAt > 500) {
          s.pinchOn = true;
          s.lastPinchAt = now;
          pickNearest(m0.x, m0.y);
        }
      } else {
        s.releaseSeen++;
        s.pinchSeen = 0;
        if (s.pinchOn && s.releaseSeen >= 3 && m0.pinch > 0.75) s.pinchOn = false;
      }
    }

    /** 选中离手最近的那张卡（屏幕上最近） */
    function pickNearest(nx, ny) {
      const st = useStore.getState();
      let bestId = null;
      let bestD = Infinity;
      for (const [id, pos] of cardRegistry) {
        const d = Math.hypot(pos.x - nx, pos.y - ny);
        if (d < bestD) { bestD = d; bestId = id; }
      }
      if (bestId && bestD < 0.45) {
        st.toggleSelect(bestId);
      } else if (st.photos.length) {
        // 手上没对到卡片，就按顺序翻下一张
        const idx = st.photos.findIndex((p) => p.id === st.selectedId);
        st.select(st.photos[(idx + 1) % st.photos.length].id);
      }
    }

    boot();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      const v = videoRef.current;
      const stream = v?.srcObject;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, videoRef]);
}
