import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { getAccordionDirectionGuide } from '../../accordion3dGuides';
import type { Direction } from '../../types';
import { supportsAccordion3D } from './accordion3dSupport';
import {
  CanvasTexture,
  Color,
  Euler,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

export interface Accordion3DProps {
  activeButtonIds?: string[];
  highlightedButtonIds?: string[];
  pressedButtonIds?: string[];
  detectedButtonIds?: string[];
  selectedButtonIds?: string[];
  bellowsAmount: number;
  direction?: Direction;
  onButtonPress?: (buttonId: string) => void;
  showLearningGuides?: boolean;
  airValveActive?: boolean;
  allowOrbit?: boolean;
  framing?: 'standard' | 'compact';
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
  guide: Sprite;
  visuals: ButtonVisual[];
}

// Public models keep a stable filename, so the revision must change whenever
// their binary content changes. This also invalidates useGLTF's in-memory cache.
const MODEL_URL = '/models/hohner-club-i.glb?revision=organic-wave-3';
const ACTIVE_BUTTON_COLOR = new Color('#46c9f2');
const DETECTED_BUTTON_COLOR = new Color('#57d89b');
const SELECTED_BUTTON_COLOR = new Color('#ffc95d');
const STANDARD_BUTTON_COLOR = new Color('#ff5738');

function createButtonGuideTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 22, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.22)');
    gradient.addColorStop(0.52, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.44)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

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

