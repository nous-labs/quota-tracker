import type { UnifiedUtilization } from "./types"

/**
 * Parse Anthropic unified ratelimit headers.
 * Handles both 7-day and 5-hour windows.
 */
export function parseAnthropicUnified(raw: Record<string, string> | undefined): UnifiedUtilization | undefined {
  if (!raw) return undefined

  const claim = raw["anthropic-ratelimit-unified-representative-claim"]
  const window = claim === "seven_day" ? "7d" : claim === "five_hour" ? "5h" : undefined
  const utilizationKey = window
    ? `anthropic-ratelimit-unified-${window}-utilization`
    : undefined

  const utilizationStr = utilizationKey ? raw[utilizationKey] : undefined
  const utilization = utilizationStr ? parseFloat(utilizationStr) : undefined
  if (utilization === undefined || isNaN(utilization)) return undefined

  const status = raw["anthropic-ratelimit-unified-status"]
  const resetKey = window ? `anthropic-ratelimit-unified-${window}-reset` : undefined
  const resetStr = resetKey ? raw[resetKey] : undefined
  const reset = resetStr ? parseInt(resetStr, 10) : undefined

  return {
    utilization,
    status,
    reset: reset && !isNaN(reset) ? reset : undefined,
    window,
  }
}
