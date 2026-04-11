import { mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const destDir = path.join(root, 'public', 'vad-assets');

const staticAssets = [
  {
    from: path.join(root, 'node_modules', '@ricky0123', 'vad-web', 'dist', 'silero_vad_v5.onnx'),
    to: path.join(destDir, 'silero_vad_v5.onnx'),
  },
  {
    from: path.join(root, 'node_modules', '@ricky0123', 'vad-web', 'dist', 'silero_vad_legacy.onnx'),
    to: path.join(destDir, 'silero_vad_legacy.onnx'),
  },
  {
    from: path.join(root, 'node_modules', '@ricky0123', 'vad-web', 'dist', 'vad.worklet.bundle.min.js'),
    to: path.join(destDir, 'vad.worklet.bundle.min.js'),
  },
];

const ortDistDir = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');
const ortDistFiles = await readdir(ortDistDir);
const ortAssets = ortDistFiles
  .filter((name) => /^ort-wasm.*\.(wasm|mjs|js)$/.test(name))
  .map((name) => ({
    from: path.join(ortDistDir, name),
    to: path.join(destDir, name),
  }));

const assets = [...staticAssets, ...ortAssets];

await mkdir(destDir, { recursive: true });
await Promise.all(assets.map(({ from, to }) => copyFile(from, to)));

console.log(`Copied ${assets.length} VAD asset files into public/vad-assets`);
