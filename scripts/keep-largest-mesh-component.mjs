import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: node keep-largest-mesh-component.mjs input.gltf output.gltf');
}

const gltf = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const inputDirectory = path.dirname(inputPath);
const buffer = fs.readFileSync(path.join(inputDirectory, gltf.buffers[0].uri));
const primitive = gltf.meshes[0].primitives[0];
const indexAccessor = gltf.accessors[primitive.indices];
const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
const indexView = gltf.bufferViews[indexAccessor.bufferView];
const positionView = gltf.bufferViews[positionAccessor.bufferView];

const indexOffset = (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0);
const IndexArray = indexAccessor.componentType === 5125 ? Uint32Array : Uint16Array;
const indices = new IndexArray(buffer.buffer, buffer.byteOffset + indexOffset, indexAccessor.count);
const positionStride = positionView.byteStride ?? 12;
const positionOffset = (positionView.byteOffset ?? 0) + (positionAccessor.byteOffset ?? 0);
const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const positions = Array.from({ length: positionAccessor.count }, (_, index) => {
  const offset = positionOffset + index * positionStride;
  return [
    dataView.getFloat32(offset, true),
    dataView.getFloat32(offset + 4, true),
    dataView.getFloat32(offset + 8, true),
  ];
});

const canonicalByPosition = new Map();
const canonicalVertices = new Int32Array(positions.length);
let canonicalCount = 0;
positions.forEach((position, index) => {
  const key = position.map((value) => Math.round(value * 10000)).join(',');
  if (!canonicalByPosition.has(key)) canonicalByPosition.set(key, canonicalCount++);
  canonicalVertices[index] = canonicalByPosition.get(key);
});

const parents = Int32Array.from({ length: canonicalCount }, (_, index) => index);
function find(vertex) {
  if (parents[vertex] !== vertex) parents[vertex] = find(parents[vertex]);
  return parents[vertex];
}
function union(first, second) {
  const firstRoot = find(first);
  const secondRoot = find(second);
  if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
}

for (let index = 0; index < indices.length; index += 3) {
  const first = canonicalVertices[indices[index]];
  union(first, canonicalVertices[indices[index + 1]]);
  union(first, canonicalVertices[indices[index + 2]]);
}

const triangleCounts = new Map();
for (let index = 0; index < indices.length; index += 3) {
  const root = find(canonicalVertices[indices[index]]);
  triangleCounts.set(root, (triangleCounts.get(root) ?? 0) + 1);
}
const largestRoot = [...triangleCounts.entries()].sort((first, second) => second[1] - first[1])[0][0];
const keptIndices = [];
for (let index = 0; index < indices.length; index += 3) {
  if (find(canonicalVertices[indices[index]]) !== largestRoot) continue;
  keptIndices.push(indices[index], indices[index + 1], indices[index + 2]);
}

const filteredIndices = new IndexArray(keptIndices);
const padding = (4 - (buffer.byteLength % 4)) % 4;
const filteredIndexBuffer = Buffer.from(filteredIndices.buffer);
const outputBuffer = Buffer.concat([buffer, Buffer.alloc(padding), filteredIndexBuffer]);
const newBufferView = gltf.bufferViews.push({
  buffer: 0,
  byteOffset: buffer.byteLength + padding,
  byteLength: filteredIndexBuffer.byteLength,
  target: 34963,
}) - 1;
const newAccessor = gltf.accessors.push({
  type: 'SCALAR',
  componentType: indexAccessor.componentType,
  count: filteredIndices.length,
  bufferView: newBufferView,
  byteOffset: 0,
}) - 1;

primitive.indices = newAccessor;
gltf.buffers[0].byteLength = outputBuffer.byteLength;
const outputBufferName = `${path.parse(outputPath).name}.bin`;
gltf.buffers[0].uri = outputBufferName;
fs.writeFileSync(path.join(path.dirname(outputPath), outputBufferName), outputBuffer);
fs.writeFileSync(outputPath, `${JSON.stringify(gltf, null, 2)}\n`);

console.log(`Kept ${filteredIndices.length / 3} of ${indices.length / 3} triangles.`);
