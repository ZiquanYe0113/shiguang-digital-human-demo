# 时光数字人 · API 接口草案

本文中的 `/api/v1/` 路由是拟议的自有后端契约，**尚未实现**，不是供应商 API 地址。当前 Demo 由 `runtime.js` 在浏览器内模拟请求；例如 `/api/jimeng/generate` 只是保留的旧路由名，不表示已接入即梦。静态展示不需要密钥。

## 接口一览

| 功能 | 拟议接口 | 请求关键字段 | 响应关键字段 | 拟接服务 |
| --- | --- | --- | --- | --- |
| 素材上传 | POST /api/v1/assets | multipart `file`、`kind` | `assetId` | 自有存储 |
| 对话 | POST /api/v1/chat | `sessionId?`、`message` | `sessionId`、`reply` | 火山方舟／豆包语言模型 |
| 语音转文字 | POST /api/v1/speech/transcriptions | `audioAssetId` | `text` | 豆包 ASR |
| 文字转语音 | POST /api/v1/speech/synthesize | `text`、`voiceId?` | `audioAssetId`、`previewUrl` | 豆包 TTS |
| 音色复刻 | POST /api/v1/voices | `name`、`audioAssetId`、`consentId` | `jobId`；成功后返回 `voiceId` | 豆包声音复刻 |
| 图片生成 | POST /api/v1/images | `prompt`、`referenceImageIds?` | `imageAssetId`、`previewUrl` | Nano Banana 系列 |
| 视频生成 | POST /api/v1/videos | `imageAssetIds`、`actionPrompt`、`sceneAssetId?`、`audioAssetId?`、`durationSeconds?` | `jobId`，HTTP 202 | Seedance 系列 |
| 任务查询 | GET /api/v1/jobs/{jobId} | 路径参数 `jobId` | `status`、`result?`、`error?` | 自有后端归一化 |

`?` 表示可选项。视频支持的输入组合、时长与音频能力需要按最终模型版本验证；供应商型号和参数由后端配置，不写死在前端。

## 视频任务示例

提交：

```json
{"imageAssetIds":["asset_demo_01"],"actionPrompt":"轻轻挥手","durationSeconds":5}
```

返回 HTTP 202：

```json
{"jobId":"job_demo_01","status":"queued"}
```

前端以退避间隔查询任务，展示 `queued`、`running`、`succeeded`、`failed`。终态停止查询；离开页面停止本地轮询。成功时 `result` 包含 `videoAssetId` 和短时有效的 `previewUrl`；失败时显示可读提示，不直接暴露供应商错误和密钥。

## 接入顺序与数据边界

1. 先跑通文字对话，再接 ASR / TTS；然后验证图片生成，最后接复刻和视频异步任务。
2. 密钥只放服务端。真实模式启用鉴权、限流和素材归属校验；不要把密钥或个人素材放进 GitHub。
3. 使用真实人像、声音前确认授权与使用范围；提供素材和结果删除机制。公开面试 Demo 继续使用示例素材和模拟接口。
