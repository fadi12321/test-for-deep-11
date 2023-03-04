export function isArtifactDownloadable(artifact: RestArtifact) {
  return artifact.file_type !== 'trace' && artifact.file_type !== 'metadata';
}
