# 飞牛 NAS 部署说明（外网展示）

## 1. 准备目录

把整个项目上传到 NAS，例如：

`/vol1/docker/drawguess`

## 2. 配置环境变量

在项目目录新建 `.env`（不是 `.env.local`），内容示例：

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
ZHIPU_API_KEY=your_zhipu_key
ZHIPU_MODEL=glm-4.6v-flash
```

建议至少配置 `ZHIPU_API_KEY`，国内网络更稳定。

## 3. 启动容器

在项目目录执行：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker logs -f drawguess
```

内网访问：

`http://NAS内网IP:3000`

## 4. 配置反向代理（推荐）

不要直接把 3000 暴露到公网。请在飞牛自带反代/Nginx Proxy Manager 中添加：

- 源站：`http://NAS内网IP:3000`
- 外网域名：例如 `draw.yourdomain.com`
- 开启 HTTPS（Let's Encrypt）

## 5. 路由器端口转发

把公网 `80` 和 `443` 转发到 NAS 的反代服务机器（不是应用容器端口）。

## 6. 常用运维命令

更新后重启：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

## 7. 安全建议

- 不要把 `.env`、`.env.local` 上传到公开仓库。
- API Key 视为密码，泄露后立即在平台后台重置。
- 如果只演示给朋友，建议反代层增加访问密码或 IP 白名单。
