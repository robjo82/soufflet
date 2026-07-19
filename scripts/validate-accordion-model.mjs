import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repository = resolve(import.meta.dirname, '..');
const modelPath = resolve(repository, 'public/models/hohner-club-i.glb');
const manifestPath = resolve(repository, 'public/models/hohner-club-i.manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const model = await readFile(modelPath);

function fail(message) {
  console.error(`Accordion model validation failed: ${message}`);
  process.exitCode = 1;
}

if (model.readUInt32LE(0) !== 0x46546c67) fail('invalid GLB magic header');
if (model.readUInt32LE(4) !== 2) fail('only glTF 2.0 is supported');
const jsonLength = model.readUInt32LE(12);
const jsonType = model.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) fail('the first GLB chunk is not JSON');
const gltf = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8'));
const nodes = new Map((gltf.nodes ?? []).map((node) => [node.name, node]));
const rootNode = nodes.get(manifest.rootNode);

if (rootNode?.extras?.contractVersion !== manifest.contractVersion) {
  fail('the GLB and manifest contract versions differ');
}

for (const name of [manifest.rootNode, manifest.bodyNodes.left, manifest.bodyNodes.right, manifest.bellows.root, ...manifest.bellows.folds]) {
  if (!nodes.has(name)) fail(`missing node ${name}`);
}

for (const name of [manifest.bodyNodes.left, manifest.bodyNodes.right]) {
  const extras = nodes.get(name)?.extras;
  if (!Array.isArray(extras?.closedPosition) || !Array.isArray(extras?.openPosition)) {
    fail(`${name} is missing bellows motion metadata`);
  } else if (extras.closedPosition.every((value, index) => Math.abs(value - extras.openPosition[index]) < 0.0001)) {
    fail(`${name} does not move between the closed and open states`);
  }
  if (!Array.isArray(extras?.closedRotation) || !Array.isArray(extras?.openRotation)) {
    fail(`${name} is missing bellows rotation metadata`);
  } else if (extras.closedRotation.every((value, index) => Math.abs(value - extras.openRotation[index]) < 0.001)) {
    fail(`${name} opens laterally without the required book-like rotation`);
  }
}

if (manifest.bellows.motionStyle !== 'organic-wave') fail('the bellows motion style must be organic-wave');
if (!manifest.bellows.modelRevision) fail('the model revision is required for cache invalidation');

const skinNode = nodes.get(manifest.bellows.skin?.node);
const skinMesh = skinNode?.mesh === undefined ? undefined : gltf.meshes?.[skinNode.mesh];
const targetNames = skinMesh?.extras?.targetNames ?? [];
const skinTargetIndex = targetNames.indexOf(manifest.bellows.skin?.morphTarget);
if (!skinNode || !skinMesh) fail('the continuous bellows skin is missing');
if (skinNode?.extras?.bellowsRole !== 'continuous-skin') fail('the bellows skin role is missing');
if (skinTargetIndex < 0) fail('the organic bellows morph target is missing');
if (skinMesh?.primitives?.some((primitive) => !primitive.targets?.[skinTargetIndex])) {
  fail('the organic bellows morph target is incomplete');
}
const skinPositionAccessors = skinMesh?.primitives
  ?.map((primitive) => primitive.targets?.[skinTargetIndex]?.POSITION)
  .filter((accessor) => accessor !== undefined) ?? [];
const skinExtension = Math.max(0, ...skinPositionAccessors.flatMap((accessor) => {
  const definition = gltf.accessors?.[accessor];
  return [...(definition?.min ?? []), ...(definition?.max ?? [])].map(Math.abs);
}));
if (skinExtension < 0.05) fail(`the bellows skin barely deforms (${skinExtension.toFixed(4)} m)`);

const foldNodes = manifest.bellows.folds.map((name) => nodes.get(name));
const waveAmplitude = Math.max(...foldNodes.map((node) => Math.abs((node?.extras?.openPosition?.[2] ?? 0) - (node?.extras?.closedPosition?.[2] ?? 0))));
const depthAmplitude = Math.max(...foldNodes.map((node) => Math.abs((node?.extras?.openPosition?.[1] ?? 0) - (node?.extras?.closedPosition?.[1] ?? 0))));
if (waveAmplitude < 0.01) fail(`bellows vertical wave is too flat (${waveAmplitude.toFixed(4)} m)`);
if (depthAmplitude < 0.004) fail(`bellows depth curve is too flat (${depthAmplitude.toFixed(4)} m)`);

const buttons = [...manifest.melodyButtons, ...manifest.bassButtons];
if (manifest.melodyButtons.length !== 21) fail(`expected 21 melody buttons, found ${manifest.melodyButtons.length}`);
if (manifest.bassButtons.length !== 8) fail(`expected 8 bass buttons, found ${manifest.bassButtons.length}`);
if (new Set(buttons.map((button) => button.id)).size !== buttons.length) fail('button IDs are not unique');

for (const button of buttons) {
  const node = nodes.get(button.node);
  if (!node) {
    fail(`missing button node ${button.node}`);
    continue;
  }
  if (node.extras?.buttonId !== button.id) fail(`${button.node} exports the wrong buttonId`);
  if (!Array.isArray(node.extras?.pressAxis) || typeof node.extras?.pressDepth !== 'number') {
    fail(`${button.node} is missing its press animation contract`);
  }
}

let triangles = 0;
for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    const accessor = primitive.indices === undefined ? primitive.attributes?.POSITION : primitive.indices;
    const count = gltf.accessors?.[accessor]?.count ?? 0;
    if ((primitive.mode ?? 4) === 4) triangles += Math.floor(count / 3);
  }
}

if (model.byteLength > manifest.performanceBudget.maximumBytes) {
  fail(`GLB is ${model.byteLength} bytes; budget is ${manifest.performanceBudget.maximumBytes}`);
}
if (triangles > manifest.performanceBudget.maximumTriangles) {
  fail(`GLB has ${triangles} triangles; budget is ${manifest.performanceBudget.maximumTriangles}`);
}

if (!process.exitCode) {
  console.log(`Accordion model valid: ${model.byteLength} bytes, ${triangles} triangles, ${buttons.length} interactive buttons.`);
}
