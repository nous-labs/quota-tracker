import { describe, expect, test, mock } from "bun:test"
import { createQuotaState } from "../src/state"
import type { QuotaTrackerConfig, RatelimitSnapshot, Logger } from "../src/types"
import { DEFAULT_CONFIG } from "../src/constants"

function makeConfig(overrides?: Partial<QuotaTrackerConfig>): QuotaTrackerConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

function makeSnapshot(overrides?: Partial<RatelimitSnapshot>): RatelimitSnapshot {
  return {
    providerID: "anthropic",
    modelID: "claude-opus-4-6",
    requests: { remaining: 50, limit: 100 },
    tokens: { remaining: 10000, limit: 50000 },
    timestamp: Date.now(),
    ...overrides,
  }
}

describe("quota-tracker/state", () => {
  describe("#given a fresh state", () => {
    describe("#when no snapshots recorded", () => {
      test("#then status returns unknown", () => {
        const state = createQuotaState(makeConfig())
        const s = state.status("anthropic")
        expect(s.level).toBe("unknown")
        expect(s.lastUpdated).toBe(0)
      })

      test("#then shouldPreempt returns false", () => {
        const state = createQuotaState(makeConfig())
        expect(state.shouldPreempt("anthropic")).toBe(false)
      })

      test("#then all() returns empty map", () => {
        const state = createQuotaState(makeConfig())
        expect(state.all().size).toBe(0)
      })
    })
  })

  describe("#given snapshots with healthy quota", () => {
    test("#then status is ok", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 50, limit: 100 }, tokens: { remaining: 10000, limit: 50000 } }))
      const s = state.status("anthropic")
      expect(s.level).toBe("ok")
      expect(s.requests?.remaining).toBe(50)
      expect(s.tokens?.remaining).toBe(10000)
    })

    test("#then shouldPreempt returns false", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 50 } }))
      expect(state.shouldPreempt("anthropic")).toBe(false)
    })
  })

  describe("#given snapshots at warning threshold", () => {
    test("#then status is warning when requests low", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 10, limit: 100 }, tokens: { remaining: 50000 } }))
      expect(state.status("anthropic").level).toBe("warning")
    })

    test("#then status is warning when tokens low", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 50 }, tokens: { remaining: 5000, limit: 50000 } }))
      expect(state.status("anthropic").level).toBe("warning")
    })

    test("#then shouldPreempt returns false", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 10 } }))
      expect(state.shouldPreempt("anthropic")).toBe(false)
    })
  })

  describe("#given snapshots at critical threshold", () => {
    test("#then status is critical when requests exhausted", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 2, limit: 100 }, tokens: { remaining: 50000 } }))
      expect(state.status("anthropic").level).toBe("critical")
    })

    test("#then status is critical when tokens exhausted", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 50 }, tokens: { remaining: 1000, limit: 50000 } }))
      expect(state.status("anthropic").level).toBe("critical")
    })

    test("#then status is critical when both exhausted", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 0 }, tokens: { remaining: 0 } }))
      expect(state.status("anthropic").level).toBe("critical")
    })

    test("#then shouldPreempt returns true", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: { remaining: 1 } }))
      expect(state.shouldPreempt("anthropic")).toBe(true)
    })

    test("#then shouldPreempt calls logger with preemptive message", () => {
      const logger: Logger = mock(() => {})
      const state = createQuotaState(makeConfig(), logger)
      state.record(makeSnapshot({ requests: { remaining: 0 } }))
      state.shouldPreempt("anthropic")
      expect(logger).toHaveBeenCalled()
      const call = (logger as ReturnType<typeof mock>).mock.calls.find(
        (c: unknown[]) => String(c[0]).includes("preemptive fallback"),
      )
      expect(call).toBeDefined()
    })
  })

  describe("#given undefined remaining values", () => {
    test("#then status is unknown when no remaining data", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ requests: {}, tokens: {} }))
      expect(state.status("anthropic").level).toBe("unknown")
    })
  })

  describe("#given multiple providers", () => {
    test("#then tracks each independently", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ providerID: "anthropic", requests: { remaining: 1 } }))
      state.record(makeSnapshot({ providerID: "openai", requests: { remaining: 50 } }))

      expect(state.status("anthropic").level).toBe("critical")
      expect(state.status("openai").level).toBe("ok")
      expect(state.shouldPreempt("anthropic")).toBe(true)
      expect(state.shouldPreempt("openai")).toBe(false)
    })

    test("#then all() returns all providers", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({ providerID: "anthropic" }))
      state.record(makeSnapshot({ providerID: "openai" }))
      const all = state.all()
      expect(all.size).toBe(2)
      expect(all.has("anthropic")).toBe(true)
      expect(all.has("openai")).toBe(true)
    })
  })

  describe("#given sliding window expiry", () => {
    test("#then expired snapshots are pruned", () => {
      const windowMs = 1000
      const state = createQuotaState(makeConfig({ sliding_window_ms: windowMs }))

      state.record(makeSnapshot({
        providerID: "anthropic",
        requests: { remaining: 1 },
        timestamp: Date.now() - windowMs - 100,
      }))

      expect(state.status("anthropic").level).toBe("unknown")
      expect(state.shouldPreempt("anthropic")).toBe(false)
    })

    test("#then recent snapshots survive pruning", () => {
      const windowMs = 60_000
      const state = createQuotaState(makeConfig({ sliding_window_ms: windowMs }))

      state.record(makeSnapshot({
        providerID: "anthropic",
        requests: { remaining: 1 },
        timestamp: Date.now(),
      }))

      expect(state.status("anthropic").level).toBe("critical")
    })
  })

  describe("#given latest snapshot overrides earlier ones", () => {
    test("#then status reflects most recent snapshot", () => {
      const state = createQuotaState(makeConfig())

      state.record(makeSnapshot({ requests: { remaining: 1 }, timestamp: Date.now() - 1000 }))
      expect(state.status("anthropic").level).toBe("critical")

      state.record(makeSnapshot({ requests: { remaining: 50 }, timestamp: Date.now() }))
      expect(state.status("anthropic").level).toBe("ok")
    })
  })

  describe("#given unified utilization snapshots (Anthropic subscription)", () => {
    test("#then status is ok when utilization is low", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.3, status: "allowed", window: "5h" },
      }))
      expect(state.status("anthropic").level).toBe("ok")
    })

    test("#then status is warning when utilization >= 0.75", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.78, status: "allowed", window: "5h" },
      }))
      expect(state.status("anthropic").level).toBe("warning")
    })

    test("#then status is critical when utilization >= 0.90", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.95, status: "allowed", window: "7d" },
      }))
      expect(state.status("anthropic").level).toBe("critical")
    })

    test("#then status is critical when utilization exceeds 1.0", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 1.02, status: "rate_limited", window: "5h" },
      }))
      expect(state.status("anthropic").level).toBe("critical")
    })

    test("#then shouldPreempt returns true at critical utilization", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.92, status: "allowed", window: "5h" },
      }))
      expect(state.shouldPreempt("anthropic")).toBe(true)
    })

    test("#then shouldPreempt returns false at warning utilization", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.80, status: "allowed", window: "5h" },
      }))
      expect(state.shouldPreempt("anthropic")).toBe(false)
    })

    test("#then unified status is included in QuotaStatus", () => {
      const state = createQuotaState(makeConfig())
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.5, status: "allowed", window: "5h", reset: 1764554400 },
      }))
      const s = state.status("anthropic")
      expect(s.unified?.utilization).toBe(0.5)
      expect(s.unified?.window).toBe("5h")
      expect(s.unified?.reset).toBe(1764554400)
    })

    test("#then custom utilization thresholds are respected", () => {
      const state = createQuotaState(makeConfig({
        warn_threshold_utilization: 0.50,
        critical_threshold_utilization: 0.80,
      }))
      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.55 },
      }))
      expect(state.status("anthropic").level).toBe("warning")

      state.record(makeSnapshot({
        requests: {},
        tokens: {},
        unified: { utilization: 0.85 },
      }))
      expect(state.status("anthropic").level).toBe("critical")
    })
  })
})
