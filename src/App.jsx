import { useRef, useState, useEffect } from 'react';
import Scene from './three/Scene.jsx';
import DropZone from './ui/DropZone.jsx';
import ControlBar from './ui/ControlBar.jsx';
import WebcamPiP from './ui/WebcamPiP.jsx';
import { useStore } from './store.js';
import { useGestures } from './gestures/useGestures.js';
import { ingestFiles, releaseAll } from './photo/pipeline.js';

export default function App() {
  const videoRef = useRef();
  const [gestureOn, setGestureOn] = useState(true);
  const photos = useStore((s) => s.photos);
  const selectedId = useStore((s) => s.selectedId);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // 手势（拿不到摄像头会自动不动，鼠标照常可用）
  useGestures(videoRef, gestureOn);

  // 清空时释放 objectURL
  useEffect(() => () => releaseAll(photosRef.current), []);

  // 演示模式：?demo=60 用 public/demo 里的样张循环填充，方便没有照片时预览
  useEffect(() => {
    const m = /[?&]demo=(\d+)/.exec(location.search);
    if (!m) return;
    const want = Math.min(100, Number(m[1]));
    (async () => {
      const urls = ['demo1.jpg', 'demo2.jpg', 'demo3.jpg', 'demo4.jpg'];
      const files = [];
      for (let i = 0; i < want; i++) {
        const name = urls[i % urls.length];
        const res = await fetch(`${import.meta.env.BASE_URL}demo/${name}`);
        const blob = await res.blob();
        files.push(new File([blob], name, { type: 'image/jpeg' }));
      }
      ingestFiles(files);
    })().catch((e) => console.warn('[demo]', e));
  }, []);

  // 键盘兜底：Esc 关闭、空格切形态
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') useStore.getState().clearSelection();
      if (e.code === 'Space') { e.preventDefault(); useStore.getState().toggleShape(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Scene />

      <header className="title">
        <h1>Happy New Year</h1>
        <p className="sub">X And M</p>
      </header>

      <DropZone />
      <ControlBar />
      <WebcamPiP videoRef={videoRef} active={useStore.getState().handActive} />

      {selectedId && (
        <button className="close-focus" onClick={() => useStore.getState().clearSelection()}>
          ✕
        </button>
      )}

      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

      {!gestureOn && (
        <button className="enable-gesture" onClick={() => setGestureOn(true)}>
          开启手势
        </button>
      )}
    </div>
  );
}
