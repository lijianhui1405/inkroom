# InkRoom 提示词助手

> **迁移提示 / Migration notice:** 下列 1.0.3 文档与安装示例保留作历史记录。新安装请使用 [官方维护文档](https://github.com/InkRoom-AI/inkroom-client/tree/main/prompts) 与 [官方 Skill](https://github.com/InkRoom-AI/inkroom-client/tree/main/skills/inkroom-prompts)。本变更不升级或重新发行旧包。
>
> These legacy 1.0.3 instructions are historical. Use the official maintained documentation and Skill linked above for new installations. No old package is upgraded or reissued by this notice.

[官方提示词工具](https://inkroom.ai/tools/prompts) · [使用与MCP文档](https://inkroom.ai/tools/prompts/docs)

**输入几个关键词，找到提示词和真实示例图。免登录、免 Key。**

[English](README.md) · [Skill](skills/inkroom-prompts/SKILL.md) · [隐私说明](PRIVACY.md)

> **正式提示词工具：** 请使用上方官方工具和文档。MCP 包在本机通过 STDIO 或 loopback HTTP 运行，当前不公布公共 Remote MCP 地址。

对助手说：**“帮我找几个暖色咖啡馆海报提示词，带示例图。”**

1. 检索已公开、审核通过的词库，返回完整提示词、对应示例图与来源。
2. 确实没有匹配时，调用 InkRoom 已配置的文本模型优化你的想法，明确标注 **“AI 优化，无示例图”**。
3. 用户无需账号、Key、Token 或付费生图授权；免费额度由服务端统一限制。

代码采用 MIT 协议，便于分发、复用与市场审核。第三方提示词、图片及本目录外原有客户端保持各自许可。

## MCP 安装

Node.js **20.3+**。使用标准 ASCII 标识 `inkroom-prompts`，中文仅作展示名称。

从品牌仓库安装源码：

```sh
git clone https://github.com/InkRoom-AI/inkroom-client.git
cd inkroom-client/prompts
npm ci --ignore-scripts
node src/cli.mjs --help
```

新安装仅使用官方品牌仓库 `https://github.com/InkRoom-AI/inkroom-client.git` 下的 `prompts` 目录。无需填写任何密钥或准备 `.env`。

支持 `mcpServers` 配置的客户端，可使用正式包：

```json
{
  "mcpServers": {
    "inkroom-prompts": {
      "command": "npx",
      "args": ["-y", "--package", "https://github.com/InkRoom-AI/inkroom-client/releases/download/prompts-v1.0.3/inkroom-prompts-1.0.3.tgz", "inkroom-prompts"]
    }
  }
}
```

包通过 GitHub Release 分发，未声明已发布 npm。源码模式可将命令改为 `node`，参数填写 `prompts/src/cli.mjs` 的绝对路径。其他客户端按各自配置格式填写相同命令和参数，不添加鉴权字段。

需要本地 HTTP 时运行 `node src/cli.mjs --http 8788`，连接 `http://127.0.0.1:8788/mcp`，无需 Header。预览版没有宣布已上线的官方公网 Remote MCP 地址。

## Skill 安装

复制整个 [`skills/inkroom-prompts`](skills/inkroom-prompts) 文件夹到客户端的 Skill 目录，或在支持 ZIP 导入的客户端中导入发布包。符合标准 [Agent Skills 格式](https://agentskills.io/specification)，与原付费生图 `inkroom` Skill 独立。

Skill 优先调用 MCP；未安装 MCP 时使用自带 Node.js 脚本，不额外安装依赖。

## 结果与限制

| 能力 | 输入 | 输出 |
| --- | --- | --- |
| 查找提示词 | 最多 3 组关键词，1–200 字 | 默认 3 条、最多 5 条完整提示词，原示例图和来源 |
| 优化提示词 | 1–500 字的想法 | 一条 AI 优化提示词，无示例图 |

示例图走 `static.inkroom.ai`。MCP 返回标准媒体资源链接，客户端支持时可显示；返回链接不代表已经展示或保存。

服务端限制：每 IP 每分钟共 30 次，平台每分钟共 600 次；优化每 IP 每分钟 3 次、每天 10 次，平台每分钟最多 30 次、每天最多 500 次。这些是跨实例共享的调用次数限制，不是金额预算。按北京时间 00:00 重置每日窗口；IPv6 按 /64 共用额度，云端客户端共用出口 IP 时可能共用额度，不宣称这是准确的设备限额。

达到额度返回 429 和 `Retry-After`。网络/检索错误不会冒充“没有匹配”自动调用 AI；优化不自动重试，不静默换模型，不生成或扣费生成图片。

AI 优化属于平台内部调用，使用管理员选择的内部文本模型（默认 `gpt-6.1-sol`）和已有启用渠道，不要求配置对用户的模型售价。失败或结果未知的尝试仍计入调用次数，跨实例和重启不会重置。免费指不扣用户积分或余额，不代表供应商免费；已有内部用量记录只记供应商实际返回的 Token 用量，未返回时标记未知，不估算、不当作零成本。用户始终无需 Key。详见[英文安装与验证说明](README.md)、[市场材料](MARKETPLACE.md)和[后端交接](backend/README.md)。

两个仓库的顶层 `skills/inkroom-prompts` 也提供完全相同的 Skill，便于市场扫描与安装。

## 服务边界

免费 MCP 和 Skill 统一调用 **https://prompts.inkroom.ai** 的检索与文字优化接口，后端为独立的 `inkroom-prompt-assistant` 容器。故障时不会回退到收费生图接口。网页工具仍位于 `inkroom.ai`，示例图仍使用 `static.inkroom.ai`。这是目标发布域名，是否已可用仍以真实请求和发布验收为准。


## 统一正式版本与 Cursor 插件

免费提示词 MCP、Skill、MCPB 与 Cursor 插件统一采用 **1.0.3**。根市场配置新增独立 inkroom-prompts，源目录为 prompts/；原付费图片 inkroom 插件不变。需要 Node.js20.3+，免账号、Key、Token，不生成图片。源码分发、平台审核、上架和实际客户端安装分别核验，不能相互替代。

特殊平台仅适配元数据或包结构，保持本产品基线版本，差异记录在版本清单中；已待审旧批次保留历史，不通过改名重复提交。发布前运行 `npm run verify:release` 检查版本、安装地址、Skill镜像与Cursor配置。
