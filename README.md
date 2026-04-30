# OneFile - 聚合对象存储上传平台

<p align="left">
  <img src="https://img.shields.io/badge/React-19-282C34?logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn/ui-black?style=flat&logo=vercel&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Lucide_React-yellow?logo=lucide&logoColor=black" alt="Lucide" />
  <img src="https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=tanstack&logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/TanStack_Table-v8-FF4154?logo=tanstack&logoColor=white" alt="TanStack Table" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/pnpm-orange?logo=pnpm&logoColor=white" alt="pnpm" />
</p>

中文

## ✨ 功能特性

- ☁️ **多云对象存储聚合**：支持 AWS S3、Cloudflare R2、Backblaze B2、Oracle Object Storage、阿里云 OSS、腾讯云 COS
- 🚀 **浏览器直传对象存储**：后端只签发 presigned URL，不保存文件字节，上传链路更轻
- 📦 **大文件分片上传**：支持单文件、多文件、文件夹上传，并提供分片上传、取消和完成流程
- 🗂️ **统一文件管理器**：按 bucket 浏览目录和文件，支持搜索、刷新、进入文件夹、返回上级和删除对象
- 🔐 **GitHub OAuth 登录**：通过 GitHub 授权登录，支持 session、refresh token 和退出登录
- 🧾 **API Key 调用**：可创建文件 API key，用于脚本、CI、第三方系统通过 Bearer key 调用上传、浏览和删除接口
- 🖼️ **自建上传图床**：配置对象存储和公开访问地址后，即可作为私有图床或素材上传入口，外部工具可以用 API key 上传图片
- ⚖️ **自动选择 Bucket**：调用上传接口时可以不传 `bucket_id`，服务端会在当前用户可用 bucket 中按负载均衡策略自动选择目标 bucket
- 🔒 **凭证加密保存**：对象存储 secret、OAuth token 等敏感信息加密后入库
- 🧹 **自动清理任务**：定期清理过期上传会话、分片状态、OAuth token 和 refresh token
- 🐳 **Docker 生产部署**：内置 `Dockerfile` 和 `docker-compose.yml`，默认服务端口为 `27507`

---

## 🌟 项目亮点

OneFile 的定位不是再做一个网盘，而是把多家对象存储统一成一个可登录、可管理、可脚本调用的上传入口。

- **多存储账号统一接入**：一个页面管理 S3、R2、B2、OCI、OSS、COS 等 bucket，适合把不同云厂商的对象存储放到同一个工作台里使用。
- **负载均衡上传**：外部 API 创建上传时可以省略 `bucket_id`。服务端会在当前用户可用 bucket 中选择进行中上传更少、近期上传更少的 bucket，并返回实际命中的 `bucket_id`、`bucket_name` 和 `object_key`。
- **API Key 适合自动化**：网页登录后创建 API key，脚本、CI、Markdown 工具、图床客户端都可以通过 `Authorization: Bearer ...` 调用上传、浏览、删除接口。
- **后端不接管文件流量**：OneFile 只负责认证、调度和签发 presigned URL，文件字节由客户端直传对象存储，服务端压力更低。
- **单文件和大文件都能走 API**：小文件用单次 PUT，大文件自动支持 multipart，适合图片、构建产物、备份文件和视频素材。

---

## 🚀 部署方法（推荐 Docker Compose）

### 准备条件

部署前先准备好以下内容：

- 一台可以运行 Docker 的服务器
- 一个已经解析到服务器的域名，例如 `example.com`
- 服务器开放 HTTP/HTTPS 访问，或至少开放应用端口 `27507`
- Docker 和 Docker Compose
- GitHub 账号，用于创建 OAuth App
- 对象存储账号和访问密钥，例如 S3、R2、B2、OCI、阿里云 OSS 或腾讯云 COS

生产环境建议使用 HTTPS 域名访问，例如：

```text
https://example.com
```

OneFile 的 GitHub 登录回调地址固定为你的访问地址加 `/callback/auth`：

```text
https://example.com/callback/auth
```

如果通过 `http://服务器 IP:27507` 直接访问，GitHub OAuth App 的 callback URL 就填写：

```text
http://服务器 IP:27507/callback/auth
```

### 服务器部署要求

推荐配置：

