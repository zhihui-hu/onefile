# OneFile - 轻量对象存储图床和上传管理后台

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-282C34?logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn/ui-black?style=flat&logo=vercel&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=tanstack&logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/TanStack_Table-v8-FF4154?logo=tanstack&logoColor=white" alt="TanStack Table" />
  <img src="https://img.shields.io/badge/SQLite-lightweight-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

OneFile 是一个很轻的对象存储上传后台。它适合拿来做自建图床、文件投递入口，或者统一管理多家对象存储。

你可以把 S3、R2、B2、OCI、阿里云 OSS、腾讯云 COS 接到一个页面里，通过网页上传和管理文件；也可以生成 API key，把上传能力快速接进图床项目、Markdown 编辑器、脚本、CI 或第三方系统。

## 项目亮点

- **SQLite，非常轻量**：默认只需要一个 SQLite 数据库文件，不依赖 MySQL、PostgreSQL、Redis，单机 Docker 部署很省心。
- **支持导入导出，方便迁移**：管理员可以导出 SQL 备份，再在新环境导入；迁移服务器、重建容器、搬家都更简单。
- **快速集成图床项目**：网页登录后生成 API key，外部图床、脚本或编辑器用 `Authorization: Bearer ...` 就能上传图片。
- **上传后的图片可管理**：图床上传不是黑盒，后台仍然可以浏览、搜索、复制链接、删除文件，公开上传链接也支持二维码分享。
- **图片压缩**：API 上传和公开上传可开启 WebP 压缩，适合博客、论坛、Markdown 图片流。
- **多 bucket 负载均衡**：上传接口可以不传 `bucket_id`，OneFile 会自动选择当前用户可用 bucket，分散上传压力。
- **多云对象存储聚合**：支持 AWS S3、Cloudflare R2、Backblaze B2、Oracle Object Storage、阿里云 OSS、腾讯云 COS。
- **服务端统一写入对象存储**：浏览器和外部工具只和 OneFile 通信，认证、压缩、bucket 选择和对象存储写入都由服务端收口。

## 适合场景

- 自建图床后台
- Markdown / 博客 / 论坛图片上传
- 给外部工具提供统一上传 API
- 多个对象存储账号、多个 bucket 的统一管理
- 轻量文件投递页面或公开上传入口
- CI 产物、备份文件、素材文件上传

## 支持的存储

| 存储服务              | 接入方式               |
| --------------------- | ---------------------- |
| AWS S3                | 标准 S3 API            |
| Cloudflare R2         | S3 兼容 API            |
| Backblaze B2          | S3 兼容 API            |
| Oracle Object Storage | OCI Object Storage API |
| 阿里云 OSS            | Aliyun OSS SDK         |
| 腾讯云 COS            | Tencent COS SDK        |

## 架构图

```mermaid
flowchart LR
  user["登录用户 / 管理后台"]
  tools["图床项目 / Markdown 编辑器 / 脚本 / CI"]
  public["公开上传链接 / 二维码"]

  app["OneFile<br/>Next.js 应用"]
  auth["GitHub OAuth<br/>Session / API key"]
  db["SQLite<br/>用户、账号、bucket、API key、上传状态"]
  backup["SQL 导入导出<br/>迁移和备份"]

  scheduler["上传调度<br/>压缩策略 / bucket 负载均衡"]
  single["Direct Upload API<br/>小文件 / 图片压缩"]
  multipart["Multipart Upload API<br/>服务端分片上传"]

  storage["对象存储<br/>S3 / R2 / B2 / OCI / OSS / COS"]

  user --> app
  tools -->|"Bearer API key"| app
  public -->|"UUID 上传入口"| app

  app --> auth
  app <--> db
  db <--> backup
  app --> scheduler

  scheduler --> single
  scheduler --> multipart
  single --> storage
  multipart --> storage

  app -->|"文件浏览 / 删除 / 复制链接"| storage
```

## 快速开始

最快的方式是直接跑官方 GHCR 镜像。默认服务端口是 `27507`，数据保存在 Docker volume `onefile-data`。

1. 创建 GitHub OAuth App，回调地址填写：

   ```text
   https://[域名/ip:port]/callback/auth
   ```

2. docker：

   ```bash
   docker run -d --name onefile --restart unless-stopped -p 27507:27507 -e GITHUB_CLIENT_ID=your_github_client_id -e GITHUB_CLIENT_SECRET=your_github_client_secret -v onefile-data:/app/data ghcr.io/zhihui-hu/onefile:latest
   ```

3. 打开应用：

   ```text
   http://[域名/ip:port]
   ```

4. 登录后按这个顺序使用：
   - 添加对象存储账号
   - 同步 bucket
   - 配置 bucket 公开访问地址
   - 创建 API key
   - 用 API key 接入你的图床、脚本或上传工具

## 图床集成

OneFile 的 API key 适合直接接入图床项目。创建 API key 后，外部系统只需要把 key 放到请求头：

