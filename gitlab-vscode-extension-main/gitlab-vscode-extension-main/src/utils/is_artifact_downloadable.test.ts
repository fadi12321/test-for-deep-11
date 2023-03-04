import { isArtifactDownloadable } from './is_artifact_downloadable';
import { artifact } from '../test_utils/entities';

const traceArtifact = { ...artifact, file_type: 'trace' };
const junitArtifact = { ...artifact, file_type: 'junit' };

describe('isArtifactDownloadable', () => {
  it('return false for trace artifacts', () => {
    expect(isArtifactDownloadable(traceArtifact)).toBe(false);
  });

  it('returns true for junit artifacts', () => {
    expect(isArtifactDownloadable(junitArtifact)).toBe(true);
  });
});