function Model({
  activeButtonIds = [],
  highlightedButtonIds,
  pressedButtonIds,
  detectedButtonIds = [],
  selectedButtonIds = [],
  bellowsAmount,
  onButtonPress,
  showLearningGuides = true,
}: Accordion3DProps) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const buttonProgress = useRef(new Map<string, number>());
  const buttonPressProgress = useRef(new Map<string, number>());
  const smoothedBellowsAmount = useRef(bellowsAmount);
  const guidePulseTime = useRef(0);
  const guideTexture = useMemo(createButtonGuideTexture, []);

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
          guide: (() => {
            const guideName = `${buttonId}-learning-guide`;
            const existingGuide = node.getObjectByName(guideName);
            if (existingGuide instanceof Sprite) return existingGuide;
            const axis = blenderVector(node.userData.pressAxis, new Vector3(0, 0, -1)).normalize();
            const material = new SpriteMaterial({
              map: guideTexture,
              color: '#d5f6ff',
              transparent: true,
              opacity: 0,
              depthTest: false,
              depthWrite: false,
            });
            const guide = new Sprite(material);
            guide.name = guideName;
            guide.position.copy(axis).multiplyScalar(-0.008);
            guide.scale.setScalar(0.036);
            guide.renderOrder = 20;
            guide.visible = false;
            node.add(guide);
            return guide;
          })(),
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
  }, [guideTexture, scene]);

  useEffect(() => () => {
    contract.buttons.forEach(({ guide, visuals }) => {
      guide.removeFromParent();
      guide.material.dispose();
      visuals.forEach(({ material }) => material.dispose());
    });
    guideTexture.dispose();
  }, [contract, guideTexture]);

  useFrame((_, delta) => {
    guidePulseTime.current += delta;
    const highlighted = new Set(highlightedButtonIds ?? activeButtonIds);
    const pressed = new Set(pressedButtonIds ?? activeButtonIds);
    const detected = new Set(detectedButtonIds);
    const selected = new Set(selectedButtonIds);
    const easing = 1 - Math.exp(-delta * 18);
    contract.buttons.forEach(({ node, rest, restScale, axis, depth, guide, visuals }, id) => {
      const current = buttonProgress.current.get(id) ?? 0;
      const isHighlighted = highlighted.has(id) || pressed.has(id) || detected.has(id) || selected.has(id);
      const progress = MathUtils.lerp(current, isHighlighted ? 1 : 0, easing);
      const currentPress = buttonPressProgress.current.get(id) ?? 0;
      const pressProgress = MathUtils.lerp(currentPress, pressed.has(id) ? 1 : 0, easing);
      buttonProgress.current.set(id, progress);
      buttonPressProgress.current.set(id, pressProgress);
      node.position.copy(rest).addScaledVector(axis, depth * pressProgress);
      node.scale.copy(restScale).multiplyScalar(1 + pressProgress * 0.055);
      const pulse = 1 + Math.sin(guidePulseTime.current * 5.4) * 0.08;
      const emphasisColor = selected.has(id)
        ? SELECTED_BUTTON_COLOR
        : detected.has(id)
          ? DETECTED_BUTTON_COLOR
          : showLearningGuides
            ? ACTIVE_BUTTON_COLOR
            : STANDARD_BUTTON_COLOR;
      guide.visible = showLearningGuides && progress > 0.01;
      guide.material.opacity = progress * 0.94;
      guide.material.color.copy(emphasisColor);
      guide.scale.setScalar((0.036 + progress * 0.01) * pulse);
      visuals.forEach(({ material, restEmissive, restEmissiveIntensity }) => {
        material.emissive.copy(restEmissive).lerp(emphasisColor, progress);
        material.emissiveIntensity = restEmissiveIntensity + progress * 1.9;
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

function ResponsiveCamera({ bellowsAmount, allowOrbit, framing = 'standard' }: Pick<Accordion3DProps, 'bellowsAmount' | 'allowOrbit' | 'framing'>) {
  const { camera, size } = useThree();
  const squareStage = size.height >= size.width * 0.58;
  const closedDistance = framing === 'compact'
    ? size.width < 420 ? 0.76 : 0.62
    : allowOrbit
    ? squareStage ? (size.width < 420 ? 1.02 : 0.88) : size.width < 600 ? 1.6 : 1.25
    : size.width < 420 ? 0.88 : 0.8;
  useEffect(() => {
    camera.position.set(0, 0.01, closedDistance);
    camera.lookAt(0, 0.01, 0);
    camera.updateProjectionMatrix();
  }, [camera, closedDistance]);
  useFrame((_, delta) => {
    const opening = MathUtils.clamp(bellowsAmount, 0, 1);
    const targetDistance = closedDistance + opening * (framing === 'compact' ? 0.12 : allowOrbit ? (squareStage ? 0.3 : 0.12) : 0.24);
    camera.position.z = MathUtils.damp(camera.position.z, targetDistance, 7, delta);
    camera.position.y = MathUtils.damp(camera.position.y, 0.01 - opening * 0.008, 7, delta);
  });
  return null;
}

export function Accordion3D(props: Accordion3DProps) {
  if (!supportsAccordion3D()) return null;
  const directionGuide = getAccordionDirectionGuide(props.direction ?? 'pull');
  return (
    <div className={`accordion-3d-canvas ${props.allowOrbit ? 'is-orbit-enabled' : ''}`} role="img" aria-label="Accordéon Hohner Club I interactif en trois dimensions">
      <Canvas camera={{ position: [0, 0.2, 1.25], fov: 32, near: 0.01, far: 10 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ResponsiveCamera bellowsAmount={props.bellowsAmount} allowOrbit={props.allowOrbit} framing={props.framing} />
        <color attach="background" args={['#f3efe7']} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[0.4, 0.7, 0.8]} intensity={3.2} />
        <directionalLight position={[-0.5, 0.1, 0.4]} intensity={1.1} color="#ffe4c4" />
        <Suspense fallback={<LoadingModel />}>
          <Model {...props} />
        </Suspense>
        <ContactShadows position={[0, -0.18, 0]} opacity={0.28} scale={1.1} blur={2.5} far={1} />
        {props.allowOrbit && <OrbitControls target={[0, 0.01, 0]} minDistance={0.65} maxDistance={2.4} enablePan={false} />}
      </Canvas>
      {props.showLearningGuides !== false && (
        <>
        <div className={`accordion-3d-gesture is-${props.direction ?? 'pull'}`} role="status">
          <small>{props.direction === 'pull' ? 'OUVRIR' : 'FERMER'}</small>
          <strong>{props.direction === 'pull' ? 'Tirer le soufflet' : 'Pousser le soufflet'}</strong>
        </div>
        <div
          className={`accordion-3d-direction-guides is-${props.direction ?? 'pull'}`}
          role="status"
          aria-label={directionGuide.label}
        >
          <span className="accordion-3d-direction-guide is-left" aria-hidden="true">
            <b>{directionGuide.leftArrow}</b>
          </span>
          <span className="accordion-3d-direction-guide is-right" aria-hidden="true">
            <b>{directionGuide.rightArrow}</b>
          </span>
        </div>
        </>
      )}
      {props.airValveActive && <div className="accordion-3d-air-guide" role="status"><b>Soupape</b><span>Recentrer sans jouer</span></div>}
    </div>
  );
}

useGLTF.preload(MODEL_URL);
