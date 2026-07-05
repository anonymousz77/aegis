import { InferenceSession } from 'onnxruntime-node'

const sessionCache = new Map<string, Promise<InferenceSession>>()

/**
 * Loads an ONNX model into an inference session, caching by path so repeated
 * calls for the same model reuse the same session instead of reloading it.
 */
export function loadSession(onnxPath: string): Promise<InferenceSession> {
  let cached = sessionCache.get(onnxPath)
  if (!cached) {
    cached = InferenceSession.create(onnxPath)
    sessionCache.set(onnxPath, cached)
  }
  return cached
}
