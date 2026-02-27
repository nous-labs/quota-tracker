export interface UnifiedUtilization {
  utilization?: number
  status?: string
  reset?: number
  window?: string
}

export interface RatelimitSnapshot {
  providerID: string
  modelID: string
  requests: {
    remaining?: number
    limit?: number
    reset?: string
  }
  tokens: {
    remaining?: number
    limit?: number
    reset?: string
  }
  unified?: UnifiedUtilization
  raw?: Record<string, string>
  timestamp: number
}

export interface ProviderQuota {
  snapshots: RatelimitSnapshot[]
  lastUpdated: number
}

export interface QuotaTrackerConfig {
  enabled: boolean
  warn_threshold_requests: number
  warn_threshold_tokens: number
  critical_threshold_requests: number
  critical_threshold_tokens: number
  warn_threshold_utilization: number
  critical_threshold_utilization: number
  sliding_window_ms: number
  notify_on_warning: boolean
}

export type QuotaLevel = "ok" | "warning" | "critical" | "unknown"

export interface QuotaStatus {
  level: QuotaLevel
  providerID: string
  requests?: {
    remaining?: number
    limit?: number
  }
  tokens?: {
    remaining?: number
    limit?: number
  }
  unified?: UnifiedUtilization
  lastUpdated: number
}

export type Logger = (message: string, data?: Record<string, unknown>) => void
