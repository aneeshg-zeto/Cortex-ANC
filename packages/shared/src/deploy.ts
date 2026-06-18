/** Production / Railway slim deployment flags. */

export function isRailwayDeploy(): boolean {
  return process.env.RAILWAY_ENV === 'true';
}

export function isBackgroundIngestionEnabled(): boolean {
  if (isRailwayDeploy()) return false;
  return Boolean(process.env.TEMPORAL_ADDRESS?.trim());
}

export function isLiteLLMEnabled(): boolean {
  if (isRailwayDeploy()) return false;
  const url = process.env.LITELLM_URL?.trim();
  return Boolean(url);
}
