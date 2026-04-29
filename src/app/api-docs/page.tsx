import Link from 'next/link';

const endpoints = [
  ['GET', '/api/me', '当前登录用户'],
  ['GET', '/api/storage/buckets', '列出已同步 bucket'],
  ['GET', '/api/files?bucket_id=&prefix=&search=', '浏览真实对象存储目录'],
  ['DELETE', '/api/files', '按 bucket_id + object_key 删除对象'],
  ['POST', '/api/uploads', '创建单文件或分片上传会话'],
  ['POST', '/api/uploads/:id/parts', '签发分片上传 URL'],
  ['POST', '/api/uploads/:id/complete', '完成上传会话'],
  ['POST', '/api/uploads/:id/abort', '取消分片上传'],
] as const;

const errors = [
  ['UNAUTHORIZED', '未登录，或 API token 缺失/无效。'],
  ['FORBIDDEN', '登录用户或 token scope 无权访问该资源。'],
  ['VALIDATION_ERROR', '请求字段缺失、路径非法或参数格式错误。'],
  ['BUCKET_NOT_FOUND', 'bucket_id 不存在或不属于当前用户。'],
  ['PROVIDER_ERROR', '对象存储 SDK 返回错误。'],
  ['UPLOAD_EXPIRED', '上传会话或 presigned URL 已过期。'],
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
          API token 面向脚本和外部服务；文件列表以对象存储 SDK
          返回为准。网页端使用 GitHub OAuth，外部 API 使用 Bearer token。
        </p>

        <h2 className="mt-10 text-xl font-semibold">认证</h2>

        <p>请求时在 Header 中携带 API token。</p>

        <CodeBlock>{`Authorization: Bearer ofk_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>

        <p>
          在头像菜单打开 API token 管理，创建 token 后保存完整值。服务端只保存
          hash，后续只能看到 token_prefix。
        </p>

        <p>
          分片上传需要 <code>uploads:write</code> scope；历史 token 如果已有{' '}
          <code>files:write</code>，也会被视为具备上传写入权限。
        </p>

        <h2 className="mt-10 text-xl font-semibold">统一响应</h2>

        <p>成功和失败都使用固定 envelope。</p>

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

        <p>内部页面和 API token 调用共享这些合同。</p>

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

        <CodeBlock>{`curl -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  "/api/files?bucket_id=12&prefix=photos/&search=invoice"`}</CodeBlock>

        <h3 className="mt-6 font-semibold">删除文件</h3>

        <CodeBlock>{`curl -X DELETE -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"bucket_id":12,"object_key":"photos/a.png"}' \\
  /api/files`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">上传</h2>

        <p>后端签发 presigned URL，浏览器或脚本直传对象存储。</p>

        <h3 className="mt-6 font-semibold">创建上传会话</h3>

        <CodeBlock>{`POST /api/uploads
{
  "bucket_id": 12,
  "object_key": "2026/04/28/report.pdf",
  "original_filename": "report.pdf",
  "file_size": 7340032,
  "mime_type": "application/pdf",
  "upload_mode": "single"
}`}</CodeBlock>

        <h3 className="mt-6 font-semibold">完成单文件上传</h3>

        <CodeBlock>{`curl -X PUT -T ./report.pdf "<upload_url>"

curl -X POST -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"etag":"<etag-from-put-response>"}' \\
  /api/uploads/:id/complete`}</CodeBlock>

        <h3 className="mt-6 font-semibold">分片上传</h3>

        <CodeBlock>{`# 1. 创建 multipart 会话
curl -X POST -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bucket_id":12,
    "object_key":"videos/big.mov",
    "original_filename":"big.mov",
    "file_size":2147483648,
    "mime_type":"video/quicktime",
    "upload_mode":"multipart",
    "part_size":16777216
  }' \\
  /api/uploads

# 2. 逐片签 URL，并用返回的 upload_url 直传对象存储
curl -X POST -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"part_number":1,"content_length":16777216}' \\
  /api/uploads/:id/parts

curl -X PUT --data-binary @part-0001 "<upload_url>"

# 3. 带每片 ETag 完成 multipart
curl -X POST -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "parts":[
      {"part_number":1,"etag":"<etag-1>"},
      {"part_number":2,"etag":"<etag-2>"}
    ]
  }' \\
  /api/uploads/:id/complete`}</CodeBlock>

        <h2 className="mt-10 text-xl font-semibold">错误码</h2>

        <p>调用方应优先读取 error.type 判断语义，展示时使用 error.message。</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">Type</th>
                <th className="border px-3 py-2 text-left">含义</th>
              </tr>
            </thead>
            <tbody>
              {errors.map(([code, description]) => (
                <tr key={code}>
                  <td className="border px-3 py-2 align-top">
                    <code>{code}</code>
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
