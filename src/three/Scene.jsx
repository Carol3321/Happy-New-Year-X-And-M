import { Canvas } from '@react-three/fiber';
import { OrbitControls, AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Suspense } from 'react';
import Stars from './Stars.jsx';
import GoldDust from './GoldDust.jsx';
import PhotoCards from './PhotoCards.jsx';
import { useStore } from '../store.js';

/**
 * 场景容器：黑底 + 星空 + 金色粒子 + 照片卡片 + 泛光。
 * 没有摄像头时用 OrbitControls 兜底。
 */
function World() {
  const handActive = useStore((s) => s.handActive);
  const perfMode = useStore((s) => s.perfMode);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fogExp2 attach="fog" args={['#000000', 0.012]} />

      <Suspense fallback={null}>
        <group rotation={[0, 0, 0]}>
          <Stars count={perfMode ? 600 : 1400} />
          <GoldDust reduce={perfMode} />
          <PhotoCards />
        </group>
      </Suspense>

      {/* 没有手势识别时用鼠标/触摸旋转 */}
      {!handActive && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={14}
          maxDistance={40}
          rotateSpeed={0.45}
          dampingFactor={0.08}
          autoRotate={!useStore.getState().selectedId}
          autoRotateSpeed={0.35}
        />
      )}

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function Scene() {
  const perfMode = useStore((s) => s.perfMode);

  return (
    <Canvas
      dpr={[1, perfMode ? 1.5 : 2]}
      camera={{ position: [0, 1.5, 26], fov: 45, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => useStore.getState().clearSelection()}
    >
      <World />
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom
          intensity={perfMode ? 0.32 : 0.5}
          luminanceThreshold={0.52}
          luminanceSmoothing={0.22}
          mipmapBlur
          radius={0.6}
        />
      </EffectComposer>
    </Canvas>
  );
}
