import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store.js';
import { spherePosition, treePosition } from './shapes.js';

/**
 * 金色发光粒子：球 ⇄ 树 两套位置，靠 uMorph 在 shader 里插值。
 * 每个粒子有自己的延迟，所以切换时是"错峰散开再汇聚"。
 */
export default function GoldDust({ count = 2600, reduce = false }) {
  const ref = useRef();
  const morph = useRef(0);

  const n = reduce ? Math.floor(count * 0.4) : count;

  const { sphere, tree, sizes, phases, delays } = useMemo(() => {
    const sphere = new Float32Array(n * 3);
    const tree = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const delays = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // 粒子比照片更靠外一点，包住照片云
      const s = spherePosition(i, n, 9.2 + (i % 7) * 0.22);
      sphere.set(s, i * 3);
      const t = treePosition(i, n, 16.5, 6.0);
      tree.set([t[0], t[1] + 0.4, t[2]], i * 3);
      sizes[i] = 0.7 + Math.random() * 2.0;
      phases[i] = Math.random();
      delays[i] = Math.random();
    }
    return { sphere, tree, sizes, phases, delays };
  }, [n]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aTree;
      attribute float aSize;
      attribute float aPhase;
      attribute float aDelay;
      uniform float uTime;
      uniform float uMorph;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        float d = aDelay * 0.45;
        float t = clamp((uMorph - d) / (1.0 - 0.45), 0.0, 1.0);
        t = t * t * (3.0 - 2.0 * t);

        // 过渡时先往外鼓一下，视觉上是"散开再汇聚"
        vec3 base = mix(position, aTree, t);
        float bump = sin(t * 3.14159) * 0.9;
        vec3 dir = normalize(base + vec3(0.001));
        vec3 p = base + dir * bump;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        float tw = 0.55 + 0.45 * sin(uTime * 2.4 + aPhase * 6.283);
        gl_PointSize = aSize * tw * uPixelRatio * (150.0 / -mv.z);
        vAlpha = 0.30 + 0.45 * tw;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float core = smoothstep(0.5, 0.05, r);
        vec3 col = mix(vec3(1.0, 0.62, 0.12), vec3(1.0, 0.88, 0.55), core);
        gl_FragColor = vec4(col, core * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame((state, dt) => {
    const { shape } = useStore.getState();
    const target = shape === 'tree' ? 1 : 0;
    morph.current += (target - morph.current) * (1 - Math.exp(-2.6 * dt));
    material.uniforms.uMorph.value = morph.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[sphere, 3]} />
        <bufferAttribute attach="attributes-aTree" args={[tree, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aDelay" args={[delays, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
