import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Color, Euler, MathUtils, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';

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
  foldPhase?: number;
}

interface MorphNode {
  influences: number[];
  targetIndex: number;
}

interface ButtonVisual {
  material: MeshStandardMaterial;
  restEmissive: Color;
  restEmissiveIntensity: number;
}

interface ButtonNode {
  node: Object3D;
  rest: Vector3;
  restScale: Vector3;
  axis: Vector3;
  depth: number;
  visuals: ButtonVisual[];
}

// Public models keep a stable filename, so the revision must change whenever
// their binary content changes. This also invalidates useGLTF's in-memory cache.
const MODEL_URL = '/models/hohner-club-i.glb?revision=organic-wave-2';
const ACTIVE_BUTTON_COLOR = new Color('#ff5738');

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
  const smoothedBellowsAmount = useRef(bellowsAmount);

  const contract = useMemo(() => {
    const buttons = new Map<string, ButtonNode>();
    const motion: MotionNode[] = [];
    const morphs: MorphNode[] = [];
    scene.traverse((node) => {
      const buttonId = typeof node.userData.buttonId === 'string' ? node.userData.buttonId : undefined;
      if (buttonId) {
        const visuals: ButtonVisual[] = [];
        node.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
          const clonedMaterials = sourceMaterials.map((material) => material.clone());
          child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
          clonedMaterials.forEach((material) => {
            if (!(material instanceof MeshStandardMaterial)) return;
            visuals.push({
              material,
              restEmissive: material.emissive.clone(),
              restEmissiveIntensity: material.emissiveIntensity,
            });
          });
        });
        buttons.set(buttonId, {
          node,
          rest: node.position.clone(),
          restScale: node.scale.clone(),
          axis: blenderVector(node.userData.pressAxis, new Vector3(0, 0, -1)).normalize(),
          depth: typeof node.userData.pressDepth === 'number' ? node.userData.pressDepth : 0.004,
          visuals,
        });
      }
      if (Array.isArray(node.userData.closedPosition) && Array.isArray(node.userData.openPosition)) {
        motion.push({
          node,
          closedPosition: blenderVector(node.userData.closedPosition, node.position),
          openPosition: blenderVector(node.userData.openPosition, node.position),
          closedRotation: blenderEuler(node.userData.closedRotation, node.rotation),
          openRotation: blenderEuler(node.userData.openRotation, node.rotation),
          foldPhase: node.userData.bellowsRole === 'fold' && typeof node.userData.normalized_position === 'number'
            ? node.userData.normalized_position
            : undefined,
        });
      }
      const morphTarget = typeof node.userData.morphTarget === 'string' ? node.userData.morphTarget : undefined;
      if (morphTarget) {
        node.traverse((morphNode) => {
          if (!(morphNode instanceof Mesh) || !morphNode.morphTargetDictionary || !morphNode.morphTargetInfluences) return;
          const targetIndex = morphNode.morphTargetDictionary[morphTarget];
          if (typeof targetIndex === 'number') morphs.push({ influences: morphNode.morphTargetInfluences, targetIndex });
        });
      }
    });
    return { buttons, motion, morphs };
  }, [scene]);

  useEffect(() => () => {
    contract.buttons.forEach(({ visuals }) => visuals.forEach(({ material }) => material.dispose()));
  }, [contract]);

  useFrame((_, delta) => {
    const active = new Set(activeButtonIds);
    const easing = 1 - Math.exp(-delta * 18);
    contract.buttons.forEach(({ node, rest, restScale, axis, depth, visuals }, id) => {
      const current = buttonProgress.current.get(id) ?? 0;
      const progress = MathUtils.lerp(current, active.has(id) ? 1 : 0, easing);
      buttonProgress.current.set(id, progress);
      node.position.copy(rest).addScaledVector(axis, depth * progress);
      node.scale.copy(restScale).multiplyScalar(1 + progress * 0.055);
      visuals.forEach(({ material, restEmissive, restEmissiveIntensity }) => {
        material.emissive.copy(restEmissive).lerp(ACTIVE_BUTTON_COLOR, progress);
        material.emissiveIntensity = restEmissiveIntensity + progress * 1.35;
      });
    });
    const targetAmount = MathUtils.clamp(bellowsAmount, 0, 1);
    const amount = MathUtils.damp(smoothedBellowsAmount.current, targetAmount, 6.5, delta);
    const inertia = MathUtils.clamp(targetAmount - amount, -0.16, 0.16);
    smoothedBellowsAmount.current = amount;
    contract.morphs.forEach(({ influences, targetIndex }) => {
      influences[targetIndex] = amount;
    });
    contract.motion.forEach(({ node, closedPosition, openPosition, closedRotation, openRotation, foldPhase }) => {
      node.position.lerpVectors(closedPosition, openPosition, amount);
      node.rotation.set(
        MathUtils.lerp(closedRotation.x, openRotation.x, amount),
        MathUtils.lerp(closedRotation.y, openRotation.y, amount),
        MathUtils.lerp(closedRotation.z, openRotation.z, amount),
      );
      if (foldPhase !== undefined) {
        const centerWeight = 1 - foldPhase * foldPhase;
        node.position.y += Math.sin(Math.PI * foldPhase) * inertia * 0.035;
        node.position.z += centerWeight * inertia * 0.018;
        node.rotation.z += Math.cos(Math.PI * foldPhase) * inertia * 0.12;
      }
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

function ResponsiveCamera({ bellowsAmount }: Pick<Accordion3DProps, 'bellowsAmount'>) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.2, size.width < 600 ? 1.6 : 1.25);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  useFrame((_, delta) => {
    const opening = MathUtils.clamp(bellowsAmount, 0, 1);
    const targetDistance = size.width < 600 ? 1.6 + opening * 0.15 : 1.25 + opening * 0.12;
    camera.position.z = MathUtils.damp(camera.position.z, targetDistance, 7, delta);
    camera.position.y = MathUtils.damp(camera.position.y, 0.2 - opening * 0.008, 7, delta);
  });
  return null;
}

let cachedWebGLSupport: boolean | undefined;

function supportsWebGL() {
  if (cachedWebGLSupport !== undefined) return cachedWebGLSupport;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    cachedWebGLSupport = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

export function Accordion3D(props: Accordion3DProps) {
  if (!supportsWebGL()) return null;
  return (
    <div className="accordion-3d-canvas" role="img" aria-label="Accordéon Hohner Club I interactif en trois dimensions">
      <Canvas camera={{ position: [0, 0.2, 1.25], fov: 32, near: 0.01, far: 10 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ResponsiveCamera bellowsAmount={props.bellowsAmount} />
        <color attach="background" args={['#f3efe7']} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[0.4, 0.7, 0.8]} intensity={3.2} />
        <directionalLight position={[-0.5, 0.1, 0.4]} intensity={1.1} color="#ffe4c4" />
        <Suspense fallback={<LoadingModel />}>
          <Model {...props} />
        </Suspense>
        <ContactShadows position={[0, -0.18, 0]} opacity={0.28} scale={1.1} blur={2.5} far={1} />
        <OrbitControls target={[0, 0.2, 0]} minDistance={0.65} maxDistance={2.4} enablePan={false} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
