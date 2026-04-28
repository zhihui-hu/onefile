import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, BookOpenText } from 'lucide-react';
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
];

const errors = [
  ['UNAUTHORIZED', '未登录，或 API token 缺失/无效。'],
  ['FORBIDDEN', '登录用户或 token scope 无权访问该资源。'],
  ['VALIDATION_ERROR', '请求字段缺失、路径非法或参数格式错误。'],
  ['BUCKET_NOT_FOUND', 'bucket_id 不存在或不属于当前用户。'],
  ['PROVIDER_ERROR', '对象存储 SDK 返回错误。'],
  ['UPLOAD_EXPIRED', '上传会话或 presigned URL 已过期。'],
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export function ApiDocsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpenText />
            <h1 className="truncate text-xl font-semibold">OneFile API 文档</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            API token 面向脚本和外部服务；文件列表以对象存储 SDK 返回为准。
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            文件管理器
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>认证</CardTitle>
            <CardDescription>
              网页端使用 GitHub OAuth；外部 API 使用 Bearer token。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CodeBlock>{`Authorization: Bearer of_live_xxxxxxxxxxxxxxxx`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              在头像菜单打开 API token 管理，创建 token
              后保存完整值。服务端只保存 hash， 后续只能看到 token_prefix。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>统一响应</CardTitle>
            <CardDescription>成功和失败都使用固定 envelope。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CodeBlock>{`{
  "data": { "items": [] },
  "error": null
}`}</CodeBlock>
            <CodeBlock>{`{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "object_key is required",
    "details": {}
  }
}`}</CodeBlock>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>端点</CardTitle>
          <CardDescription>
            内部页面和 API token 调用共享这些合同。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>用途</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map(([method, path, description]) => (
                <TableRow key={`${method}-${path}`}>
                  <TableCell>
                    <Badge variant="outline">{method}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{path}</TableCell>
                  <TableCell>{description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>浏览与删除</CardTitle>
            <CardDescription>
              删除基于 bucket_id 和 object_key，不依赖本地 file id。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CodeBlock>{`curl -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  "/api/files?bucket_id=12&prefix=photos/&search=invoice"`}</CodeBlock>
            <CodeBlock>{`curl -X DELETE -H "Authorization: Bearer $ONEFILE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"bucket_id":12,"object_key":"photos/a.png"}' \\
  /api/files`}</CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>上传</CardTitle>
            <CardDescription>
              后端签发 presigned URL，浏览器或脚本直传对象存储。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CodeBlock>{`POST /api/uploads
{
  "bucket_id": 12,
  "object_key": "2026/04/28/report.pdf",
  "original_filename": "report.pdf",
  "file_size": 7340032,
  "mime_type": "application/pdf",
  "upload_mode": "single"
}`}</CodeBlock>
            <CodeBlock>{`PUT <upload_url>
POST /api/uploads/:id/complete`}</CodeBlock>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>错误码</CardTitle>
          <CardDescription>
            调用方应优先读取 error.code，再展示 message。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>含义</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map(([code, description]) => (
                <TableRow key={code}>
                  <TableCell className="font-mono text-xs">{code}</TableCell>
                  <TableCell>{description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
