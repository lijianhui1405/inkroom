# InkRoom host integration source

This folder publishes the new anonymous HTTP boundary and text-only optimizer integration as MIT source. These Go files are adapters for InkRoom's existing `cloud-canvas` application, **not an independently runnable Go service**. The Node MCP server and Skill in the parent directory run independently; they call the hosted HTTP API.

Published integration source:

- `public_assistant.go.txt`: public-only library search, explicit response fields, static example URLs, strict bounded optimization input and shared DB request-count limits.
- `public_prompts.go.txt`: server-selected internal text model, one bounded provider call, cancellation and actual reported internal-usage recording, without retail pricing or user charges.
- `public_catalog.go.txt`: the SELECT-only application catalog boundary; copy to `internal/application/prompt/public_catalog.go`. It never initializes or re-enables sources.
- Corresponding regression tests, including `public_readonly_test.go.txt` for the application catalog.

## Isolated host integration

The free hosted API uses **https://prompts.inkroom.ai**, served by the standalone `cmd/prompt-assistant` binary in `inkroom-prompt-assistant`. These are the target endpoints; DNS/TLS/container availability must be confirmed by the release owner before claiming live availability.

Only these routes are registered in that dedicated router:

- `GET /api/prompts/assistant/search`
- `POST /api/prompts/assistant/optimize`
- `GET /api/health` and `GET /api/ready`

Do not register the free handlers in the paid app or prompt-management process, and exclude `/api/prompts/assistant` from the general prompt proxy. The public clients never fall back to the paid host. Website tool pages remain on `inkroom.ai`; their anonymous cross-origin requests go to the free host. Examples still use the existing static CDN.

The private host repository contains `Dockerfile.prompt-assistant`, independent `docker-compose.prompt-assistant.yml`, the Caddy allowlist snippet and `deploy/README.prompt-assistant.md`. The binary only connects to the existing schema; it never starts migrations, image jobs, sync workers, payment, account or private-library routes. Maximum request DB connections are 2, HTTP operations 8, and the container has a separate CPU/memory limit. Existing SQL guard state is reused across restarts; the database and configured provider remain shared dependencies with explicitly bounded load. Preserve the frozen release's internal-use recorder through `WithUsageRecorder`; do not replace its read-only search or internal-use policy with earlier preview behavior.

`host-wiring.patch` now contains only the library query and handler-field adapters. It deliberately does not wire free routes into the paid app. The dedicated entrypoint/router and operator configuration belong to the private host integration; this public module does not expose the surrounding application.

## Operator configuration

End users configure **nothing**. The host reuses existing server-side model/channel configuration:

- `INKROOM_PROMPTS_TEXT_MODEL`: an optional internal text-model selection. If omitted, use `gpt-6.1-sol`. The selected model must exist on an enabled internal channel and support the required text protocol; missing retail pricing does not disable this internal call.
- Shared `auth_guard_states` must already be migrated and available. Guard failure returns 503, never an in-memory allowance.
- Trusted proxy configuration must produce validated client IPs on the dedicated free process. Anonymous shared cloud egress may share one IP quota.

Before each provider call, a shared transaction increments the request-count allowance: all operations are limited to 30 per IP per minute and 600 globally per minute; optimization is additionally limited to 3 per IP per minute, 10 per IP per day, 30 globally per minute and 500 globally per day. Failed or unknown attempts remain counted, including across replicas and restarts. Daily windows use Beijing midnight. There is no monetary-budget prerequisite, price estimate or user-wallet reservation.

Provider attempts use the existing internal-use ledger (`Source: internal`), recording actual reported input, output and cached tokens with `usage_reported`. Missing supplier usage stays unknown; a zero placeholder is not evidence of zero cost. Do not create user charges, refund entries or invented usage. Internal calls can still incur supplier costs. No automatic retry or image generation is performed.

## Contract

- `GET /api/prompts/assistant/search?query=...&limit=3`
  returns `{ "kind":"library", "query":"...", "items":[{"id":"...","title":"...","prompt":"...","exampleImageUrl":"https://static.inkroom.ai/api/prompt-assets/...","sourceUrl":"...","tags":[]}], "hasMore":false, "optimizationAvailable":true }`.
- `POST /api/prompts/assistant/optimize` with only `{ "query":"..." }`
  returns `{ "kind":"optimized", "prompt":"...", "model":"...", "exampleImageUrl":null, "requestId":"..." }`.
- Errors use non-2xx HTTP and `{ "error": { "code":"...", "message":"..." } }`. 429 includes `Retry-After`. No upstream raw body, credential or internal database error is returned.

Host verification commands:

```sh
go test ./internal/interfaces/handler/prompts ./internal/interfaces/handler/ai -run PublicPrompt -count=1
go test -race ./internal/interfaces/handler/prompts -run PublicPrompt -count=1
```

Deployment and live supplier acceptance remain explicit release tasks. Client release 1.0.3 does not deploy or modify the hosted service; use the release owner’s exact scoped acceptance records for hosted availability. These files do not grant a license to InkRoom's surrounding application or publish accounts, database content or provider credentials.

The host's application `ListQuery` and repository `PromptQuery` also add a server-only `Keywords []string`. Forward it with `Keywords: q.Keywords`. The SQL base filter applies each keyword as an AND term before pagination, with literal LIKE escaping and title/prompt/tag matching. Preserve the old single-`Keyword` behavior for website and paid MCP compatibility. The exact small adapter diff is supplied in `host-wiring.patch`; it is not a patch for a standalone public repository.

Non-Gemini channels must have confirmed Responses capability. Gemini channels use the existing protocol adapter, require a completed STOP result, and reject image/tool output. Missing internal model, enabled channel or required capability returns unavailable before any provider call; retail price configuration is not required.

Source files use `.go.txt` so adding this folder to an existing Go client repository does not make its `go test ./...` compile host-only adapters. Copy them to their documented host paths to build the integration.
