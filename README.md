# OneFile - 聚合对象存储上传平台

<p align="left">
  <img src="https://img.shields.io/badge/React-19-282C34?logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn/ui-black?style=flat&logo=vercel&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=tanstack&logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/pnpm-orange?logo=pnpm&logoColor=white" alt="pnpm" />
</p>

OneFile 是一个面向个人和小团队的对象存储上传工作台。它把 S3、R2、B2、OCI、阿里云 OSS、腾讯云 COS 等对象存储统一到一个页面里：网页登录后管理账号和 bucket，浏览文件，拖拽上传；外部脚本、CI、图床客户端则可以通过 API key 或公开上传链接把文件写入对象存储。

它不是网盘。OneFile 只负责认证、调度、签发上传地址和管理配置，文件字节默认直传对象存储，后端不接管大流量。

## 主要功能

- **多云对象存储统一管理**：支持 AWS S3、Cloudflare R2、Backblaze B2、Oracle Object Storage、阿里云 OSS、腾讯云 COS。
- **浏览器直传对象存储**：后端签发 presigned URL，文件从浏览器直接上传到目标 bucket。
- **大文件分片上传**：支持单文件、多文件、文件夹上传；大文件可走 multipart 流程，支持取消和完成上传会话。
- **文件管理器**：按 bucket 浏览目录和文件，支持搜索、刷新、进入文件夹、返回上级和删除对象。
- **API key 调用**：为脚本、CI、第三方系统创建 Bearer key，调用上传、浏览、删除等接口。
- **公开上传链接**：每个 API key 可生成公开上传 URL，适合临时收集文件或做无登录上传入口；前端支持复制、打开和二维码分享。
- **图床和图片压缩**：公开上传和 API 上传可启用 WebP 压缩，适合 Markdown、论坛、博客素材流。
- **自动选择 bucket**：上传接口可以省略 `bucket_id`，服务端按负载均衡策略选择当前用户可用 bucket。
- **凭证加密保存**：对象存储 secret、OAuth token 等敏感信息加密入库。
- **SQL 备份迁移**：管理员可导出 SQL 备份；备份文件名携带密钥标识，迁移后可继续解密原有存储凭证。
- **Docker 生产部署**：内置 `Dockerfile` 和 `docker-compose.yml`，默认服务端口为 `27507`。

## 支持的存储

| 存储服务              | 说明                                 |
| --------------------- | ------------------------------------ |
| AWS S3                | 标准 S3 bucket，也可用于 S3 兼容服务 |
| Cloudflare R2         | 通过 S3 API 接入                     |
| Backblaze B2          | 通过 S3 兼容接口接入                 |
| Oracle Object Storage | 支持 OCI API 签名和 namespace        |
| 阿里云 OSS            | 支持按 bucket region 调整 endpoint   |
| 腾讯云 COS            | 支持 bucket-appid 命名规则           |

## 快速开始

推荐使用 Docker Compose 部署。默认容器内端口为 `27507`，数据保存在 Docker volume `onefile-data`。

1. 创建 GitHub OAuth App，回调地址填写：

   ```text
   https://你的域名/callback/auth
   ```

2. 在项目根目录创建 `.env`：

   ```bash
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret

   # 可选：不填时会自动生成并保存到 /app/data/.onefile-secret
   # APP_SECRET=replace_with_a_long_random_secret

   # 可选：反向代理不能正确传递 Host / X-Forwarded-* 时再填写
   # APP_ORIGIN=https://onefile.example.com
   ```

3. 启动服务：

   ```bash
   docker compose up -d
   ```

4. 访问应用：

   ```text
   http://服务器 IP:27507
   ```

5. 登录后按这个顺序使用：
   - 在「账号管理」添加对象存储账号
   - 同步 bucket
   - 选择 bucket 后上传或管理文件
   - 在「API key」里创建 key，用于脚本、公开上传链接或图床工具

<details>
<summary>部署教程：Docker Compose、GitHub OAuth 和反向代理</summary>

### 准备条件

部署前建议准备：

- 一台可以运行 Docker 的服务器
- 一个已经解析到服务器的域名，例如 `onefile.example.com`
- Docker Engine 24 或更高
- Docker Compose v2
- GitHub 账号，用于创建 OAuth App
- 至少一个对象存储账号和访问密钥

生产环境建议通过 HTTPS 域名访问：

```text
https://onefile.example.com
```

GitHub OAuth App 的 callback URL 固定为访问地址加 `/callback/auth`：

```text
https://onefile.example.com/callback/auth
```

如果直接用端口访问：

```text
http://服务器 IP:27507/callback/auth
```

### 创建 GitHub OAuth App

1. 打开 GitHub Developer settings：

   ```text
   https://github.com/settings/developers
   ```

2. 进入 `OAuth Apps`，点击 `New OAuth App`。

3. 生产环境示例：

   ```text
   Application name: OneFile
   Homepage URL: https://onefile.example.com
   Application description: OneFile object storage upload platform
   Authorization callback URL: https://onefile.example.com/callback/auth
   ```

