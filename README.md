# @nous-labs/quota-tracker

API quota and rate limit tracker. Header parsing, sliding window tracking, and preemptive exhaustion detection for AI coding assistants.

Used by oh-my-opencode to track API provider rate limits and trigger preemptive model fallback before quota exhaustion.

## Installation

Clone the repository:

```bash
git clone https://github.com/nous-labs/quota-tracker.git
```

Add as a local dependency in your project's `package.json`. Note: the local directory may be named `nous-quota-tracker` but the cloned repo will be `quota-tracker`.

```json
{
  "dependencies": {
    "@nous-labs/quota-tracker": "file:../quota-tracker"
  }
}
```

## API

### `createQuotaState(config?, logger?)`

Creates a stateful tracker instance.

Returns an object with:

- `record(snapshot)` — record a rate limit snapshot
- `status(providerID)` — get current status for a provider
- `all()` — get status map for all tracked providers
- `shouldPreempt(providerID)` — check if fallback should be triggered (returns true at critical level)

### `parseAnthropicUnified(headers)`

Parses Anthropic-style rate limit headers into a `RatelimitSnapshot`.

### `DEFAULT_CONFIG`

Default configuration constants.

## Configuration

`QuotaTrackerConfig` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable tracking |
| `warn_threshold_requests` | `number` | `0.2` | Request ratio threshold for warning |
| `warn_threshold_tokens` | `number` | `0.15` | Token ratio threshold for warning |
| `critical_threshold_requests` | `number` | `0.05` | Request ratio threshold for critical |
| `critical_threshold_tokens` | `number` | `0.05` | Token ratio threshold for critical |
| `warn_threshold_utilization` | `number` | `0.7` | Utilization ratio for warning |
| `critical_threshold_utilization` | `number` | `0.9` | Utilization ratio for critical |
| `sliding_window_ms` | `number` | - | Sliding window duration in milliseconds |
| `notify_on_warning` | `boolean` | `true` | Emit warnings on threshold breach |

## Types

### `QuotaLevel`

```typescript
type QuotaLevel = "ok" | "warning" | "critical" | "unknown";
```

### `RatelimitSnapshot`

```typescript
interface RatelimitSnapshot {
  providerID: string;
  modelID: string;
  requests: {
    remaining?: number;
    limit?: number;
    reset?: string;
  };
  tokens: {
    remaining?: number;
    limit?: number;
    reset?: string;
  };
  unified?: UnifiedUtilization;
  raw?: Record<string, string>;
  timestamp: number;
}

### `UnifiedUtilization`

```typescript
interface UnifiedUtilization {
  utilization?: number;
  status?: string;
  reset?: number;
  window?: string;
}

### `ProviderQuota`

```typescript
interface ProviderQuota {
  snapshots: RatelimitSnapshot[];
  lastUpdated: number;
}

### `QuotaStatus`

```typescript
interface QuotaStatus {
  level: QuotaLevel;
  providerID: string;
  requests?: { remaining?: number; limit?: number };
  tokens?: { remaining?: number; limit?: number };
  unified?: UnifiedUtilization;
  lastUpdated: number;
}

### `Logger`

```typescript
type Logger = (message: string, data?: Record<string, unknown>) => void;

## Usage

```typescript
import { createQuotaState, parseAnthropicUnified, DEFAULT_CONFIG } from "@nous-labs/quota-tracker";

// Create a tracker instance
const tracker = createQuotaState(DEFAULT_CONFIG, console);

// Parse rate limit headers from an API response
const headers = {
  "anthropic-ratelimit-requests-remaining": "100",
  "anthropic-ratelimit-requests-limit": "1000",
  "anthropic-ratelimit-tokens-remaining": "50000",
  "anthropic-ratelimit-tokens-limit": "100000",
  "anthropic-ratelimit-reset": "1234567890"
};

const snapshot = parseAnthropicUnified(headers);

// Ingest the snapshot
tracker.record(snapshot);

// Check current status
const status = tracker.status("anthropic");
console.log(status.level); // "ok" | "warning" | "critical" | "unknown"

// Check if we should preemptively fallback
if (tracker.shouldPreempt("anthropic")) {
  // Switch to fallback provider before quota exhaustion
}

// Get all provider statuses
const allStatuses = tracker.all();
```

## Scripts

```bash
bun test          # Run tests
bun run build     # Build the package
bun run typecheck # Type check
```

## License

MIT

Repository: https://github.com/nous-labs/quota-tracker
