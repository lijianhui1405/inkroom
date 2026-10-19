# InkRoom

## Keyless prompt assistant (preview)

[InkRoom Prompts MCP + Skill](prompts/) searches public prompts with real example images and offers capped text optimization. No login or Key. MIT applies only to the new `prompts/` and `skills/inkroom-prompts/` directories. Use the [official prompt tools](https://inkroom.ai/tools/prompts) and [documentation](https://inkroom.ai/tools/prompts/docs); existing paid image services keep their authorization.


Official client integration materials for [InkRoom](https://inkroom.ai): image generation, reference-image editing, batch model comparisons, cost previews and original-image delivery.

## Agent Skill

[InkRoom Skill](skills/inkroom/SKILL.md) uses Node.js 18+ built-in modules and requires each user’s own InkRoom account and MCP Token. Start with the offline self-test. Set `INKROOM_STATE_DIR="$HOME/.inkroom"` for every invocation; never embed a real token in skill files or shared examples.

```bash
INKROOM_STATE_DIR="$HOME/.inkroom" node skills/inkroom/scripts/inkroom.mjs self-test
```

Skill distribution version: **1.0.7**. Bundled Node client version: **1.0.6**, reused from the previously published client without runtime changes.

## Remote MCP

- Endpoint: `https://mcp.inkroom.ai` (Streamable HTTP)
- Setup: [InkRoom MCP](https://inkroom.ai/mcp-server)
- Header: `Authorization: Bearer <your own MCP Token>`
- [Official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.InkRoomAI%2Finkroom/versions/0.3.23)

This repository distributes client integrations. It does not contain the hosted Remote MCP server implementation. Existing standalone-client release downloads remain available under Releases.

## Costs and delivery

The Skill bundle is free to download. Image generation consumes credits at the model prices shown in InkRoom. Preview costs and follow the user’s configured authorization before generating; do not bypass limits by splitting batches. Keep original receipts and recover completed images after interrupted delivery instead of generating again. User credentials are never included in this repository or its bundles.

Copyright InkRoom. The MIT exception above applies only to the new prompt assistant directories; the existing image client retains its prior licensing.
