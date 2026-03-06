# AI 你画我猜（Next.js + 多模型 API）

一个在线你画我猜小游戏：玩家在画布上作画，后端通过 HTTP 调用大模型进行识别。
目前支持：Google Gemini、智谱 GLM（视觉模型）。

## 技术栈

- Next.js（App Router）
- React + TypeScript
- Gemini REST API（`fetch`）
- 智谱 BigModel API（`fetch`）

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 创建环境变量文件

```bash
copy .env.example .env.local
```

3. 在 `.env.local` 填入你要使用的平台 Key（至少填一个）

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

ZHIPU_API_KEY=your_zhipu_api_key_here
ZHIPU_MODEL=glm-4.6v-flash
```

4. 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 使用说明

- 页面里可切换模型（Gemini / 智谱）
- 也可输入自定义模型名
- 点击“开始猜测”会把当前画布发送到后端进行识别

## 接口说明

- 前端请求：`POST /api/guess`
- 请求体示例：

```json
{
  "imageBase64": "...",
  "provider": "zhipu",
  "model": "glm-4.6v-flash"
}
```

- `provider` 可选：`gemini`、`zhipu`
- 未传 `model` 时，后端按 `.env.local` 中对应默认模型处理
