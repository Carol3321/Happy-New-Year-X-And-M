import { useEffect, useRef } from 'react';

/**
 * 右下角摄像头画中画。只负责显示镜像画面（手势识别在 useGestures 里跑）。
 */
export default function WebcamPiP({ videoRef, active }) {
  const canvasRef = useRef();
  const raf = useRef(0);

  useEffect(() => {
    if (!active) return;
    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) return;
      const ctx = c.getContext('2d');
      ctx.save();
      ctx.scale(-1, 1);                       // 镜像
      ctx.drawImage(v, -c.width, 0, c.width, c.height);
      ctx.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [active, videoRef]);

  return (
    <div className={`pip ${active ? 'on' : ''}`}>
      <canvas ref={canvasRef} width={192} height={144} />
      {!active && <span className="pip-off">摄像头未启用 · 鼠标可用</span>}
    </div>
  );
}
