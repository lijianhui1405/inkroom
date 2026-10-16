---
name: inkroom
description: Generate, edit and upscale images with InkRoom. Use for posters, product photos, reference-image edits, model comparisons and batch generation with cost previews and original-image recovery. Requires the user’s own InkRoom account and MCP Token. 支持图片创作、改图、放大与原任务恢复。
metadata:
  version: "1.0.7"
  author: InkRoom
---

# InkRoom 图片创作

当用户要求生图、参考图修改、海报、产品图、模型对比、批量图片、放大或面部修复时使用。实际生成需要用户自己的 InkRoom Key。

本技能适用于支持 Agent Skills 的客户端，使用 Node.js 18+ 内置模块，无需安装第三方依赖。

本技能通过随包脚本 `scripts/inkroom.mjs` 调用 InkRoom，不安装依赖。脚本路径始终相对于本 `SKILL.md` 所在目录解析。

为每次终端调用设置 `INKROOM_STATE_DIR="$HOME/.inkroom"`；云端改用宿主允许的用户私有状态目录，授权与后续调用保持同一目录。

## 快速检查

首次加载或审核沙箱中，先以本技能目录为工作目录运行不会联网、不会生成、不会扣费的自检：

```bash
node scripts/inkroom.mjs self-test
```

只有返回 `ok: true` 才继续。需要检查 InkRoom 公开服务时再运行：

```bash
node scripts/inkroom.mjs doctor
```

授权方式和常见错误见 [账号授权](references/setup.md)；完整命令示例见 [调用示例](references/examples.md)。

使用支持 Agent Skills 的客户端提供的终端能力运行命令；原图保存后使用宿主支持的图片展示方式呈现。Node 不可用时明确说明当前环境不满足条件，不下载替代程序或虚报执行成功。

## 执行图片任务

1. 运行 `tools` 读取实时工具和参数。若返回 `authorization_required`，引导用户到 `https://inkroom.ai/skill-server` 复制自己的 Key，并按 [账号授权](references/setup.md) 授权。不要在回复中重复 Key。
2. 保留用户指定的模型、提示词、参考图、尺寸、格式和数量，不自行改写或换模型。本地参考图片先读取真实格式并转成 `data:image/...;base64,...`，或使用用户提供且可访问的公开 HTTPS 图片 URL；不能把本地路径直接作为服务端参考图参数。不要上传到无关第三方图床。需要选择新模型时使用服务端返回的公开模型名称，不改成上游技术 ID 或追加渠道后缀；用户指定历史名称时保留原值，由服务端解析。未指定模型时不写死默认型号或价格，以预览回执为准。
3. 调用生成、改图或批量工具时先使用 `action: "preview"`，向用户显示模型、数量和预计或最高积分。
4. 服务端允许自动执行时使用预览返回的原 `requestId` 或 `batchId` 继续。返回 `confirmation_required` 时，必须先获得用户对该次金额的确认；不得拆单绕过额度。
5. 两张及以上独立图片使用服务端批量工具一次提交，不在沙箱中循环并发请求。
6. 把工具参数保存为 JSON 对象文件，然后运行：

```bash
node scripts/inkroom.mjs call --tool TOOL_NAME --arguments ARGUMENTS.json --output inkroom-output
```

7. 返回 `nextAction` 时，把本次 `responsePath` 交给 `resume` 自动续取。脚本只接续 `wait_images`，不再生成；最多两个 worker 下载原图，不需要 Agent 写并发脚本。

```bash
node scripts/inkroom.mjs resume --response RESPONSE_FILE --output inkroom-output
```

8. 将已保存原图交给用户，使用宿主图片能力重新打开解码，报告实际结算；不能把成功回执、缩略预览或文件头尺寸当作完整交付。

## 交付与恢复

- 核对请求数量、任务状态、实际结算，以及每张原图的 `resultId/inputIndex/imageIndex`、本地路径、SHA-256、格式、字节数和尺寸。索引从 0 开始；同哈希不同结果保留独立清单记录，不把物理文件数当作结果数。
- 脚本先原子保存请求、完整原始响应和媒体清单，再返回简短摘要。未显式指定时使用 `deliveryMode=links`；用户明确选择的模式保持不变。
- 返回 `nextAction` 时原样使用其中的工具名、回执和参数继续同一任务。
- 输出截断、链接过期、下载失败或客户端退出时，使用原回执调用 `wait_images`，不要重新付费生成。
- 已保存响应可重新下载其中原图或还原内嵌预览：

```bash
node scripts/inkroom.mjs recover --response RESPONSE_FILE --output inkroom-output
```

- 明确报告失败或缺失图片；不得以重复图片冒充多张结果。
- `resume` 默认最多续取 32 轮，可用 `--max-polls 1..256` 调整。中断或达到上限时，使用返回的 `.resume.json` 检查点继续；保留 `cursor`、模式和等待参数，绝不自动接续生成工具。
- 原图 GET 最多尝试 3 次；只在强 ETag 匹配时用 `Range/If-Range` 续传，服务返回完整 200 时重新保存完整文件。原图下载不转发 Key；超时与本地写入失败不直接证明应退款。
- 有服务器图片身份的下载异常交给 `report_image_delivery` 核实，原始请求与响应留档；仅采用服务端结论，不伪造费用、退款或故障证据。
- 新服务端部署后，普通 MCP/Skill 原图对象与原始下载链接同步为固定 72 小时，读回执不续期；旧结果保持原期限，实际以 `retainedUntil/linkExpiresAt/expiresAt` 为准。私有重试输入快照仍为 1 小时，不能承诺过期重做。
- `saved=true` 表示文件已保存且容器、尺寸和哈希检查通过。Node 内置模块不提供完整 JPEG/WebP 像素解码，脚本明确返回 `decoded=false/needsHostDecode=true`；宿主成功解码后才能向用户确认全部交付。内嵌预览为 `mediaKind=preview`，不计入原图保存率。
- 余额检查 `funding.state=preflight_not_reserved` 表示整批余额预检，没有冻结资金；不足时停止新提交。报价上限不是实际扣款，以 `settlement.netChargedPoints` 为准，未知结算不可写成 0。

## 用户可以这样说

- “用 InkRoom 生成一张暖色咖啡海报，竖版，先告诉我模型和预计积分。”
- “用这张产品图做三种布光方案，保留产品外观，确认费用后批量生成。”
- “继续取回刚才任务的全部原图，不要重新生成。”

技能包本身免费。媒体生成按 InkRoom 页面展示的模型价格消耗积分；自检、服务检查、授权验证和工具发现不生成图片、不扣费。