- Linux 服务器，推荐 Ubuntu 22.04 / Debian 12 / CentOS Stream 9 或同类发行版
- CPU：1 核及以上
- 内存：1 GB 及以上，建议 2 GB
- 磁盘：10 GB 及以上，需为 SQLite 数据库和 Docker 镜像预留空间
- Docker Engine 24 或更高
- Docker Compose v2

网络要求：

- 入站开放 `80` / `443`，用于 Nginx、Caddy、Traefik 等反向代理
- 如果不使用反向代理，需要开放 `27507`
- 出站允许访问 GitHub API 和对象存储服务商 API

数据要求：

- SQLite 数据库默认保存到 Docker volume：`onefile-data`
- 容器内数据库路径：`/app/data/onefile.sqlite`
- 不需要配置 `DATABASE_URL`；如果不传，应用默认使用 `/app/data/onefile.sqlite`
- 不要删除 `onefile-data` volume，否则用户、存储账号、密钥、token 和上传状态会丢失
- 建议定期备份 Docker volume 或备份 `/app/data/onefile.sqlite`

反向代理建议：

- 生产环境推荐使用 Nginx、Caddy、Traefik 或云厂商负载均衡转发到 `127.0.0.1:27507`
- 反向代理需要保留 `Host`、`X-Forwarded-Proto`、`X-Forwarded-For` 等请求头
- OneFile 默认根据请求地址推导外部访问地址；如果代理无法保留这些请求头，再显式设置 `APP_ORIGIN=https://onefile.example.com`

### GitHub Client ID 和 Secret 获取教程

OneFile 使用 GitHub OAuth 登录。你需要先在 GitHub 创建一个 OAuth App，然后把 GitHub 生成的 Client ID 和 Client Secret 填到 `.env`。

GitHub 官方文档可参考：[Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)。

1. **进入 GitHub Developer settings**

   登录 GitHub 后，点击右上角头像，进入：

   ```text
   Settings -> Developer settings -> OAuth apps
   ```

   也可以直接打开：

   ```text
   https://github.com/settings/developers
   ```

2. **创建 OAuth App**

   点击 `New OAuth App`。如果这是你第一次创建 OAuth App，按钮可能显示为 `Register a new application`。

3. **填写应用信息**

   生产环境示例：

   ```text
   Application name: OneFile
   Homepage URL: https://onefile.example.com
   Application description: OneFile object storage upload platform
   Authorization callback URL: https://onefile.example.com/callback/auth
   ```

   本地开发示例：

   ```text
   Application name: OneFile Local
   Homepage URL: http://localhost:27507
   Application description: OneFile local development
   Authorization callback URL: http://localhost:27507/callback/auth
   ```

   GitHub OAuth App 只能配置一个 callback URL。建议生产环境和本地开发各创建一个 OAuth App，分别保存对应的 `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`。

   OneFile 使用标准网页 OAuth 流程，不需要启用 Device Flow。

4. **注册应用**

   点击 `Register application`。

5. **复制 Client ID**

   进入应用详情页后，复制页面里的 `Client ID`，填入 `.env`：

   ```bash
   GITHUB_CLIENT_ID=复制到的_Client_ID
   ```

6. **生成 Client Secret**

   在同一个应用详情页点击 `Generate a new client secret`，按 GitHub 提示确认后复制生成的 secret，填入 `.env`：

   ```bash
   GITHUB_CLIENT_SECRET=复制到的_Client_Secret
   ```

   Client Secret 属于敏感信息，不要提交到 Git，也不要放到前端代码里。如果忘记或泄露，可以回到 OAuth App 页面重新生成一个，然后更新部署环境变量。

7. **确认回调地址**

   OneFile 默认会根据当前请求地址生成 GitHub 回调地址：

   ```text
   当前访问地址/callback/auth
   ```

   所以生产环境通过 `https://onefile.example.com` 访问时，GitHub callback URL 配置为：

   ```text
   https://onefile.example.com/callback/auth
   ```

   本地开发通过 `http://localhost:27507` 访问时，GitHub callback URL 配置为：

   ```text
   http://localhost:27507/callback/auth
   ```

   一般不需要配置 `APP_ORIGIN` 或 `NEXT_PUBLIC_BASE_URL`。如果反向代理无法正确传递 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`，再在 `.env` 里加 `APP_ORIGIN=https://onefile.example.com` 作为固定外部地址。

### Docker Compose 部署

