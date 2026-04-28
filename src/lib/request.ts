import { toast } from 'sonner';

interface RequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  data?: unknown; // 用于传递请求体
}

export interface ApiEnvelope<T> {
  data: T;
  error: null | {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: RequestConfig = {}) {
    this.baseURL = config.baseURL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }
  updateToken(token: string) {
    // this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    this.defaultHeaders['token'] = `${token}`;
  }

  private buildURL(url: string, params?: Record<string, unknown>): string {
    let fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const paramString = searchParams.toString();
      if (paramString) {
        fullURL += `${fullURL.includes('?') ? '&' : '?'}${paramString}`;
      }
    }

    return fullURL;
  }

  async request<T>(
    url: string,
    options: RequestOptions = {},
  ): Promise<ApiEnvelope<T>> {
    const { params, data, ...fetchOptions } = options;

    const fullURL = this.buildURL(url, params);

    const headers: HeadersInit = {
      ...this.defaultHeaders,
      ...(fetchOptions.headers || {}),
    };

    let body = fetchOptions.body;

    // 如果提供了 data，优先使用
    if (data !== undefined) {
      if (data instanceof FormData) {
        body = data;
        Reflect.deleteProperty(headers, 'Content-Type'); // FormData 不需要手动设置 Content-Type
      } else {
        body = JSON.stringify(data);
      }
    }
    try {
      const response = await fetch(fullURL, {
        ...fetchOptions,
        headers,
        body,
      });
      const contentType = response.headers.get('content-type');
      let responseData: T;
      if (contentType?.includes('application/json')) {
        const jsonResponse = (await response.json()) as ApiEnvelope<T>;
        if (jsonResponse.error) {
          if (response.status === 401) {
            localStorage.clear();
            toast.error('登录信息已过期，请重新登录');
          }
          throw new Error(jsonResponse.error.message);
        }
        return jsonResponse;
      } else if (contentType?.startsWith('text/')) {
        responseData = (await response.text()) as T;
      } else {
        responseData = (await response.blob()) as T;
      }

      return {
        data: responseData,
        error: null,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('网络请求失败');
    }
  }

  // GET 请求
  get<T>(
    url: string,
    params?: Record<string, string | number | boolean>,
    options?: Omit<RequestOptions, 'params'>,
  ) {
    return this.request<T>(url, { ...options, method: 'GET', params });
  }

  // POST 请求
  post<T = unknown, B = unknown>(
    url: string,
    data?: B,
    options?: Omit<RequestOptions, 'data'>,
  ) {
    return this.request<T>(url, { ...options, method: 'POST', data });
  }

  // PUT 请求
  put<T = unknown, B = unknown>(
    url: string,
    data?: B,
    options?: Omit<RequestOptions, 'data'>,
  ) {
    return this.request<T>(url, { ...options, method: 'PUT', data });
  }

  // PATCH 请求
  patch<T = unknown, B = unknown>(
    url: string,
    data?: B,
    options?: Omit<RequestOptions, 'data'>,
  ) {
    return this.request<T>(url, { ...options, method: 'PATCH', data });
  }

  // DELETE 请求
  delete<T = unknown>(url: string, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  // 上传文件
  upload<T = unknown>(
    url: string,
    formData: FormData,
    options?: Omit<RequestOptions, 'data' | 'body'>,
  ) {
    return this.request<T>(url, { ...options, method: 'POST', data: formData });
  }
}

// 创建默认实例
export const http = new HttpClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || '/api'}`,
});

// 快捷导出函数
export const get = http.get.bind(http);
export const post = http.post.bind(http);
export const put = http.put.bind(http);
export const patch = http.patch.bind(http);
export const del = http.delete.bind(http);
export const upload = http.upload.bind(http);

export default http;
