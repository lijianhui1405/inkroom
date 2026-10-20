# MCP configuration examples

- `mcp.json` uses the GitHub `1.0.3` archive and the default `https://prompts.inkroom.ai` service. It requires no Key, Token or environment variables.
- `mcp-test.json` is for the `1.0.3` release or a later release. Replace its absolute CLI path with your installation path. The optional `INKROOM_PROMPTS_ORIGIN` selects a test service; it is not an MCP listener URL. Remove the variable for normal usage. Do not use this option to evade a limit or claim a hosted deployment is already available.
- The same optional variable applies to `node src/cli.mjs --http 8788` and `node skills/inkroom-prompts/scripts/prompts.mjs search "keywords"`. The HTTP listener remains on loopback. Only HTTPS origins are accepted, except HTTP loopback for local tests; credentials, paths, queries and fragments are rejected.

配置无需 Key 或 Token。`mcp.json` 保留本版 GitHub 正式包；`mcp-test.json` 用于本次新版正式包，需替换 CLI 绝对路径。测试地址不影响本地监听地址，不设置环境变量即使用默认服务。新版本是否已发布、测试服务是否可用，均需单独核实。