1. **准备环境变量**

   在项目根目录创建 `.env`。Docker Compose 会读取这个文件做变量插值，但只把白名单配置传进容器。默认数据库、端口和监听地址都不需要写。

   如果还没有 `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`，先参考下方「GitHub Client ID 和 Secret 获取教程」创建 OAuth App。

   ```bash
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret

   # 可选：单机 Docker 默认会自动生成并保存到 /app/data/.onefile-secret
   # APP_SECRET=replace_with_a_long_random_secret

   # 可选：只有代理无法正确传递外部地址时才需要
   # APP_ORIGIN=https://onefile.example.com
   ```

   `SESSION_SECRET`、`STORAGE_CREDENTIAL_ENCRYPTION_KEY`、`PORT`、`HOSTNAME`、`DATABASE_URL` 都不需要默认配置，也不会被 Compose 默认注入。OneFile 会优先使用 `APP_SECRET`；如果没有填写，会自动生成一个密钥文件并随 `onefile-data` volume 持久化。

   GitHub OAuth App 的回调地址配置为：

   ```text
   https://onefile.example.com/callback/auth
   ```

   默认 Compose 只把应用绑定到服务器本机地址 `127.0.0.1:27507`，适合前面放 Nginx、Caddy 或 Traefik。需要直接暴露端口时，把 `docker-compose.yml` 里的端口改成 `27507:27507`。

2. **启动服务**

   ```bash
   docker compose up -d --build
   ```

3. **访问应用**

   打开：

   ```text
   http://服务器 IP:27507
   ```

4. **查看运行状态**

   ```bash
   docker compose ps
   docker compose logs -f onefile
   ```

5. **升级部署**

   ```bash
   git pull
   docker compose up -d --build
   ```

### Docker 命令部署

```bash
docker build -t onefile .

docker run -d --name onefile \
  -p 127.0.0.1:27507:27507 \
  --env-file .env \
  -v onefile-data:/app/data \
  onefile
```

### 数据持久化

Docker 部署默认将 SQLite 数据库保存到容器内的 `/app/data/onefile.sqlite`，并通过 `onefile-data` volume 持久化。不传 `DATABASE_URL` 时，应用会自动使用这个路径。

如需自定义 SQLite 路径，可设置：

```bash
DATABASE_URL=/app/data/onefile.sqlite
```

`SQLITE_DB_PATH` 仅作为旧配置兼容项保留，新部署建议统一使用 `DATABASE_URL`。构建产物会清理 `.env` 和本地 `data` 目录，不会把配置文件或自动密钥复制进 standalone 目录。

### 端口和监听地址

容器内默认配置如下，通常不需要传：

```bash
PORT=27507
HOSTNAME=0.0.0.0
```

Compose 默认通过 `127.0.0.1:27507:27507` 只开放给本机反向代理访问。要允许外部直接访问，改成 `27507:27507`；要换端口，可以设置 `PORT` 并同步调整端口映射和 healthcheck。

### 密钥和外部地址

OneFile 只需要一个应用密钥。优先级如下：

1. `.env` 里的 `APP_SECRET`
2. 旧配置兼容项：`SESSION_SECRET` 和 `STORAGE_CREDENTIAL_ENCRYPTION_KEY`
3. 自动生成的 `/app/data/.onefile-secret`

单机 Docker 部署可以不填 `APP_SECRET`，应用会在第一次启动时生成并保存到 `onefile-data` volume。这个密钥用于 session 签名和存储凭证加密；删除或更换它会导致旧 session 失效，并且已经加密保存的对象存储凭证无法解密。多容器、迁移或重建 volume 的场景建议显式设置同一个 `APP_SECRET`。

管理员在「导入导出」里导出的 SQL 备份文件会使用 `<APP_SECRET>_yyyyMMddHHmmss.sql` 作为文件名。导入时应用会从文件名解析并同步 `APP_SECRET` 到当前数据目录的 `.onefile-secret`，这样迁移后仍能解密原有对象存储凭证。请保留导出的原始文件名，不要手动重命名。

