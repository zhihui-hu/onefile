import Link from 'next/link';

const endpoints = [
  ['GET', '/api/me', '当前登录用户'],
  ['GET', '/api/file-api-keys', '列出当前用户的 API key'],
  ['POST', '/api/file-api-keys', '创建 API key，响应只返回一次 raw_key'],
  [
    'PATCH',
    '/api/file-api-keys/:id',
    '更新 API key 名称、scope、状态或过期时间',
  ],
  ['DELETE', '/api/file-api-keys/:id', '删除 API key'],
  ['GET', '/api/storage/buckets', '列出已同步 bucket'],
  ['GET', '/api/files?bucket_id=&prefix=&search=', '浏览真实对象存储目录'],
  ['DELETE', '/api/files', '按 bucket_id + object_key 删除对象'],
  ['POST', '/api/uploads', '创建单文件或分片上传会话，可省略 bucket_id'],
  [
    'POST',
    '/api/uploads/direct',
    'API key 服务端直传；compress=true 时图片转 WebP',
  ],
  ['POST', '/api/uploads/:id/parts', '签发分片上传 URL'],
  ['POST', '/api/uploads/:id/complete', '完成上传会话'],
  ['POST', '/api/uploads/:id/abort', '取消分片上传'],
] as const;

const errors = [
  [
    4000,
    'BAD_REQUEST',
    400,
    '请求体不是合法 JSON、路径参数非法或业务参数不合法。',
  ],
  [4010, 'UNAUTHORIZED', 401, '未登录，或 API key 缺失/无效。'],
  [4030, 'FORBIDDEN', 403, '登录用户或 key scope 无权访问该资源。'],
  [4040, 'NOT_FOUND', 404, '资源不存在、不属于当前用户，或没有可用 bucket。'],
  [4090, 'CONFLICT', 409, '资源冲突，例如唯一字段重复或 key 生成冲突。'],
  [4100, 'UPLOAD_EXPIRED', 410, '上传会话或 presigned URL 已过期。'],
  [4220, 'VALIDATION_ERROR', 422, '请求字段缺失、路径非法或参数格式错误。'],
  [4600, 'PROVIDER_ERROR', 460, '对象存储 SDK 返回错误。'],
  [5000, 'INTERNAL_ERROR', 500, '服务端内部错误。'],
] as const;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm leading-6">
      <code>{children}</code>
    </pre>
  );
}

export default function Page() {
  return (
    <main className="h-full w-full overflow-auto">
      <article className="mx-auto max-w-3xl px-4 py-8 leading-7">
        <p className="mb-8">
          <Link className="text-sm text-muted-foreground underline" href="/">
            返回文件管理器
          </Link>
        </p>

        <h1 className="text-3xl font-semibold">OneFile API 文档</h1>

        <p className="mt-4 text-muted-foreground">
          API key 面向脚本和外部服务；文件列表以对象存储 SDK
          返回为准。网页端使用 GitHub OAuth，外部 API 使用 Bearer key。
        </p>

        <h2 className="mt-10 text-xl font-semibold">认证</h2>

        <p>请求时在 Header 中携带 API key。</p>

        <CodeBlock>{`Authorization: Bearer ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>

        <p>
          在头像菜单打开 API key 管理，创建 key 后保存完整值。服务端只保存
          hash，后续只能看到 key_prefix。
        </p>

        <p>
          分片上传需要 <code>uploads:write</code> scope；历史 key 如果已有{' '}
          <code>files:write</code>，也会被视为具备上传写入权限。
        </p>

        <h2 className="mt-10 text-xl font-semibold">统一响应</h2>

        <p>
          成功和失败都使用固定 envelope。失败时 <code>error.code</code>{' '}
          是稳定的数字错误码，<code>error.type</code> 是辅助调试的语义名称。
        </p>

        <h3 className="mt-6 font-semibold">成功响应</h3>

        <CodeBlock>{`{
  "data": { "items": [] },
  "error": null
}`}</CodeBlock>

        <h3 className="mt-6 font-semibold">失败响应</h3>

        <CodeBlock>{`{
  "data": null,
  "error": {
    "code": 4220,
    "type": "VALIDATION_ERROR",
    "message": "object_key is required",
    "details": {}
  }
}`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">端点</h2>

        <p>内部页面和 API key 调用共享这些合同。</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">Method</th>
                <th className="border px-3 py-2 text-left">Path</th>
                <th className="border px-3 py-2 text-left">用途</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(([method, path, description]) => (
                <tr key={`${method}-${path}`}>
                  <td className="border px-3 py-2 align-top">{method}</td>
                  <td className="border px-3 py-2 align-top">
                    <code>{path}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xl font-semibold">浏览与删除</h2>

        <p>删除基于 bucket_id 和 object_key，不依赖本地 file id。</p>

        <h3 className="mt-6 font-semibold">浏览文件</h3>

        <CodeBlock>{`curl -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  "/api/files?bucket_id=12&prefix=photos/&search=invoice"`}</CodeBlock>

        <h3 className="mt-6 font-semibold">删除文件</h3>

        <CodeBlock>{`curl -X DELETE -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"bucket_id":12,"object_key":"photos/a.png"}' \\
  /api/files`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">上传</h2>

        <p>
          后端签发 presigned URL，浏览器或脚本直传对象存储。创建上传时如果传
          <code>bucket_id</code>，对象会写入该 bucket；如果省略{' '}
          <code>bucket_id</code>
          ，服务端会在当前用户可用 bucket
          中按进行中上传和近期上传记录更少的策略自动选择，并在响应中返回实际
          <code>bucket_id</code>。
        </p>

        <h3 className="mt-6 font-semibold">创建上传会话</h3>

        <CodeBlock>{`# 指定 bucket
POST /api/uploads
{
  "bucket_id": 12,
  "object_key": "2026/04/28/report.pdf",
  "original_filename": "report.pdf",
  "file_size": 7340032,
  "mime_type": "application/pdf",
  "upload_mode": "single"
}

# 不指定 bucket，由服务端自动负载均衡选择
POST /api/uploads
{
  "original_filename": "report.pdf",
  "file_size": 7340032,
  "mime_type": "application/pdf",
  "upload_mode": "single"
}`}</CodeBlock>

        <p>
          响应会包含 <code>bucket_id</code>、<code>bucket_name</code>、
          <code>object_key</code> 和上传
          URL；后续完成、取消、分片签名都只需要使用返回的
          <code>upload_id</code>。
        </p>

        <h3 className="mt-6 font-semibold">完成单文件上传</h3>

        <CodeBlock>{`curl -X PUT -T ./report.pdf "<upload_url>"

curl -X POST -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"etag":"<etag-from-put-response>"}' \\
  /api/uploads/:id/complete`}</CodeBlock>

        <h3 className="mt-6 font-semibold">分片上传</h3>

        <p>
          分片上传规则与 S3 multipart 保持一致：part number 范围是 1 到
          10000；每片大小为 5 MiB 到 5 GiB，最后一片可以小于 5 MiB；单对象最大 5
          TiB，单次 PUT 最大 5 GiB。省略 <code>part_size</code> 时默认从 16 MiB
          开始，并会自动增大以保证总 part 数不超过 10000。
        </p>

        <CodeBlock>{`# 1. 创建 multipart 会话
curl -X POST -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "object_key":"videos/big.mov",
    "original_filename":"big.mov",
    "file_size":2147483648,
    "mime_type":"video/quicktime",
    "upload_mode":"multipart",
    "part_size":16777216
  }' \\
  /api/uploads

