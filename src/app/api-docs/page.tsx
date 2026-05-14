import { headers } from 'next/headers';
import Link from 'next/link';

const endpoints = [
  [
    'GET',
    '/api/storage/buckets',
    'files:read',
    '列出当前 API key 所属用户的 bucket，用于获取 bucket_id',
  ],
  [
    'GET',
    '/api/files?bucket_id=&prefix=&search=',
    'files:read',
    '浏览真实对象存储目录',
  ],
  ['POST', '/api/files/folders', 'files:write', '创建对象存储目录占位对象'],
  [
    'DELETE',
    '/api/files',
    'files:delete',
    '按 bucket_id + object_key 删除对象',
  ],
  ['POST', '/api/uploads', 'uploads:write', '创建服务端分片上传会话'],
  [
    'POST',
    '/api/uploads/direct',
    'uploads:write',
    '服务端上传；API key 调用使用 key 上保存的 bucket 和压缩策略',
  ],
  [
    'POST',
    '/api/public-uploads/:uuid',
    '公开 UUID',
    'API key 派生的公开上传链接上传，不暴露 raw key',
  ],
  [
    'POST',
    '/api/uploads/:id/parts/upload',
    'uploads:write',
    '通过服务端上传一个分片',
  ],
  ['POST', '/api/uploads/:id/complete', 'uploads:write', '完成上传会话'],
  ['POST', '/api/uploads/:id/abort', 'uploads:write', '取消分片上传'],
] as const;

const apiKeyEndpoints = endpoints.filter(
  ([, path]) => !path.startsWith('/api/public-uploads/'),
);
const publicUploadEndpoints = endpoints.filter(([, path]) =>
  path.startsWith('/api/public-uploads/'),
);

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function apiKeyFromSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  return firstSearchParam(searchParams.key)?.trim().slice(0, 240);
}

function publicUploadUuidFromSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  return firstSearchParam(searchParams.uuid)?.trim().slice(0, 80);
}

function shellDoubleQuoted(value: string) {
  return value.replace(/["\\$`]/g, '\\$&');
}

type HeaderReader = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || undefined;
}

function forwardedValue(headersList: HeaderReader, key: string) {
  const forwarded = headersList.get('forwarded');
  if (!forwarded) {
    return undefined;
  }

  const first = forwarded.split(',')[0];
  for (const part of first.split(';')) {
    const [name, rawValue] = part.split('=');
    if (name?.trim().toLowerCase() === key) {
      return rawValue?.trim().replace(/^"|"$/g, '') || undefined;
    }
  }

  return undefined;
}

function inferredProtocol(host: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host)
    ? 'http'
    : 'https';
}

function pageOriginFromHeaders(headersList: HeaderReader) {
  const host =
    firstHeaderValue(headersList.get('x-forwarded-host')) ??
    forwardedValue(headersList, 'host') ??
    headersList.get('host') ??
    'localhost:27507';
  const protocol =
    firstHeaderValue(headersList.get('x-forwarded-proto')) ??
    forwardedValue(headersList, 'proto') ??
    inferredProtocol(host);

  return `${protocol}://${host.replace(/\/+$/, '')}`;
}

