# InkRoom Prompts

**Image prompt inspiration, without an account or API key.**

[简体中文](README.zh-CN.md) · [Skill](skills/inkroom-prompts/SKILL.md) · [Privacy](PRIVACY.md)

> **Preview source release — hosted rollout pending.** The MCP transports and Skill are implemented and locally tested. The new public search and optimization endpoints still require InkRoom's release process and live acceptance. Installation does not mean the hosted feature is already available. Do not submit this preview as a working hosted marketplace service.

Ask your assistant: **“Find warm café poster prompts with example images.”**

- Search public, approved prompt-library records; get the complete prompt, its original example image and source.
- If a successful search has no match, ask InkRoom's configured text model to turn the idea into a usable prompt. **Optimized prompts have no example image.**
- No account, login, Key, Token, subscription or paid-image authorization. Free usage is subject to server limits.
- MIT-licensed MCP server and Agent Skill. The license does not cover third-party prompt/image content or other InkRoom code outside this directory.

## Install the MCP

Requires Node.js **20.3+**. The ASCII server ID is `inkroom-prompts`.

Build from either public source repository:

```sh
git clone https://github.com/InkRoom-AI/inkroom-client.git
cd inkroom-client/prompts
npm ci --ignore-scripts
node src/cli.mjs --help
```

Alternatively clone `https://github.com/lijianhui1405/inkroom.git` and open its `prompts` directory. No `.env` or credentials are needed.

After downloading the GitHub preview package, use this portable STDIO configuration in clients that support `mcpServers`:

```json
{
  "mcpServers": {
    "inkroom-prompts": {
      "command": "npx",
      "args": ["-y", "--package", "https://github.com/lijianhui1405/inkroom/releases/download/prompts-v0.1.0-preview.1/inkroom-prompts-0.1.0-preview.1.tgz", "inkroom-prompts"]
    }
  }
}
```

The preview archive is distributed on GitHub, **not the npm registry**. For source installations, use `node` with the absolute path to `prompts/src/cli.mjs` instead. Clients that use a different configuration format must map the same command and argument array to their MCP settings; do not add authentication fields.

For a local Streamable HTTP connection:

```sh
node src/cli.mjs --http 8788
```

Connect to `http://127.0.0.1:8788/mcp` without headers. The listener binds only to loopback. No official public Remote MCP URL is announced in this preview. Operators deploying behind TLS must validate the public Host/Origin, set trusted proxies correctly, enforce ingress limits and complete live acceptance first.

## Install the Skill

Copy the entire [`skills/inkroom-prompts`](skills/inkroom-prompts) directory into the client’s Skill directory or import its ZIP when supported. It follows the [Agent Skills format](https://agentskills.io/specification). It works independently of the paid `inkroom` Skill and has no runtime dependency on the MCP SDK.

With the Skill selected, ask:

- “帮我找几个暖色咖啡馆海报提示词，带示例图。”
- “Improve this product-photo idea into a prompt; keep the label text unchanged.”

The Skill uses the MCP tools when available, otherwise its bundled Node.js script.

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `search_prompts` | `query` (1–200 characters, up to 3 keyword groups), optional `limit` (1–5, default 3) | Complete public prompts with their paired example URLs and source links |
| `optimize_prompt` | `query` (1–500 characters) | One AI-optimized prompt, model, and `exampleImageUrl: null` |

The MCP uses the official TypeScript SDK, standard tool annotations, structured JSON and image `resource_link` entries. The host decides whether links render inline. It does not download images or claim that a link was displayed or saved.

Search first, then optimize on a **successful empty result**, or optimize directly on an explicit rewrite request. Network/catalog errors are not empty results. There are no hidden paid-generation calls, automatic model switches or optimization retries.

## Free-use policy

The implemented server policy is shared across replicas and restarts:

- 30 total operations per IP per minute; global ingress 600 per minute.
- Optimization: 3 per IP per minute, 10 per IP per day, 30 globally per minute and 500 per day, plus an operator-set daily platform budget.
- Daily windows reset at **00:00 Beijing time (UTC+8)**. IPv6 addresses share a /64 quota. Shared VPN/cloud egress may share an IP allowance; this is not a guaranteed per-device entitlement.
- HTTP 429 includes `Retry-After`. Wait rather than changing identity or splitting work.
- The operator must explicitly enable the text-model budget. A failed or unknown provider outcome retains its conservative budget reservation; users are never charged. No uncapped free proxy is exposed.

## Develop and verify

```sh
npm ci --ignore-scripts
npm test
npm pack --dry-run
```

Tests cover real SDK initialization and tool calls, STDIO, Streamable HTTP, errors, cancellation, no credential forwarding, image/source pairing and response limits. Backend integration and quota tests are described in [`backend/README.md`](backend/README.md). Mock-model tests do not prove hosted model availability.

The same Skill is also mirrored at each repository's top-level `skills/inkroom-prompts` for directories that discover Skills there. Both copies must remain identical.