# 2. 逐片签 URL，并用返回的 upload_url 直传对象存储
curl -X POST -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"part_number":1,"content_length":16777216}' \\
  /api/uploads/:id/parts

curl -X PUT --data-binary @part-0001 "<upload_url>"

# 3. 带每片 ETag 完成 multipart
curl -X POST -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "parts":[
      {"part_number":1,"etag":"<etag-1>"},
      {"part_number":2,"etag":"<etag-2>"}
    ]
  }' \\
  /api/uploads/:id/complete`}</CodeBlock>

        <h3 className="mt-6 font-semibold">API key 直传并压缩图片</h3>

        <p>
          <code>/api/uploads/direct</code> 接收 <code>multipart/form-data</code>
          ，适合脚本直接把文件交给 OneFile 服务端写入对象存储。传{' '}
          <code>compress=true</code> 时，JPEG、PNG、WebP、AVIF、TIFF、HEIC
          等图片会转为 WebP；不传或传 <code>compress=false</code>{' '}
          时直接写入原文件。 非图片文件即使传了 <code>compress=true</code>{' '}
          也会保持原格式。直传会经过服务端内存，当前限制 100
          MiB；大文件仍建议使用 presigned URL 或分片上传。
        </p>

        <CodeBlock>{`curl -X POST -H "Authorization: Bearer $ONEFILE_API_KEY" \\
  -F "file=@./photo.png" \\
  -F "bucket_id=12" \\
  -F "current_prefix=photos/" \\
  -F "compress=true" \\
  /api/uploads/direct

# 响应里的 compressed=true 表示已转为 WebP
{
  "data": {
    "bucket_id": 12,
    "object_key": "photos/photo.webp",
    "mime_type": "image/webp",
    "compressed": true
  },
  "error": null
}`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">API key 管理</h2>

        <p>
          API key 只能由网页登录用户创建和管理。创建成功时会返回一次完整
          <code>raw_key</code>，之后服务端只保存 hash，列表接口只返回
          <code>key_prefix</code>。
        </p>

        <CodeBlock>{`# 创建 API key
curl -X POST -H "Content-Type: application/json" \\
  -d '{
    "name":"deploy-script",
    "description":"CI upload key",
    "scopes":["files:read","uploads:write"],
    "expires_at":null
  }' \\
  /api/file-api-keys

# 更新 API key
curl -X PATCH -H "Content-Type: application/json" \\
  -d '{"status":"inactive"}' \\
  /api/file-api-keys/:id

# 删除 API key
curl -X DELETE /api/file-api-keys/:id`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">错误码</h2>

        <p>
          调用方应优先读取 <code>error.code</code> 判断错误类型，展示时使用{' '}
          <code>error.message</code>。<code>error.type</code>{' '}
          可用于日志和兼容旧逻辑。
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">Code</th>
                <th className="border px-3 py-2 text-left">Type</th>
                <th className="border px-3 py-2 text-left">HTTP</th>
                <th className="border px-3 py-2 text-left">含义</th>
              </tr>
            </thead>
            <tbody>
              {errors.map(([code, type, httpStatus, description]) => (
                <tr key={code}>
                  <td className="border px-3 py-2 align-top">
                    <code>{code}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">
                    <code>{type}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">
                    <code>{httpStatus}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </main>
  );
}
