# 内容工作台

基于 MediaCrawler 采集结果的独立内容库、素材下载、语音转写、文案改写和封面生成工作台。项目不会修改 MediaCrawler 的源码或采集逻辑。

## 两种使用方式

### GitHub Pages 网页版

部署完成后的地址：

`https://sheckham1986.github.io/content-workbench/`

Pages 只负责网页界面。采集、下载、FFmpeg、豆包转写、DeepSeek 改写和 CogView 生图由独立后端完成。API Key 只保存在后端环境中，不会写入 GitHub 仓库或浏览器代码。

仓库变量 `BACKEND_BASE_URL` 用于指定公开 HTTPS 后端，例如：

`https://content-api.example.com`

配置位置：Repository Settings → Secrets and variables → Actions → Variables。

另一台电脑打开 Pages 地址时不需要输入 API Key；前提是后端持续在线，并已通过 Cloudflare Access 或等效登录保护。

### 本地完整版本

```powershell
Copy-Item .env.example .env.local
npm ci
npm run bridge
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

浏览器打开 `http://127.0.0.1:4173/`。本地密钥写入 `.env.local`，该文件已被 Git 忽略。

## GitHub Pages 设置

1. 打开 Repository Settings → Pages。
2. Build and deployment 的 Source 选择 **GitHub Actions**。
3. 推送到 `main` 后，`Deploy GitHub Pages` 工作流会自动构建和发布。

## 安全说明

- 不要提交 `.env.local` 或 `config.env`。
- 不要将 API Key 放进任何 `VITE_*` 变量；这类变量会进入公开网页代码。
- 如果后端映射到公网，请使用 Cloudflare Access、反向代理登录或其他身份验证保护。
- `downloaded-assets/`、本地运行数据和浏览器配置不会提交到仓库。
