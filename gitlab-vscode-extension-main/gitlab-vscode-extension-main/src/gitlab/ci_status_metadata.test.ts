import dayjs from 'dayjs';
import { job, pipeline } from '../test_utils/entities';
import { getJobMetadata, getPipelineMetadata } from './ci_status_metadata';

describe('CI Status Metadata', () => {
  describe('getJobMetadata', () => {
    it('gets metadata', () => {
      const result = getJobMetadata(job);
      expect(result.icon.id).toBe('pass');
      expect(result.name).toBe('Passed');
    });

    it('creates failed (allowed to fail) metadata', () => {
      const result = getJobMetadata({ ...job, allow_failure: true, status: 'failed' });
      expect(result.icon.id).toBe('warning');
      expect(result.name).toBe('Failed (allowed to fail)');
    });

    it('returns unknown metadata for unknown status', () => {
      const result = getJobMetadata({
        ...job,
        status: 'unknown',
      } as unknown as RestJob);

      expect(result.icon.id).toBe('question');
      expect(result.name).toBe('Status Unknown');
    });

    it('returns "Delayed" for a scheduled job', () => {
      const result = getJobMetadata({
        ...job,
        status: 'scheduled',
      } as unknown as RestJob);

      expect(result.icon.id).toBe('clock');
      expect(result.name).toBe('Delayed');
    });

    it('returns "Manual" for a manual job', () => {
      const result = getJobMetadata({
        ...job,
        status: 'manual',
      } as unknown as RestJob);

      expect(result.icon.id).toBe('gear');
      expect(result.name).toBe('Manual');
    });

    it('returns erased job metadata', () => {
      const result = getJobMetadata({ ...job, erased_at: dayjs().toString() });
      expect(result.name).toBe('Passed');
      expect(result.illustration?.title).toContain('erased');
    });
  });

  describe('getPipelineMetadata', () => {
    it('gets metadata', () => {
      const result = getPipelineMetadata(pipeline);
      expect(result.icon.id).toBe('pass');
      expect(result.name).toBe('Passed');
    });

    it('returns unknown metadata for unknown status', () => {
      const result = getPipelineMetadata({
        ...pipeline,
        status: 'unknown',
      } as unknown as RestPipeline);

      expect(result.icon.id).toBe('question');
      expect(result.name).toBe('Status Unknown');
    });
  });
});
