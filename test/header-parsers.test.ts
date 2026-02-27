import { describe, expect, test } from "bun:test"
import { parseAnthropicUnified } from "../src/header-parsers"

describe("header-parsers/parseAnthropicUnified", () => {
  describe("#given no raw headers", () => {
    test("#then returns undefined", () => {
      expect(parseAnthropicUnified(undefined)).toBeUndefined()
    })
  })

  describe("#given empty raw headers", () => {
    test("#then returns undefined", () => {
      expect(parseAnthropicUnified({})).toBeUndefined()
    })
  })

  describe("#given five_hour claim with utilization", () => {
    test("#then returns 5h window with parsed utilization", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-5h-utilization": "0.42",
        "anthropic-ratelimit-unified-status": "allowed",
        "anthropic-ratelimit-unified-5h-reset": "1764554400",
      }
      const result = parseAnthropicUnified(raw)
      expect(result).toBeDefined()
      expect(result!.window).toBe("5h")
      expect(result!.utilization).toBe(0.42)
      expect(result!.status).toBe("allowed")
      expect(result!.reset).toBe(1764554400)
    })
  })

  describe("#given seven_day claim with utilization", () => {
    test("#then returns 7d window with parsed utilization", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "seven_day",
        "anthropic-ratelimit-unified-7d-utilization": "0.85",
        "anthropic-ratelimit-unified-status": "rate_limited",
        "anthropic-ratelimit-unified-7d-reset": "1764600000",
      }
      const result = parseAnthropicUnified(raw)
      expect(result).toBeDefined()
      expect(result!.window).toBe("7d")
      expect(result!.utilization).toBe(0.85)
      expect(result!.status).toBe("rate_limited")
      expect(result!.reset).toBe(1764600000)
    })
  })

  describe("#given unknown claim type", () => {
    test("#then returns undefined (no matching window)", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "unknown_window",
        "anthropic-ratelimit-unified-status": "allowed",
      }
      expect(parseAnthropicUnified(raw)).toBeUndefined()
    })
  })

  describe("#given claim without utilization value", () => {
    test("#then returns undefined", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-status": "allowed",
      }
      expect(parseAnthropicUnified(raw)).toBeUndefined()
    })
  })

  describe("#given non-numeric utilization", () => {
    test("#then returns undefined", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-5h-utilization": "not-a-number",
      }
      expect(parseAnthropicUnified(raw)).toBeUndefined()
    })
  })

  describe("#given utilization without reset", () => {
    test("#then returns result with undefined reset", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-5h-utilization": "0.60",
        "anthropic-ratelimit-unified-status": "allowed",
      }
      const result = parseAnthropicUnified(raw)
      expect(result).toBeDefined()
      expect(result!.utilization).toBe(0.60)
      expect(result!.reset).toBeUndefined()
    })
  })

  describe("#given non-numeric reset value", () => {
    test("#then returns result with undefined reset", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-5h-utilization": "0.50",
        "anthropic-ratelimit-unified-5h-reset": "invalid",
      }
      const result = parseAnthropicUnified(raw)
      expect(result).toBeDefined()
      expect(result!.utilization).toBe(0.50)
      expect(result!.reset).toBeUndefined()
    })
  })

  describe("#given zero utilization", () => {
    test("#then returns result with 0 utilization", () => {
      const raw = {
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-5h-utilization": "0",
        "anthropic-ratelimit-unified-status": "allowed",
      }
      const result = parseAnthropicUnified(raw)
      expect(result).toBeDefined()
      expect(result!.utilization).toBe(0)
    })
  })
})
