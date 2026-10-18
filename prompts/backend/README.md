# InkRoom host integration (preview)

This folder publishes the new anonymous HTTP boundary and text-only optimizer integration as MIT source. These Go files are adapters for InkRoom's existing `cloud-canvas` application, **not an independently runnable Go service**. The Node MCP server and Skill in the parent directory run independently; they call the hosted HTTP API.

Published integration source:

- `public_assistant.go.txt`: public-only library search, explicit response fields, static example URLs, strict bounded optimization input and shared DB quota reservations.
- `public_prompts.go.txt`: server-selected configured text model, conservative priced reservation, one bounded provider call and cancellation.
- Corresponding regression tests.

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

- `INKROOM_PROMPTS_TEXT_MODEL`: an explicitly configured text model. If omitted, use the existing guest prompt optimizer model policy; absence disables optimization.
- `INKROOM_PROMPTS_DAILY_BUDGET_MILLIS`: approved maximum daily platform reservation in existing credit-milli units (1 credit = 1000). Missing, invalid or zero disables optimization. This is a conservative reserved allowance, not measured provider spend and not a user wallet deduction.
- Shared `auth_guard_states` must already be migrated and available. Guard failure returns 503, never an in-memory allowance.
- Trusted proxy configuration must produce validated client IPs on both app and prompt processes. Anonymous shared cloud egress may share one IP quota.

Before each provider call, the shared transaction reserves rate counters and the worst-case configured text price under the global daily cap. Failed or unknown calls keep that reservation. No retry, wallet deduction, image request or refund is made by this feature.

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

Deployment and paid/live model acceptance remain explicit release tasks. These files do not grant a license to InkRoom's surrounding application or publish accounts, database content or provider credentials.

The host's application `ListQuery` and repository `PromptQuery` also add a server-only `Keywords []string`. Forward it with `Keywords: q.Keywords`. The SQL base filter applies each keyword as an AND term before pagination, with literal LIKE escaping and title/prompt/tag matching. Preserve the old single-`Keyword` behavior for website and paid MCP compatibility. The exact small adapter diff is supplied in `host-wiring.patch`; it is not a patch for a standalone public repository.

Non-Gemini channels must have confirmed Responses capability. Gemini channels use the existing protocol adapter, require a completed STOP result, and reject image/tool output. Missing model/pricing/capability returns unavailable before any provider call.

Source files use `.go.txt` so adding this folder to an existing Go client repository does not make its `go test ./...` compile host-only adapters. Copy them to their documented host paths to build the integration.