4. 本地开发示例：

   ```text
   Application name: OneFile Local
   Homepage URL: http://localhost:27507
   Application description: OneFile local development
   Authorization callback URL: http://localhost:27507/callback/auth
   ```

5. 注册应用后复制 `Client ID`，再点击 `Generate a new client secret` 生成 `Client Secret`。

6. 写入 `.env`：

   ```bash
   GITHUB_CLIENT_ID=复制到的_Client_ID
   GITHUB_CLIENT_SECRET=复制到的_Client_Secret
   ```

GitHub OAuth App 只能配置一个 callback URL。建议生产环境和本地开发分别创建 OAuth App。

### Docker Compose 部署

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

### 反向代理建议

生产环境推荐使用 Nginx、Caddy、Traefik 或云厂商负载均衡转发到：

```text
127.0.0.1:27507
```

反向代理需要保留这些请求头：

```text
Host
X-Forwarded-Proto
X-Forwarded-Host
X-Forwarded-For
```

OneFile 默认根据请求地址推导外部访问地址。如果代理无法正确传递这些请求头，再显式设置：

```bash
APP_ORIGIN=https://onefile.example.com
```

默认 `docker-compose.yml` 只把服务绑定到服务器本机：

```text
127.0.0.1:27507:27507
```

如需直接暴露端口，可改成：

```text
27507:27507
```

</details>

<details>
<summary>高级配置：数据持久化、密钥、端口和备份迁移</summary>

### 数据持久化

Docker 部署默认使用 SQLite，数据库位于容器内：

```text
/app/data/onefile.sqlite
```

并通过 Docker volume 持久化：

```text
onefile-data
```

不传 `DATABASE_URL` 时，应用会自动使用 `/app/data/onefile.sqlite`。不要删除 `onefile-data` volume，否则用户、存储账号、密钥、token 和上传状态都会丢失。

如需自定义 SQLite 路径：

```bash
DATABASE_URL=/app/data/onefile.sqlite
```

`SQLITE_DB_PATH` 仅作为旧配置兼容项保留，新部署建议统一使用 `DATABASE_URL`。

### 应用密钥

OneFile 只需要一个应用密钥，用于 session 签名和存储凭证加密。优先级如下：

1. `.env` 里的 `APP_SECRET`
2. 旧配置兼容项：`SESSION_SECRET` 和 `STORAGE_CREDENTIAL_ENCRYPTION_KEY`
3. 自动生成的 `/app/data/.onefile-secret`

单机 Docker 部署可以不填 `APP_SECRET`。应用会在第一次启动时生成密钥，并保存到 `onefile-data` volume。

多容器部署、迁移或重建 volume 的场景建议显式设置同一个 `APP_SECRET`：

```bash
APP_SECRET=replace_with_a_long_random_secret
```

删除或更换这个密钥会导致旧 session 失效，并且已经加密保存的对象存储凭证无法解密。

### 端口和监听地址

容器内默认值：

```bash
PORT=27507
HOSTNAME=0.0.0.0
```

通常不需要手动设置。修改 `PORT` 时，需要同步调整端口映射和 healthcheck。

### 外部访问地址

默认不需要配置 `APP_ORIGIN` 或 `NEXT_PUBLIC_BASE_URL`。OneFile 会根据当前请求的 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host` 推导 GitHub OAuth 回调地址。

只有反向代理无法正确传递请求头时，再配置：

```bash
APP_ORIGIN=https://onefile.example.com
```

### SQL 备份迁移

管理员可以在「导入导出」里导出 SQL 备份。导出的文件名格式类似：

```text
<APP_SECRET>_yyyyMMddHHmmss.sql
```

导入时应用会从文件名解析并同步 `APP_SECRET` 到当前数据目录的 `.onefile-secret`，这样迁移后仍能解密原有对象存储凭证。

请保留导出的原始文件名，不要手动重命名。

</details>

<details>
<summary>Docker run 部署</summary>

不用 Compose 时，可以直接构建并运行：

```bash
docker build -t onefile .

docker run -d --name onefile \
  -p 127.0.0.1:27507:27507 \
  --env-file .env \
  -v onefile-data:/app/data \
  onefile
```

如果要允许外部直接访问，把端口映射改成：

```bash
-p 27507:27507
```

</details>

<details>
<summary>本地开发</summary>

### 环境要求

- Node.js 20.9 或更高
- pnpm 10.x
- GitHub OAuth App

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

本地开发可创建 `.env.development` 或 `.env`：

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# 可选：不填会自动生成 ./data/.onefile-secret
# APP_SECRET=onefile-local-app-secret

# 可选：不填默认使用 ./data/onefile.sqlite
# DATABASE_URL=./data/onefile.sqlite
```

GitHub OAuth App 本地回调地址：

```text
http://localhost:27507/callback/auth
```

### 常用命令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

开发服务器默认地址：

```text
http://localhost:27507
```

</details>

<details>
<summary>API 调用教程：API key、单文件上传和接口列表</summary>

