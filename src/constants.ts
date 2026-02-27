import type { QuotaTrackerConfig } from "./types"

export const DEFAULT_CONFIG: QuotaTrackerConfig = {
  enabled: true,
  warn_threshold_requests: 10,
  warn_threshold_tokens: 5000,
  critical_threshold_requests: 2,
  critical_threshold_tokens: 1000,
  warn_threshold_utilization: 0.75,
  critical_threshold_utilization: 0.90,
  sliding_window_ms: 5 * 60 * 1000,
  notify_on_warning: true,
}
