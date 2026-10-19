export interface LocalUserProfile {
  id: number;
  name: string;
  last_login: string;
}

export interface UserActivityResult {
  activity_count: number;
  source: 'external_api' | 'cache' | 'fallback_timeout' | 'fallback_error';
  latency_ms: number;
}

export interface MergedUserReportItem {
  id: number;
  name: string;
  last_login: string;
  activity_count: number;
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  data_source: string;
  latency_ms: number;
}

export interface AggregatedReportResponse {
  summary: {
    total_users: number;
    total_activities: number;
    total_execution_time_ms: number;
    strategy: string;
    concurrency_optimization: string;
  };
  users: MergedUserReportItem[];
}
