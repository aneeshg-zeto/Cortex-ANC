/** Production / Railway slim deployment flags. */

export function isRailwayDeploy(): boolean {
  return process.env.RAILWAY_ENV === 'true';
}

/** Temporal worker + Kafka pipeline (local / full stack). */
export function isTemporalIngestEnabled(): boolean {
  if (isRailwayDeploy()) return false;
  return Boolean(process.env.TEMPORAL_ADDRESS?.trim());
}

/** Bun subprocess ingest on Railway or local dev without Temporal. */
export function isDirectIngestEnabled(): boolean {
  if (process.env.DISABLE_DIRECT_INGEST === 'true') return false;
  if (isRailwayDeploy()) return true;
  return process.env.ENABLE_DIRECT_INGEST !== 'false';
}

export function isBackgroundIngestionEnabled(): boolean {
  return isTemporalIngestEnabled() || isDirectIngestEnabled();
}

export function isLiteLLMEnabled(): boolean {
  if (isRailwayDeploy()) return false;
  const url = process.env.LITELLM_URL?.trim();
  return Boolean(url);
}
