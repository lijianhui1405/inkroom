# Changes

## 1.0.3

- Establish one stable version for the free MCP, Skill, MCPB and Cursor plugin; retain earlier preview history.
- Add a separate free Cursor plugin and an additive marketplace entry without changing the image plugin.
- Pin all current installation examples to the same release and add an automated release-consistency check.
- Runtime change is limited to the MCP reported version; tool behavior, authentication, limits, billing and dependencies are unchanged.
- Registry publication, Cursor review and hosted deployment remain separately evidenced states.

## 0.1.0-preview.4

- Add clickable official tool and documentation links to public Skill and package descriptions.
- Remove InkRoom test-domain examples from current public materials; optional origin validation and runtime behavior are unchanged.

## 0.1.0-preview.3

- Move the anonymous API default to `https://prompts.inkroom.ai`.
- Preserve preview.2 public search, protocol validation, shared request counts and internal token usage without user charges or paid-service fallback.
- Hosted isolation and new archives remain pending live release verification.

## 0.1.0-preview.2

- Support the optional, strictly validated `INKROOM_PROMPTS_ORIGIN` test-service address in the STDIO CLI, local HTTP CLI and standalone Skill; the default remains `https://inkroom.ai`, without credentials.
- Add transport-level tests for the default address, a standby address and rejected invalid origins, plus optional test-environment installation examples.
- Replace monetary reservations with shared request-count limits for internal text optimization, defaulting to `gpt-6.1-sol`; retain failed/unknown attempt counts and record only actual reported internal usage without retail pricing or user charges.
- Keep this version pending publication and live acceptance; free user access does not imply a free model supplier.

## 0.1.0-preview.1

- Add the keyless prompt-search MCP server using the official TypeScript SDK, with STDIO and local Streamable HTTP.
- Add the standard standalone `inkroom-prompts` Skill and shared dependency-free HTTP client.
- Publish the anonymous public-catalog boundary, literal AND keyword queries and bounded text-only optimizer integration.
- Add initial shared rate controls, static-domain image pairing, attribution, privacy notes and marketplace publication gates. The initial monetary-reservation prototype is superseded by request-count controls in `preview.2`.
- Hosted endpoint rollout, real model acceptance and marketplace listings remain pending.
