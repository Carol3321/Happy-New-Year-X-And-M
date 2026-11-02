import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store.js';
import { spherePosition, treePosition, tiltFor } from './shapes.js';
import { getStdTexture, loadTexture, pinTexture } from '../photo/textureCache.js';
import { cardRegistry } from './cardRegistry.js';

const CARD_H = 1.25;          // 卡片基准高度（球形态）
const CARD_H_TREE = 0.9;      // 树形态小一点
const FOCUS_H = 6.4;          // 放大后的高度

const GOLD = new THREE.Color('#d4af37');
const FRAME_PAD = 1.16;

/**
 * 照片卡片层：统一在一个 useFrame 里更新所有卡片，
 * 避免 100 个组件各自挂帧回调。
 */
export default function PhotoCards() {
  const { camera, size } = useThree();
  const groupRef = useRef();
  const cardsRef = useRef([]);
  const frameTexRef = useRef(null);   // 当前选中的 hi 纹理

  const photos = useStore((s) => s.photos);
  const selectedId = useStore((s) => s.selectedId);
  const shape = useStore((s) => s.shape);
  const perfMode = useStore((s) => s.perfMode);

  // 卡片几何/材质共享
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const frameGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const frameMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  }), []);

  // 每个照片一份运行时状态
  const runtime = useRef(new Map());
  useEffect(() => {
    const map = runtime.current;
    for (const p of photos) {
      if (!map.has(p.id)) {
        map.set(p.id, {
          pos: new THREE.Vector3(...spherePosition(map.size, 100, 8.4)),
          scale: 0.001,
          tilt: tiltFor(map.size),
        });
      }
    }
  }, [photos]);

  // 选中时加载 hi 层，切换时释放
  useEffect(() => {
    if (!selectedId) {
      if (frameTexRef.current) {
        frameTexRef.current.dispose();
        frameTexRef.current = null;
      }
      return;
    }
    const photo = photos.find((p) => p.id === selectedId);
    if (!photo) return;
    pinTexture(selectedId);
    let alive = true;
    loadTexture(photo.hiUrl)
      .then((tex) => {
        if (!alive) { tex.dispose(); return; }
        frameTexRef.current = tex;
        const card = cardsRef.current.find((c) => c?.userData.id === selectedId);
        if (card) {
          card.material.map = tex;
          card.material.needsUpdate = true;
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedId, photos]);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const projectV = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const { zoom, perfMode: perf } = useStore.getState();
    const morphTarget = shape === 'tree' ? 1 : 0;
    const now = state.clock.elapsedTime;

    // 相机世界朝向（billboard 用）
    const camQuat = camera.quaternion;

    group.updateWorldMatrix(true, false);
    const groupWorldQuat = group.getWorldQuaternion(tmpQ);

    // 聚焦点：世界坐标 (0,0,14) 转到 group 局部
    const focusWorld = new THREE.Vector3(0, 0.6, 14);
    const focusLocal = focusWorld.clone().applyMatrix4(
      new THREE.Matrix4().copy(group.matrixWorld).invert()
    );

    const total = photos.length || 1;

    photos.forEach((photo, i) => {
      const card = cardsRef.current[i];
      if (!card) return;
      const rt = runtime.current.get(photo.id);
      if (!rt) return;

      // ---- 目标位置 ----
      const sphere = spherePosition(i, total, 8.4);
      const tree = treePosition(i, total, 15.5, 5.6);
      const stagger = (i / total) * 0.45;
      const tRaw = THREE.MathUtils.clamp((morphTarget - stagger) / (1 - 0.45), 0, 1);
      const t = tRaw * tRaw * (3 - 2 * tRaw);

      tmpV.set(
        THREE.MathUtils.lerp(sphere[0], tree[0], t),
        THREE.MathUtils.lerp(sphere[1], tree[1], t),
        THREE.MathUtils.lerp(sphere[2], tree[2], t)
      );
      // 换形态时向外鼓一下
      const bump = Math.sin(t * Math.PI) * 1.1;
      tmpV.addScaledVector(tmpV.clone().normalize(), bump);

      // ---- 选中态 ----
      const isFocus = selectedId === photo.id;
      const anyFocus = !!selectedId;

      const targetPos = isFocus ? focusLocal : tmpV;
      const targetScale = isFocus
        ? FOCUS_H
        : THREE.MathUtils.lerp(CARD_H, CARD_H_TREE, t) * (perf ? 0.95 : 1);

      // 阻尼跟随（帧率无关）
      const k = 1 - Math.exp(-(isFocus ? 7.5 : 4.2) * dt);
      rt.pos.lerp(targetPos, k);
      rt.scale += (targetScale - rt.scale) * k;

      card.position.copy(rt.pos);
      card.scale.set(rt.scale * photo.aspect, rt.scale, 1);

      // ---- 朝向 ----
      if (isFocus) {
        // 面向相机
        card.quaternion.copy(groupWorldQuat.clone().invert().multiply(camQuat));
      } else {
        // 微倾斜 + 面向相机
        card.quaternion.copy(groupWorldQuat.clone().invert().multiply(camQuat));
        card.rotateX(rt.tilt[0]);
        card.rotateY(rt.tilt[1]);
        card.rotateZ(rt.tilt[2] + Math.sin(now * 0.5 + i) * 0.05);
      }

      // ---- 纹理（std 层，按需） ----
      if (!isFocus) {
        const tex = getStdTexture(photo);
        if (tex && card.material.map !== tex) {
          card.material.map = tex;
          card.material.needsUpdate = true;
        }
      } else if (frameTexRef.current && card.material.map !== frameTexRef.current) {
        card.material.map = frameTexRef.current;
        card.material.needsUpdate = true;
      }

      // ---- 变暗 ----
      const dim = anyFocus && !isFocus ? 0.22 : 1;
      card.material.color.setScalar(dim);
      card.material.opacity = anyFocus && !isFocus ? 0.55 : 1;

      // ---- 金框 ----
      const frame = card.userData.frame;
      if (frame) {
        frame.visible = isFocus;
        if (isFocus) {
          frame.position.set(0, 0, -0.03);
          frame.scale.set(FRAME_PAD, FRAME_PAD, 1);
        }
      }

      // ---- 给手势用：这张卡在屏幕上的归一化坐标 ----
      projectV.copy(card.position).applyMatrix4(group.matrixWorld).project(camera);
      cardRegistry.set(photo.id, {
        x: projectV.x * 0.5 + 0.5,
        y: 0.5 - projectV.y * 0.5,
      });
    });

    // 整体缩放
    group.scale.setScalar(zoom);
  });

  return (
    <group ref={groupRef}>
      {photos.map((photo, i) => (
        <mesh
          key={photo.id}
          ref={(el) => { cardsRef.current[i] = el; if (el) el.userData.id = photo.id; }}
          geometry={geometry}
          onClick={(e) => {
            e.stopPropagation();
            useStore.getState().toggleSelect(photo.id);
          }}
        >
          <meshBasicMaterial
            transparent
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
          />
          <mesh
            ref={(el) => {
              if (cardsRef.current[i]) cardsRef.current[i].userData.frame = el;
            }}
            geometry={frameGeometry}
            material={frameMaterial}
            visible={false}
            position={[0, 0, -0.02]}
          />
        </mesh>
      ))}
    </group>
  );
}
