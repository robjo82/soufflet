import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Euler, MathUtils, Object3D, Quaternion, Vector3 } from 'three';

interface Accordion3DProps {
  activeButtonIds?: string[];
  bellowsAmount: number;
  onButtonPress?: (buttonId: string) => void;
}

interface MotionNode {
  node: Object3D;
  closedPosition: Vector3;
  openPosition: Vector3;
  closedRotation: Euler;
  openRotation: Euler;
}

const MODEL_URL = '/models/hohner-club-i.glb';

function blenderVector(values: unknown, fallback: Vector3) {
  return Array.isArray(values) && values.length === 3 && values.every((value) => typeof value === 'number')
    ? new Vector3(values[0], values[2], -values[1])
    : fallback.clone();
}

function blenderEuler(values: unknown, fallback: Euler) {
  if (!Array.isArray(values) || values.length !== 3 || !values.every((value) => typeof value === 'number')) return fallback.clone();
  const basis = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  const source = new Quaternion().setFromEuler(new Euler(values[0], values[1], values[2], 'XYZ'));
  const converted = basis.clone().multiply(source).multiply(basis.clone().invert());
  return new Euler().setFromQuaternion(converted, fallback.order);
}

function Model({ activeButtonIds = [], bellowsAmount, onButtonPress }: Accordion3DProps) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const buttonProgress = useRef(new Map<string, number>());

  const contract = useMemo(() => {
    const buttons = new Map<string, { node: Object3D; rest: Vector3; axis: Vector3; depth: number }>();
    const motion: MotionNode[] = [];
    scene.traverse((node) => {
      const buttonId = typeof node.userData.buttonId === 'string' ? node.userData.buttonId : undefined;
      if (buttonId) {
        buttons.set(buttonId, {
          node,
          rest: node.position.clone(),
          axis: blenderVector(node.userData.pressAxis, new Vector3(0, 0, -1)).normalize(),
          depth: typeof node.userData.pressDepth === 'number' ? node.userData.pressDepth : 0.004,
        });
      }
      if (Array.isArray(node.userData.closedPosition) && Array.isArray(node.userData.openPosition)) {
        motion.push({
          node,
          closedPosition: blenderVector(node.userData.closedPosition, node.position),
          openPosition: blenderVector(node.userData.openPosition, node.position),
          closedRotation: blenderEuler(node.userData.closedRotation, node.rotation),
          openRotation: blenderEuler(node.userData.openRotation, node.rotation),
        });
      }
    });
    return { buttons, motion };
  }, [scene]);

  useFrame((_, delta) => {
    const active = new Set(activeButtonIds);
    const easing = 1 - Math.exp(-delta * 18);
    contract.buttons.forEach(({ node, rest, axis, depth }, id) => {
      const current = buttonProgress.current.get(id) ?? 0;
      const progress = MathUtils.lerp(current, active.has(id) ? 1 : 0, easing);
      buttonProgress.current.set(id, progress);
      node.position.copy(rest).addScaledVector(axis, depth * progress);
    });
    const amount = MathUtils.clamp(bellowsAmount, 0, 1);
    contract.motion.forEach(({ node, closedPosition, openPosition, closedRotation, openRotation }) => {
      node.position.lerpVectors(closedPosition, openPosition, amount);
      node.rotation.set(
        MathUtils.lerp(closedRotation.x, openRotation.x, amount),
        MathUtils.lerp(closedRotation.y, openRotation.y, amount),
        MathUtils.lerp(closedRotation.z, openRotation.z, amount),
      );
    });
  });

  return (
    <primitive
      object={scene}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        let target: Object3D | null = event.object;
        while (target && typeof target.userData.buttonId !== 'string') target = target.parent;
        if (target && typeof target.userData.buttonId === 'string') {
          event.stopPropagation();
          onButtonPress?.(target.userData.buttonId);
        }
      }}
    />
  );
}

function LoadingModel() {
  return (
    <mesh>
      <boxGeometry args={[0.28, 0.28, 0.12]} />
      <meshStandardMaterial color="#d9d3c6" wireframe />
    </mesh>
  );
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.02, size.width < 600 ? 1.04 : 0.66);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Accordion3D(props: Accordion3DProps) {
  if (!supportsWebGL()) return null;
  return (
    <div className="accordion-3d-canvas" role="img" aria-label="Accordéon Hohner Club I interactif en trois dimensions">
      <Canvas camera={{ position: [0, 0.02, 0.66], fov: 32, near: 0.01, far: 10 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ResponsiveCamera />
        <color attach="background" args={['#f3efe7']} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[0.4, 0.7, 0.8]} intensity={3.2} />
        <directionalLight position={[-0.5, 0.1, 0.4]} intensity={1.1} color="#ffe4c4" />
        <Suspense fallback={<LoadingModel />}>
          <Model {...props} />
        </Suspense>
        <ContactShadows position={[0, -0.18, 0]} opacity={0.28} scale={1.1} blur={2.5} far={1} />
        <OrbitControls target={[0, 0, 0]} minDistance={0.48} maxDistance={1.35} enablePan={false} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
