# Marketplace submission materials

## Listing copy

**Name:** InkRoom Prompts / InkRoom 提示词助手

**Short description:** Find image prompts with real library examples, or improve your idea into a prompt. No account or API key.

**中文简介：** 输入关键词，检索公开提示词与对应示例图；没有匹配时优化成可用提示词。免登录、免 Key，免费额度由服务端限制。

**Authentication:** none. Never use the paid image MCP endpoint or add Bearer headers to this listing.

**License:** MIT, scoped to this directory. Third-party content retains its own rights.

**Tools:** `search_prompts`, `optimize_prompt`.

**Transports:** STDIO; loopback Streamable HTTP. Node.js 20.3+.

**Skill entry:** `prompts/skills/inkroom-prompts/SKILL.md` in both public repositories. Import the whole folder, including `scripts/` and `LICENSE`.

**Data and limits:** See `PRIVACY.md` and the README. Optimization uses an InkRoom-managed model and a capped platform budget, never an end-user key.

## Publication gate

This is a **preview source release**, not a claim of acceptance by a marketplace. Before advertising a working hosted service:

1. Deploy the new public endpoints through InkRoom's release task, with validated trusted proxy/IP handling, shared guard storage, an explicit configured text model and an approved platform budget.
2. In the test environment verify all search, no-match, optimization, paired image rendering, download/open links, errors, limits and cancellation paths. Check logs and data boundaries. Verify both the MCP archive and standalone Skill archive as fresh installs.
3. Confirm the actual public endpoints and repeat live acceptance with small bounded model use. Do not substitute mock tests for live evidence.
4. If a directory requires a public Remote MCP, first deploy and verify its real HTTPS URL. No placeholder remote URL or fake registry identity is included here.
5. If a directory requires npm, publish an owned npm package first and test its exact version. The GitHub archive is not an npm publication.
6. Preserve separate listings for `inkroom-prompts` and paid `inkroom` image generation. Record submitted version, artifact checksum, actual public listing URL and review result per market.

Reference standards: [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [MCP optional authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [Agent Skills](https://agentskills.io/specification).
