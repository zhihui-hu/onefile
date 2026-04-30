declare module 'ali-oss' {
  namespace OSS {
    interface ClientOptions {
      accessKeyId: string;
      accessKeySecret: string;
      bucket?: string;
      region?: string;
      endpoint?: string;
      stsToken?: string;
      secure?: boolean;
      internal?: boolean;
      cname?: boolean;
      timeout?: number | string;
      authorizationV4?: boolean;
      [key: string]: unknown;
    }

    interface BucketMeta {
      name: string;
      region?: string;
      creationDate?: string;
      storageClass?: string;
    }

    interface ListBucketsResult {
      buckets?: BucketMeta[] | null;
      isTruncated?: boolean;
      nextMarker?: string | null;
    }

    interface ObjectMeta {
      name: string;
      lastModified?: string;
      etag?: string;
      size?: number;
      storageClass?: string;
      type?: string;
    }

    interface ListObjectsResult {
      objects?: ObjectMeta[];
      prefixes?: string[] | null;
      isTruncated?: boolean;
      nextMarker?: string | null;
      nextContinuationToken?: string | null;
    }

    interface OperationResult {
      res?: {
        status?: number;
        headers?: Record<string, unknown>;
      };
    }

    interface HeadObjectResult extends OperationResult {
      meta?: Record<string, string> | null;
      status?: number;
    }

    interface MultipartUploadResult extends OperationResult {
      bucket?: string;
      name?: string;
      uploadId: string;
    }

    interface CompleteMultipartUploadResult extends OperationResult {
      bucket?: string;
      name?: string;
      etag?: string;
    }

    interface PutObjectResult extends OperationResult {
      name: string;
      url?: string;
      data?: unknown;
    }

    interface SignatureUrlV4Request {
      headers?: Record<string, string>;
      queries?: Record<string, string | number | null>;
    }
  }

  class OSS {
    constructor(options: OSS.ClientOptions);

    useBucket(name: string): this;
    setBucket(name: string): this;
    listBuckets(
      query?: Record<string, string | number>,
      options?: Record<string, unknown>,
    ): Promise<OSS.ListBucketsResult>;
    getBucketInfo(
      name: string,
      options?: Record<string, unknown>,
    ): Promise<OSS.OperationResult>;
    listV2(
      query?: Record<string, string | number | boolean>,
      options?: Record<string, unknown>,
    ): Promise<OSS.ListObjectsResult>;
    signatureUrl(
      name: string,
      options?: Record<string, unknown>,
      strictObjectNameValidation?: boolean,
    ): string;
    asyncSignatureUrl(
      name: string,
      options?: Record<string, unknown>,
      strictObjectNameValidation?: boolean,
    ): Promise<string>;
    signatureUrlV4(
      method: string,
      expires: number,
      request?: OSS.SignatureUrlV4Request,
      objectName?: string,
      additionalHeaders?: string[],
    ): Promise<string>;
    initMultipartUpload(
      name: string,
      options?: Record<string, unknown>,
    ): Promise<OSS.MultipartUploadResult>;
    uploadPart(
      name: string,
      uploadId: string,
      partNo: number,
      file: Buffer | Uint8Array | string | NodeJS.ReadableStream,
      start: number,
      end: number,
      options?: Record<string, unknown>,
    ): Promise<OSS.OperationResult>;
    completeMultipartUpload(
      name: string,
      uploadId: string,
      parts: Array<{ number: number; etag: string }>,
      options?: Record<string, unknown>,
    ): Promise<OSS.CompleteMultipartUploadResult>;
    abortMultipartUpload(
      name: string,
      uploadId: string,
      options?: Record<string, unknown>,
    ): Promise<OSS.OperationResult>;
    put(
      name: string,
      file: Buffer | Uint8Array | string | NodeJS.ReadableStream,
      options?: Record<string, unknown>,
    ): Promise<OSS.PutObjectResult>;
    delete(
      name: string,
      options?: Record<string, unknown>,
    ): Promise<OSS.OperationResult>;
    head(
      name: string,
      options?: Record<string, unknown>,
    ): Promise<OSS.HeadObjectResult>;
  }

  export = OSS;
}
