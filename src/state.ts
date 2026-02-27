import type { RatelimitSnapshot, QuotaTrackerConfig, QuotaLevel, QuotaStatus, Logger } from "./types"

export function createQuotaState(config: QuotaTrackerConfig, logger?: Logger) {
  const providers = new Map<string, { snapshots: RatelimitSnapshot[]; lastUpdated: number }>()

  function record(snapshot: RatelimitSnapshot) {
    const quota = providers.get(snapshot.providerID) ?? { snapshots: [], lastUpdated: 0 }
    quota.snapshots.push(snapshot)
    quota.lastUpdated = snapshot.timestamp
    providers.set(snapshot.providerID, quota)
    prune(snapshot.providerID)
  }

  function prune(providerID: string) {
    const quota = providers.get(providerID)
    if (!quota) return
    const cutoff = Date.now() - config.sliding_window_ms
    quota.snapshots = quota.snapshots.filter((s) => s.timestamp > cutoff)
    if (quota.snapshots.length === 0) providers.delete(providerID)
  }

  function classifyCount(remaining: number | undefined, warnThreshold: number, criticalThreshold: number): QuotaLevel {
    if (remaining === undefined) return "unknown"
    if (remaining <= criticalThreshold) return "critical"
    if (remaining <= warnThreshold) return "warning"
    return "ok"
  }

  function classifyUtilization(utilization: number | undefined): QuotaLevel {
    if (utilization === undefined) return "unknown"
    if (utilization >= config.critical_threshold_utilization) return "critical"
    if (utilization >= config.warn_threshold_utilization) return "warning"
    return "ok"
  }

  function status(providerID: string): QuotaStatus {
    prune(providerID)
    const quota = providers.get(providerID)
    if (!quota || quota.snapshots.length === 0) {
      return { level: "unknown", providerID, lastUpdated: 0 }
    }

    const latest = quota.snapshots[quota.snapshots.length - 1]!
    const reqLevel = classifyCount(latest.requests.remaining, config.warn_threshold_requests, config.critical_threshold_requests)
    const tokLevel = classifyCount(latest.tokens.remaining, config.warn_threshold_tokens, config.critical_threshold_tokens)
    const uniLevel = classifyUtilization(latest.unified?.utilization)

    const levels = [reqLevel, tokLevel, uniLevel]
    const level: QuotaLevel =
      levels.includes("critical") ? "critical"
      : levels.includes("warning") ? "warning"
      : levels.includes("ok") ? "ok"
      : "unknown"

    return {
      level,
      providerID,
      requests: latest.requests,
      tokens: latest.tokens,
      unified: latest.unified,
      lastUpdated: quota.lastUpdated,
    }
  }

  function all(): Map<string, QuotaStatus> {
    const result = new Map<string, QuotaStatus>()
    for (const providerID of providers.keys()) {
      result.set(providerID, status(providerID))
    }
    return result
  }

  function shouldPreempt(providerID: string): boolean {
    const s = status(providerID)
    if (s.level === "critical") {
      logger?.(`Provider ${providerID} at critical quota — preemptive fallback recommended`, {
        requests: s.requests?.remaining,
        tokens: s.tokens?.remaining,
        utilization: s.unified?.utilization,
      })
      return true
    }
    return false
  }

  return { record, status, all, shouldPreempt }
}