`APP_ORIGIN` 和 `NEXT_PUBLIC_BASE_URL` 默认不需要填写。OneFile 会根据当前请求的 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host` 推导 GitHub OAuth 回调地址；反向代理不能正确传递这些请求头时，再配置：

```bash
APP_ORIGIN=https://onefile.example.com
```

---

## 🖼️ 截图

暂无截图资源。可以将项目截图放到 `docs/pc.png`、`docs/phone.png` 后，在此处补充展示。

---

## 🛠️ 本地开发

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

GitHub OAuth App 本地回调地址配置为：

```text
http://localhost:27507/callback/auth
```

### 启动开发服务器

```bash
pnpm dev
```

打开 [http://localhost:27507](http://localhost:27507) 查看应用。

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务

```bash
pnpm start
```

### 代码检查

```bash
pnpm lint
```

---

## 🎯 使用说明

1. **登录账号**：使用 GitHub OAuth 授权登录 OneFile
2. **添加存储账号**：在账号管理中配置 S3、R2、B2、OCI、OSS 或 COS 凭证
3. **同步 Bucket**：检测账号可用性并同步对象存储 bucket 列表
4. **浏览文件**：选择 bucket 后浏览目录和文件，支持搜索和刷新
5. **上传文件**：拖拽、粘贴或选择文件上传；大文件自动走分片上传流程
6. **上传文件夹**：选择文件夹后保留原始相对目录结构上传
7. **删除对象**：在文件管理器中直接删除对象存储里的文件
8. **创建 API Key**：在 API key 管理中生成密钥，用于外部系统调用 `/api` 接口
9. **搭建图床入口**：为 bucket 配置 Public URL 后，可以复制公开链接；外部脚本也可以用 API key 上传图片
10. **查看 API 文档**：访问 `/api-docs` 查看上传、文件浏览和删除接口说明

---

## 🔌 API 能力

OneFile 提供统一响应结构：

```json
{
  "data": {},
  "error": null
}
```

外部系统可以使用 API key 访问接口。网页登录后在 API key 管理中创建 key，调用时放到 `Authorization` Header：

```text
Authorization: Bearer ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

上传接口适合用来搭建图床、Markdown 编辑器图片上传、CI 产物上传等场景。`POST /api/uploads` 创建上传会话时可以传入 `bucket_id` 精确指定 bucket；也可以不传 `bucket_id`，服务端会从当前用户可用 bucket 中按负载均衡策略自动选择目标 bucket，优先选择进行中上传更少、近期上传更少的 bucket，并在响应中返回实际使用的 `bucket_id` 和 `bucket_name`。

### 用 curl 上传文件

先在网页右上角菜单进入 **API key 管理**，创建一个包含 `uploads:write` scope 的 key。完整 key 只在创建后显示一次，请保存到本地环境变量：

```bash
export ONEFILE_BASE_URL="https://onefile.example.com"
export ONEFILE_API_KEY="ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export FILE="./report.pdf"
```

安装 `jq` 后，可以直接用下面的脚本完成一次单文件上传。这里没有传 `bucket_id`，OneFile 会自动按负载均衡策略选择 bucket；如果要固定上传到某个 bucket，在创建上传会话的 JSON 里加 `"bucket_id": 12` 即可。

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

上传会话响应里会返回本次自动选择的 bucket 和对象路径：

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

大文件可把 `upload_mode` 改成 `multipart`，再按 `/api/uploads/:id/parts` 获取每一片的上传 URL，全部 PUT 完成后把每片 ETag 提交到 `/api/uploads/:id/complete`。应用内 `/api-docs` 有更完整的 multipart 示例。

主要接口包括：

- `GET /api/me`：获取当前登录用户
- `GET /api/storage/accounts`：列出存储账号
- `POST /api/storage/accounts`：新增存储账号
- `GET /api/storage/buckets`：列出已同步 bucket
- `GET /api/files`：浏览文件和目录
- `DELETE /api/files`：删除对象
- `POST /api/uploads`：创建上传会话，可省略 `bucket_id` 由服务端自动按负载均衡策略选择 bucket
- `POST /api/uploads/:id/parts`：签发分片上传 URL
- `POST /api/uploads/:id/complete`：完成上传会话
- `POST /api/uploads/:id/abort`：取消上传会话
- `GET /api/file-api-keys`：列出 API key
- `POST /api/file-api-keys`：创建 API key

更完整的参数说明请访问应用内 `/api-docs`。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。提交代码前建议先运行：

```bash
pnpm lint
pnpm build
```

## 📄 许可证

请根据项目实际授权补充许可证文件。

## 🙏 致谢

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

---

**注意**：OneFile 会保存对象存储访问凭证和 API key 信息。生产部署请妥善保护 `.env` 和 `/app/data/.onefile-secret`，并优先通过 HTTPS 和反向代理对外提供服务。
