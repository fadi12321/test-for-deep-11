import * as vscode from 'vscode';

export interface CiStatusMetadata {
  name: string;
  icon: vscode.ThemeIcon;
  priority: number;
  contextAction?: 'retryable' | 'cancellable' | 'executable';
  illustration?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

type IconName =
  | 'pass'
  | 'play'
  | 'debug-pause'
  | 'error'
  | 'circle-slash'
  | 'debug-step-over'
  | 'question'
  | 'warning'
  | 'gear'
  | 'clock';

// colors
const successColor = 'testing.iconPassed';
const warningColor = 'problemsWarningIcon.foreground';
const errorColor = 'testing.iconErrored';
const inProgressColor = 'debugIcon.pauseForeground';
const grayColor = 'testing.iconSkipped';

const icon = (name: IconName, color: string) =>
  new vscode.ThemeIcon(name, new vscode.ThemeColor(color));

const STATUS_METADATA: Record<string, CiStatusMetadata> = {
  manual: {
    name: 'Manual',
    icon: icon('gear', grayColor),
    priority: 0,
    contextAction: 'executable',
    illustration: {
      image: 'src/assets/images/manual_action.svg',
      title: 'This job requires a manual action',
      description: 'This job requires manual intervention to start.',
    },
  },
  success: {
    name: 'Passed',
    icon: icon('pass', successColor),
    priority: 1,
    contextAction: 'retryable',
  },
  created: {
    name: 'Created',
    icon: icon('debug-pause', grayColor),
    priority: 3,
    contextAction: 'cancellable',
    illustration: {
      image: 'src/assets/images/job_not_triggered.svg',
      title: 'This job has not been triggered yet',
      description:
        'This job depends on upstream jobs that need to succeed in order for this job to be triggered',
    },
  },
  waiting_for_resource: {
    name: 'Waiting for resource',
    icon: icon('debug-pause', inProgressColor),
    priority: 4,
    contextAction: 'cancellable',
  },
  preparing: {
    name: 'Preparing',
    icon: icon('debug-pause', inProgressColor),
    priority: 5,
    contextAction: 'cancellable',
    illustration: {
      image: 'src/assets/images/job_not_triggered.svg',
      title: 'This job is preparing to start',
      description: 'This job is performing tasks that must complete before it can start',
    },
  },
  pending: {
    name: 'Pending',
    icon: icon('debug-pause', warningColor),
    priority: 6,
    contextAction: 'cancellable',
    illustration: {
      image: 'src/assets/images/pending_job_empty.svg',
      title: 'This job has not started yet',
      description: 'This job is in pending state and is waiting to be picked by a runner',
    },
  },
  scheduled: {
    name: 'Delayed',
    icon: icon('clock', grayColor),
    priority: 7,
    contextAction: 'cancellable',
    illustration: {
      image: 'src/assets/images/illustrations_scheduled-job_countdown.svg',
      title: 'This is a delayed job',
      description:
        'This job will automatically run after its timer finishes. Often they are used for incremental roll-out deploys to production environments. When unscheduled it converts into a manual action.',
    },
  },
  skipped: {
    name: 'Skipped',
    icon: icon('debug-step-over', grayColor),
    priority: 8,
    illustration: {
      image: 'src/assets/images/skipped-job_empty.svg',
      title: 'This job has been skipped',
    },
  },
  canceled: {
    name: 'Cancelled',
    icon: icon('circle-slash', grayColor),
    priority: 9,
    contextAction: 'retryable',
    illustration: {
      image: 'src/assets/images/canceled-job_empty.svg',
      title: 'This job has been canceled',
    },
  },
  failed: {
    name: 'Failed',
    icon: icon('error', errorColor),
    priority: 10,
    contextAction: 'retryable',
  },
  running: {
    name: 'Running',
    icon: icon('play', inProgressColor),
    priority: 11,
    contextAction: 'cancellable',
  },
};

const UNKNOWN_STATUS = { name: 'Status Unknown', icon: icon('question', grayColor), priority: 0 };
const FAILED_ALLOWED: CiStatusMetadata = {
  name: 'Failed (allowed to fail)',
  icon: icon('warning', warningColor),
  priority: 2,
  contextAction: 'retryable',
};

const ERASED: Partial<CiStatusMetadata> = {
  illustration: {
    image: 'src/assets/images/erased-log_empty.svg',
    title: 'Job has been erased',
    description: '',
  },
};

export const getJobMetadata = (job: RestJob): CiStatusMetadata => {
  let data: CiStatusMetadata;
  if (job.status === 'failed' && job.allow_failure) {
    data = FAILED_ALLOWED;
  } else {
    data = STATUS_METADATA[job.status] || UNKNOWN_STATUS;
  }

  if (job.erased_at) {
    data = { ...data, ...ERASED };
  }
  return data;
};

export const getPipelineMetadata = (pipeline: RestPipeline): CiStatusMetadata =>
  STATUS_METADATA[pipeline.status] || UNKNOWN_STATUS;
