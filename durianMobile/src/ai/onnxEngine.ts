import { Asset } from 'expo-asset';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import { bundledArtifacts } from './bundled';
import { ScanRuntimeError } from './decode';
import type { ModelEntry } from './manifest';
import { centerCrop, fitInside, letterbox, tensorDims, toTensorData } from './preprocess';
import type { InferenceEngine } from './router';

const sessions = new Map<string, Promise<InferenceSession>>();

function load(entry: ModelEntry): Promise<InferenceSession> {
  const key = `${entry.model_id}@${entry.version}`;
  let session = sessions.get(key);
  if (!session) {
    session = (async () => {
      const module = bundledArtifacts[entry.artifact.path];
      if (module == null) throw new ScanRuntimeError('model_load');
      const [asset] = await Asset.loadAsync(module);
      if (!asset?.localUri) throw new ScanRuntimeError('model_load');
      return InferenceSession.create(asset.localUri);
    })().catch((e) => {
      sessions.delete(key);
      throw e instanceof ScanRuntimeError ? e : new ScanRuntimeError('model_load');
    });
    sessions.set(key, session);
  }
  return session;
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** The image at the model's input size as RGBA, decoded in JS (the sizes involved are small). */
async function pixels(uri: string, input: ModelEntry['input']) {
  try {
    let source = ImageManipulator.manipulate(uri);
    if (input.resize === 'letterbox' && input.pad) {
      const full = await source.renderAsync();
      const fit = fitInside(full.width, full.height, Math.max(input.width, input.height));
      const resized = await ImageManipulator.manipulate(full).resize(fit).renderAsync();
      const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
      if (!saved.base64) throw new Error('no pixels');
      const image = jpeg.decode(fromBase64(saved.base64), { useTArray: true, formatAsRGBA: true });
      if (image.width !== fit.width || image.height !== fit.height) throw new Error('size');
      return letterbox(image.data, image.width, image.height, input.width, input.pad);
    }
    if (input.resize === 'center_crop') {
      const full = await source.renderAsync();
      source = ImageManipulator.manipulate(full).crop(
        centerCrop(full.width, full.height, input.width, input.height),
      );
    }
    const resized = await source.resize({ width: input.width, height: input.height }).renderAsync();
    const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
    if (!saved.base64) throw new Error('no pixels');
    const image = jpeg.decode(fromBase64(saved.base64), { useTArray: true, formatAsRGBA: true });
    if (image.width !== input.width || image.height !== input.height) throw new Error('size');
    return image.data;
  } catch {
    throw new ScanRuntimeError('image');
  }
}

/** ONNX Runtime on the phone (brief §5). Unverified on a device until a real model is in the build. */
export const onnxEngine: InferenceEngine = {
  async classify(entry, imageUri) {
    const session = await load(entry);
    const rgba = await pixels(imageUri, entry.input);
    const tensor = new Tensor('float32', toTensorData(rgba, entry.input), tensorDims(entry.input));
    try {
      const out = await session.run({ [entry.input.name]: tensor });
      const result = out[entry.output.name];
      if (!result) throw new Error('no output');
      return Array.from(result.data as Float32Array);
    } catch {
      throw new ScanRuntimeError('run');
    }
  },
};