```text
Authorization: Bearer ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

常用方式有两种：

- **API 上传**：适合图床项目、Markdown 编辑器、脚本和 CI。
- **公开上传链接**：适合生成一个可分享的网页入口，别人不需要登录，也看不到 raw API key。

上传后的图片仍然可以在 OneFile 后台管理，可以复制链接、查看目录、删除对象；如果开启图片压缩，上传图片会转为 WebP；如果 API key 没有固定 bucket，服务端会按负载均衡策略选择 bucket。

## 技术栈

- **前端**：Next.js 16、React 19、TypeScript、Tailwind CSS 4、shadcn/ui、Lucide React
- **数据和状态**：TanStack Query v5、TanStack Table v8
- **后端和存储**：Next.js Route Handlers、Drizzle ORM、better-sqlite3、对象存储 SDK
- **部署**：Docker / Docker Compose，默认镜像 `ghcr.io/zhihui-hu/onefile:latest`

<details>
<summary>展开：部署和迁移说明</summary>

### Docker Compose 部署

`docker-compose.yml` 默认使用：

```text
ghcr.io/zhihui-hu/onefile:latest
```

先创建 `.env`：

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# 可选：不填时会自动生成并保存到 /app/data/.onefile-secret
# APP_SECRET=replace_with_a_long_random_secret

# 可选：反向代理不能正确传递 Host / X-Forwarded-* 时再填写
# APP_ORIGIN=https://onefile.example.com
```

启动：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f onefile
```

升级：

```bash
git pull
docker compose pull
docker compose up -d
```

### 数据位置

Docker 部署默认使用 SQLite：

```text
/app/data/onefile.sqlite
```

并通过 Docker volume 持久化：

```text
onefile-data
```

不要删除 `onefile-data`，否则用户、存储账号、API key、token 和上传状态都会丢失。

### 密钥

OneFile 只需要一个应用密钥，用于 session 签名和存储凭证加密。优先级：

1. `.env` 里的 `APP_SECRET`
2. 旧配置兼容项：`SESSION_SECRET` 和 `STORAGE_CREDENTIAL_ENCRYPTION_KEY`
3. 自动生成的 `/app/data/.onefile-secret`

单机部署可以不填 `APP_SECRET`，应用会自动生成并保存到 volume。迁移、多容器或重建 volume 时，建议显式设置同一个 `APP_SECRET`。

### 导入导出

管理员可以在「导入导出」里导出 SQL 备份。导出的文件名会携带密钥信息，导入时应用会同步 `.onefile-secret`，这样迁移后仍然可以解密原有对象存储凭证。

请保留导出的原始文件名，不要手动重命名。

### 反向代理

生产环境建议通过 Nginx、Caddy、Traefik 或云厂商负载均衡代理到：

```text
127.0.0.1:27507
```

如果代理不能正确传递 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`，再配置：

```bash
APP_ORIGIN=https://onefile.example.com
```

### 本地构建镜像

如果不想使用 GHCR 镜像，也可以本地构建：

```bash
docker build -t onefile .

docker run -d --name onefile \
  -p 27507:27507 \
  --env-file .env \
  -v onefile-data:/app/data \
  onefile
```

</details>

<details>
<summary>展开：API 上传最小示例</summary>

先准备环境变量：

```bash
export ONEFILE_BASE_URL="https://onefile.example.com"
export ONEFILE_API_KEY="ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export FILE="./image.png"
```

小文件或图片可以直接提交给 OneFile 服务端：

```bash
curl -fsS -X POST "$ONEFILE_BASE_URL/api/uploads/direct" \
  -H "Authorization: Bearer $ONEFILE_API_KEY" \
  -F "file=@$FILE"
```

如果需要指定对象 key，可以额外传：

```bash
curl -fsS -X POST "$ONEFILE_BASE_URL/api/uploads/direct" \
  -H "Authorization: Bearer $ONEFILE_API_KEY" \
  -F "file=@$FILE" \
  -F "object_key=images/image.png" \
  -F "original_filename=image.png"
```

响应会返回 `bucket_id`、`bucket_name`、`object_key`、`mime_type`、`compressed` 等信息。使用 API key 调用时，默认使用 key 上配置的 bucket 和压缩策略；大文件请使用 `/api/uploads` 创建 multipart 会话，再逐片 POST 到 `/api/uploads/:id/parts/upload`。更完整的示例请访问应用内 `/api-docs`。

</details>

<details>
<summary>展开：本地开发</summary>

```bash
pnpm install
pnpm dev
```

开发地址：

```text
http://localhost:27507
```

本地 GitHub OAuth App 回调地址：

```text
http://localhost:27507/callback/auth
```

常用命令：

```bash
pnpm build
pnpm start
pnpm lint
```

</details>

## 许可证

本项目使用 [AGPL-3.0-only](./LICENSE) 许可证。

## 致谢

- [Next.js](https://nextjs.org/) - React 全栈框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件体系
- [Lucide](https://lucide.dev/) - 图标库
- [TanStack Query](https://tanstack.com/query) - 前端数据请求与缓存
- [TanStack Table](https://tanstack.com/table) - 表格能力
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite driver
- [AWS SDK for JavaScript](https://aws.amazon.com/sdk-for-javascript/) - S3 兼容存储接入
- [ali-oss](https://github.com/ali-sdk/ali-oss) - 阿里云 OSS SDK
- [cos-nodejs-sdk-v5](https://github.com/tencentyun/cos-nodejs-sdk-v5) - 腾讯云 COS SDK

## 安全提示

OneFile 会保存对象存储访问凭证和 API key 信息。生产部署请妥善保护 `.env`、`/app/data/.onefile-secret` 和 SQLite 数据库，并优先通过 HTTPS 和反向代理对外提供服务。