OneFile 提供统一响应结构：

```json
{
  "data": {},
  "error": null
}
```

网页登录后在「API key」里创建 key。调用接口时放到 `Authorization` Header：

```text
Authorization: Bearer ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

上传接口适合用于：

- 图床和 Markdown 编辑器图片上传
- CI 构建产物上传
- 备份文件投递
- 外部系统把文件写入对象存储

### 用 curl 上传文件

先保存环境变量：

```bash
export ONEFILE_BASE_URL="https://onefile.example.com"
export ONEFILE_API_KEY="ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export FILE="./report.pdf"
```

安装 `jq` 后，可以直接用下面的脚本完成一次单文件上传。这里没有传 `bucket_id`，OneFile 会自动按负载均衡策略选择 bucket；如果要固定上传到某个 bucket，在创建上传会话的 JSON 里加 `"bucket_id": 12`。

```bash
FILE_NAME=$(basename "$FILE")
FILE_SIZE=$(wc -c < "$FILE" | tr -d ' ')
MIME_TYPE=$(file -b --mime-type "$FILE")

curl -fsS -X POST "$ONEFILE_BASE_URL/api/uploads" \
  -H "Authorization: Bearer $ONEFILE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg filename "$FILE_NAME" \
    --argjson size "$FILE_SIZE" \
    --arg mime "$MIME_TYPE" \
    '{
      original_filename: $filename,
      file_size: $size,
      mime_type: $mime,
      upload_mode: "single"
    }')" \
  > /tmp/onefile-upload.json

UPLOAD_ID=$(jq -r '.data.upload_id' /tmp/onefile-upload.json)
UPLOAD_URL=$(jq -r '.data.upload_url' /tmp/onefile-upload.json)
METHOD=$(jq -r '.data.method // "PUT"' /tmp/onefile-upload.json)

headers=()
while IFS=$'\t' read -r key value; do
  headers+=(-H "$key: $value")
done < <(jq -r '.data.headers // {} | to_entries[] | "\(.key)\t\(.value)"' /tmp/onefile-upload.json)

curl -fsS -X "$METHOD" "${headers[@]}" -T "$FILE" "$UPLOAD_URL"

curl -fsS -X POST "$ONEFILE_BASE_URL/api/uploads/$UPLOAD_ID/complete" \
  -H "Authorization: Bearer $ONEFILE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

上传会话响应会返回本次命中的 bucket 和对象路径：

```json
{
  "data": {
    "upload_id": "abc123...",
    "bucket_id": 12,
    "bucket_name": "assets",
    "object_key": "2026/04/30/report.pdf",
    "upload_mode": "single",
    "upload_url": "https://...",
    "method": "PUT",
    "headers": {}
  },
  "error": null
}
```

### 大文件上传

大文件可把 `upload_mode` 改成 `multipart`，再按 `/api/uploads/:id/parts` 获取每一片的上传 URL。全部 PUT 完成后，把每片 ETag 提交到 `/api/uploads/:id/complete`。

应用内 `/api-docs` 有更完整的 multipart 示例。

### 公开上传链接

创建 API key 后会生成公开上传 URL。这个 URL 可以复制、打开或用二维码分享。访问者不需要登录，也看不到 raw API key，只能通过对应 UUID 上传文件。

撤销公开链接会清空 UUID 映射，旧链接会失效。

### 主要接口

- `GET /api/me`：获取当前登录用户
- `GET /api/storage/accounts`：列出存储账号
- `POST /api/storage/accounts`：新增存储账号
- `GET /api/storage/buckets`：列出已同步 bucket
- `GET /api/files`：浏览文件和目录
- `DELETE /api/files`：删除对象
- `POST /api/uploads`：创建上传会话，可省略 `bucket_id`
- `POST /api/uploads/direct`：服务端直传，API key 调用使用 key 上保存的 bucket 和压缩策略
- `POST /api/public-uploads/:uuid`：公开上传链接直传，不暴露 raw API key
- `POST /api/uploads/:id/parts`：签发分片上传 URL
- `POST /api/uploads/:id/complete`：完成上传会话
- `POST /api/uploads/:id/abort`：取消上传会话
- `GET /api/file-api-keys`：列出 API key
- `POST /api/file-api-keys`：创建 API key

更完整的参数说明请访问应用内 `/api-docs`。

</details>

## 使用流程

1. 使用 GitHub OAuth 登录 OneFile。
2. 在「账号管理」添加对象存储账号。
3. 检测账号可用性并同步 bucket。
4. 选择 bucket，浏览目录和文件。
5. 拖拽、粘贴或选择文件上传。
6. 创建 API key，用于外部系统上传、浏览或删除文件。
7. 使用公开上传链接或二维码，让别人无需登录也能上传到指定策略。

## 截图

暂无截图资源。可以将项目截图放到 `docs/pc.png`、`docs/phone.png` 后，在此处补充展示。

## 贡献

欢迎提交 Issue 和 Pull Request。提交代码前建议先运行：

```bash
pnpm lint
pnpm build
```

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
