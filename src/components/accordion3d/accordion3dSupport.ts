let cachedWebGLSupport: boolean | undefined;

export function supportsAccordion3D() {
  if (cachedWebGLSupport !== undefined) return cachedWebGLSupport;
  if (typeof document === 'undefined') return false;
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
