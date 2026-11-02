import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 星空：远处一圈点，纯 shader 闪烁。
 */
export default function Stars({ count = 1200, radius = 90 }) {
  const ref = useRef();

  const { positions, phases, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const rad = radius * (0.75 + Math.random() * 0.35);
      positions[i * 3] = Math.cos(theta) * r * rad;
      positions[i * 3 + 1] = u * rad;
      positions[i * 3 + 2] = Math.sin(theta) * r * rad;
      phases[i] = Math.random();
      sizes[i] = 0.6 + Math.random() * 1.8;
    }
    return { positions, phases, sizes };
  }, [count, radius]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTwinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 6.283), 2.0);
        gl_PointSize = aSize * uPixelRatio * (1.6 + vTwinkle * 1.6);
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d)) * vTwinkle;
        gl_FragColor = vec4(vec3(1.0), a * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.008;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
