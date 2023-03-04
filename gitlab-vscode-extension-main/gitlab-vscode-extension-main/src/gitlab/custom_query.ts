import { CustomQueryType } from './custom_query_type';

export interface CustomQuery {
  name: string;
  type: CustomQueryType;
  maxResults: number;
  scope: string;
  state: string;
  labels?: string[];
  milestone?: string;
  author?: string;
  assignee?: string;
  search?: string;
  createdBefore?: string;
  createdAfter?: string;
  updatedBefore?: string;
  updatedAfter?: string;
  wip: string;
  confidential: boolean;
  excludeLabels?: string[];
  excludeMilestone?: string;
  excludeAuthor?: string;
  excludeAssignee?: string;
  excludeSearch?: string;
  excludeSearchIn: string;
  orderBy: string;
  sort: string;
  reportTypes?: string[];
  severityLevels?: string[];
  confidenceLevels?: string[];
  searchIn: string;
  noItemText: string;
  reviewer?: string;
}
