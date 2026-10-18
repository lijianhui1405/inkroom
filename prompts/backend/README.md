# InkRoom host integration (preview)

This folder publishes the new anonymous HTTP boundary and text-only optimizer integration as MIT source. These Go files are adapters for InkRoom's existing `cloud-canvas` application, **not an independently runnable Go service**. The Node MCP server and Skill in the parent directory run independently; they call the hosted HTTP API.

Published integration source:

- `public_assistant.go.txt`: public-only library search, explicit response fields, static example URLs, strict bounded optimization input and shared DB request-count limits.
- `public_prompts.go.txt`: server-selected internal text model, one bounded provider call, cancellation and actual reported internal-usage recording, without retail pricing or user charges.
- `public_catalog.go.txt`: the SELECT-only application catalog boundary; copy to `internal/application/prompt/public_catalog.go`. It never initializes or re-enables sources.
- Corresponding regression tests, including `public_readonly_test.go.txt` for the application catalog.

Required host wiring (additive, no schema or data rewrite):

```go
prompthandler.New(deps.Prompts).WithPublicAssistant(
    authguard.NewSQLStore(deps.BackofficeDB), ai.PreparePublicPrompt,
)
```

Register in the prompt handler's public route group:

```go
api.GET("/prompts/assistant/search", h.PublicPromptSearch)
api.POST("/prompts/assistant/optimize", h.PublicPromptOptimize)
```

The handler needs a `publicAssistant *publicAssistant` field. Wire both the monolithic app constructor and the separate prompt-process constructor. Existing prompt forwarding already matches the `/api/prompts/` family. Do not route these requests to the authenticated image MCP or public model proxy.

## Operator configuration

End users configure **nothing**. The host reuses existing server-side model/channel configuration:

- `INKROOM_PROMPTS_TEXT_MODEL`: an optional internal text-model selection. If omitted, use `gpt-6.1-sol`. The selected model must exist on an enabled internal channel and support the required text protocol; missing retail pricing does not disable this internal call.
- Shared `auth_guard_states` must already be migrated and available. Guard failure returns 503, never an in-memory allowance.
- Trusted proxy configuration must produce validated client IPs on both app and prompt processes. Anonymous shared cloud egress may share one IP quota.

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

Deployment and live supplier acceptance remain explicit release tasks. `0.1.0-preview.2` is pending publication and live acceptance. These files do not grant a license to InkRoom's surrounding application or publish accounts, database content or provider credentials.

The host's application `ListQuery` and repository `PromptQuery` also add a server-only `Keywords []string`. Forward it with `Keywords: q.Keywords`. The SQL base filter applies each keyword as an AND term before pagination, with literal LIKE escaping and title/prompt/tag matching. Preserve the old single-`Keyword` behavior for website and paid MCP compatibility. The exact small adapter diff is supplied in `host-wiring.patch`; it is not a patch for a standalone public repository.

Non-Gemini channels must have confirmed Responses capability. Gemini channels use the existing protocol adapter, require a completed STOP result, and reject image/tool output. Missing internal model, enabled channel or required capability returns unavailable before any provider call; retail price configuration is not required.

Source files use `.go.txt` so adding this folder to an existing Go client repository does not make its `go test ./...` compile host-only adapters. Copy them to their documented host paths to build the integration.
