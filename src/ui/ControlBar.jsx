import { useStore } from '../store.js';

/** 底部控制条：形态切换 / 音乐 / 性能模式 */
export default function ControlBar() {
  const shape = useStore((s) => s.shape);
  const toggleShape = useStore((s) => s.toggleShape);
  const musicOn = useStore((s) => s.musicOn);
  const toggleMusic = useStore((s) => s.toggleMusic);
  const perfMode = useStore((s) => s.perfMode);
  const togglePerf = useStore((s) => s.togglePerf);
  const handActive = useStore((s) => s.handActive);
  const photos = useStore((s) => s.photos);

  return (
    <div className="bar">
      <button onClick={toggleShape} title="切换形态">
        {shape === 'sphere' ? '★ 星云' : '▲ 圣诞树'}
      </button>
      <button onClick={toggleMusic} className={musicOn ? 'on' : ''} title="背景音乐">
        {musicOn ? '♪ 开' : '♪ 关'}
      </button>
      <button onClick={togglePerf} className={perfMode ? 'on' : ''} title="性能模式">
        性能
      </button>
      <span className="bar-info">
        {photos.length} 张 · {handActive ? '手势已连接' : '鼠标模式'}
      </span>
    </div>
  );
}
