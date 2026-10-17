/**
 * Can this browser draw the 3D views? Three.js needs WebGL 2. It is missing when hardware acceleration is switched off, on some old graphics drivers and
 * in a few older browsers; the 3D pages then show a clear message instead of failing. Returns `null` when WebGL 2 works.
 */
export function webGlProblem(): 'no-webgl2' | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no-webgl2';
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // give the test context back at once (browsers keep only a few)
    return null;
  } catch {
    return 'no-webgl2';
  }
}
