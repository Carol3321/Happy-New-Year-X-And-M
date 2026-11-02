import { useRef, useState, useCallback } from 'react';
import { useStore } from '../store.js';
import { ingestFiles } from '../photo/pipeline.js';

/**
 * 空状态 / 拖拽上传。
 * 没有 "ADD MEMORIES" 按钮：直接把照片拖进来，或者点任意位置选文件。
 */
export default function DropZone() {
  const photos = useStore((s) => s.photos);
  const loading = useStore((s) => s.loading);
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  const pick = useCallback((files) => {
    if (files && files.length) ingestFiles(files);
  }, []);

  const empty = photos.length === 0;

  return (
    <div
      className={`dropzone ${over ? 'is-over' : ''} ${empty ? 'is-empty' : 'is-mini'}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />

      {empty ? (
        <div className="drop-inner">
          <div className="drop-ring" />
          <p className="drop-title">把照片拖进来</p>
          <p className="drop-sub">最多 100 张 · 点击这里也可以选择</p>
        </div>
      ) : (
        <div className="drop-mini">
          <span>+</span>
          <em>{loading.done}/{loading.total || photos.length}</em>
        </div>
      )}
    </div>
  );
}
