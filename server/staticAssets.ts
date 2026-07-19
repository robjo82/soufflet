export const REVALIDATED_MODEL_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

export function staticAssetCacheControl(filePath: string) {
  return /[/\\]models[/\\].+\.(?:glb|json)$/i.test(filePath)
    ? REVALIDATED_MODEL_CACHE_CONTROL
    : undefined;
}