function urlFromOrigin(origin: string, path: string) {
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

const errors = [
  [
    4000,
    'BAD_REQUEST',
    400,
    '请求体不是合法 JSON、form-data 非法、路径参数非法或业务参数不合法。',
  ],
  [4010, 'UNAUTHORIZED', 401, '未登录，或 API key 缺失/无效。'],
  [4030, 'FORBIDDEN', 403, '登录用户或 key scope 无权访问该资源。'],
  [4040, 'NOT_FOUND', 404, '资源不存在、不属于当前用户，或没有可用 bucket。'],
  [4090, 'CONFLICT', 409, '资源冲突，例如唯一字段重复或 key 生成冲突。'],
  [4100, 'UPLOAD_EXPIRED', 410, '上传会话已过期。'],
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

export default async function Page({ searchParams }: PageProps) {
  const pageOrigin = pageOriginFromHeaders(await headers());
  const apiUrl = (path: string) => urlFromOrigin(pageOrigin, path);
  const resolvedSearchParams = (await searchParams) ?? {};
  const apiKey = apiKeyFromSearchParams(resolvedSearchParams);
  const publicUploadUuid =
    publicUploadUuidFromSearchParams(resolvedSearchParams) ??
    '00000000-0000-0000-0000-000000000000';
  const hasApiKeyContext = Boolean(apiKey);
  const hasPublicUploadContext =
    publicUploadUuid !== '00000000-0000-0000-0000-000000000000';
  const hasApiContext = hasApiKeyContext || hasPublicUploadContext;
  const authHeader = apiKey ? `Authorization: Bearer ${apiKey}` : '';
  const curlAuthHeader = shellDoubleQuoted(authHeader);
  const visibleEndpoints = hasApiKeyContext
    ? hasPublicUploadContext
      ? endpoints
      : apiKeyEndpoints
    : hasPublicUploadContext
      ? publicUploadEndpoints
      : [];

  if (!hasApiContext) {
    return (
      <main className="h-full w-full overflow-auto">
        <article className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-8 leading-7">
          <p className="mb-8">
            <Link
              className="text-sm text-muted-foreground underline"
              href="/"
              prefetch={false}
            >
              返回文件管理器
            </Link>
          </p>

          <h1 className="text-3xl font-semibold">OneFile API 文档</h1>
          <p className="mt-4 text-muted-foreground">
            API 文档主要服务于已经开启的 API key
            或公开上传链接。请先在文件管理器右上角用户菜单进入 API
            KEY，创建并启用 key 后，从对应 key 的操作菜单打开 API 文档。
          </p>
          <p className="mt-4 text-muted-foreground">
            从具体 key 打开时，页面会自动带入可用 token 或公开上传
            UUID，并只展示当前密钥页面相关的调用示例。
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="h-full w-full overflow-auto">
      <article className="mx-auto max-w-3xl px-4 py-8 leading-7">
        <p className="mb-8">
          <Link
            className="text-sm text-muted-foreground underline"
            href="/"
            prefetch={false}
          >
            返回文件管理器
          </Link>
        </p>

        <h1 className="text-3xl font-semibold">OneFile API 文档</h1>

        <p className="mt-4 text-muted-foreground">
          API key 面向脚本和外部服务；这里仅列出外部调用需要的 API key
          接口，以及 API key 派生的公开上传接口。网页登录、API key
          创建/编辑/删除等系统自用接口不在此文档中展示。示例地址来自当前已开启密钥页面。
        </p>

        <h2 className="mt-10 text-xl font-semibold">认证</h2>

        {hasApiKeyContext ? (
          <>
            <p>
              除公开上传链接外，请求时在 Header 中携带 API key。
              公开上传链接使用 URL 中的 UUID，不需要暴露 raw key。
            </p>

            <CodeBlock>{authHeader}</CodeBlock>
          </>
        ) : (
          <p>
            当前只展示公开上传链接接口。公开上传链接使用 URL 中的
            UUID，不需要暴露 raw key。
          </p>
        )}

        {hasApiKeyContext ? (
          <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            当前页面示例已使用传入的已开启 key。
          </p>
        ) : null}

        {hasApiKeyContext ? (
          <p>
            <code>files:read</code> 可列 bucket 和浏览文件；
            <code>files:write</code> 可创建目录，历史 key 如果已有该 scope
            也会被视为具备上传写入权限；<code>files:delete</code> 可删除对象；
            <code>uploads:write</code> 可上传文件。
          </p>
        ) : null}

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

        <p>
          {hasApiKeyContext
            ? '下列端点支持 Bearer API key，或使用 API key 派生的公开上传 UUID。'
            : '当前页面只展示这个公开上传 UUID 可调用的端点。'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">Method</th>
                <th className="border px-3 py-2 text-left">Path</th>
                <th className="border px-3 py-2 text-left">Scope</th>
                <th className="border px-3 py-2 text-left">用途</th>
              </tr>
            </thead>
            <tbody>
              {visibleEndpoints.map(([method, path, scope, description]) => (
                <tr key={`${method}-${path}`}>
                  <td className="border px-3 py-2 align-top">{method}</td>
                  <td className="border px-3 py-2 align-top">
                    <code>{apiUrl(path)}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">
                    <code>{scope}</code>
                  </td>
                  <td className="border px-3 py-2 align-top">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasApiKeyContext ? (
          <>
            <h2 className="mt-10 text-xl font-semibold">Bucket 与文件</h2>

            <p>删除基于 bucket_id 和 object_key，不依赖本地 file id。</p>

            <h3 className="mt-6 font-semibold">列出 bucket</h3>

            <CodeBlock>{`curl -H "${curlAuthHeader}" \\
  ${apiUrl('/api/storage/buckets')}`}</CodeBlock>

            <h3 className="mt-6 font-semibold">浏览文件</h3>

            <CodeBlock>{`curl -H "${curlAuthHeader}" \\
  "${apiUrl('/api/files?bucket_id=12&prefix=photos/&search=invoice')}"`}</CodeBlock>

            <h3 className="mt-6 font-semibold">创建目录</h3>

            <CodeBlock>{`curl -X POST -H "${curlAuthHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{"bucket_id":12,"prefix":"photos/","name":"2026"}' \\
  ${apiUrl('/api/files/folders')}`}</CodeBlock>

            <h3 className="mt-6 font-semibold">删除文件</h3>

            <CodeBlock>{`curl -X DELETE -H "${curlAuthHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{"bucket_id":12,"object_key":"photos/a.png"}' \\
  ${apiUrl('/api/files')}`}</CodeBlock>

            <h2 className="mt-10 text-xl font-semibold">上传</h2>

            <p>
              文件先传到 OneFile 服务端，再由服务端写入对象存储。小文件使用
              <code>/api/uploads/direct</code> 一次提交；大文件先创建 multipart
              会话，再逐片上传到服务端。
            </p>

            <h3 className="mt-6 font-semibold">创建分片上传会话</h3>

            <CodeBlock>{`# 创建 multipart 会话
curl -X POST -H "${curlAuthHeader}" \\
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
  ${apiUrl('/api/uploads')}`}</CodeBlock>

            <p>
              响应会包含 <code>bucket_id</code>、<code>bucket_name</code>、
              <code>object_key</code>、<code>part_size</code> 和{' '}
              <code>total_parts</code>；后续完成或取消只需要使用返回的
              <code>upload_id</code>。
            </p>

            <h3 className="mt-6 font-semibold">分片上传</h3>

            <p>
              分片上传规则与 S3 multipart 保持一致：part number 范围是 1 到
              10000；每片大小为 5 MiB 到 5 GiB，最后一片可以小于 5
              MiB；单对象最大 5 TiB，单次 PUT 最大 5 GiB。省略{' '}
              <code>part_size</code> 时默认从 16 MiB 开始，并会自动增大以保证总
              part 数不超过 10000。
            </p>

            <CodeBlock>{`# 1. 将每个分片提交给 OneFile 服务端
curl -X POST -H "${curlAuthHeader}" \\
  -F "part_number=1" \\
  -F "chunk=@part-0001" \\
  ${apiUrl('/api/uploads/:id/parts/upload')}

# 2. 带每片 ETag 完成 multipart
curl -X POST -H "${curlAuthHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "parts":[
      {"part_number":1,"etag":"<etag-1>"},
      {"part_number":2,"etag":"<etag-2>"}
    ]
  }' \\
  ${apiUrl('/api/uploads/:id/complete')}`}</CodeBlock>

            <h3 className="mt-6 font-semibold">API key 服务端上传</h3>

            <p>
              <code>/api/uploads/direct</code> 接收{' '}
              <code>multipart/form-data</code>
              ，适合脚本直接把文件交给 OneFile 服务端写入对象存储。使用 API key
              调用时，bucket 和图片压缩策略来自创建 key
              时保存的配置；不需要每次传 <code>bucket_id</code> 或{' '}
              <code>compress</code>。未指定 bucket 的 key 会在可用 bucket
              中做默认负载均衡。上传会经过服务端内存，当前限制 100
              MiB；大文件请使用上面的服务端分片上传。
            </p>

            <CodeBlock>{`curl -X POST -H "${curlAuthHeader}" \\
  -F "file=@./photo.png" \\
  ${apiUrl('/api/uploads/direct')}

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
          </>
        ) : null}

        {hasPublicUploadContext ? (
          <>
            <h3 className="mt-6 font-semibold">公开上传链接</h3>

            <p>
              创建 API key 后会生成一个公开上传 URL，最后一段是 UUID。浏览器打开{' '}
              <code>/:uuid</code> 会进入只允许选择照片的上传页；脚本可直接 POST
              文件到 <code>/api/public-uploads/:uuid</code>。撤销链接会清空 UUID
              映射，旧链接无法再找到对应 API key。
            </p>

            <CodeBlock>{`curl -X POST \\
  -F "file=@./archive.zip" \\
  ${apiUrl(`/api/public-uploads/${publicUploadUuid}`)}`}</CodeBlock>
          </>
        ) : null}

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
