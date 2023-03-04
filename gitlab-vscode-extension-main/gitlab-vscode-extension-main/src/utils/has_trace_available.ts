export function hasTraceAvailable(job: RestJob): boolean {
  return Boolean(job.started_at && !job.erased_at);
}
