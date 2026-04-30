export const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MIN_PART_SIZE = 5 * 1024 * 1024;
const DEFAULT_PART_SIZE = 16 * 1024 * 1024;
const MAX_PARTS = 10_000;

export type UploadableFile = File & {
  relativePath?: string;
  webkitRelativePath?: string;
};

type WebKitEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    error: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: WebKitEntry[]) => void,
      error: (error: DOMException) => void,
    ) => void;
  };
};

type WebKitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => WebKitEntry | null;
};

export function partSizeFor(size: number) {
  let partSize = DEFAULT_PART_SIZE;
  while (Math.ceil(size / partSize) > MAX_PARTS) {
    partSize *= 2;
  }
  return Math.max(MIN_PART_SIZE, partSize);
}

export function relativePath(file: UploadableFile) {
  return file.relativePath || file.webkitRelativePath || file.name;
}

function setRelativePath(file: File, path: string) {
  (file as UploadableFile).relativePath = path;
  return file as UploadableFile;
}

export function filesFromFolderInput(files: FileList) {
  const fileArray = Array.from(files) as UploadableFile[];
  if (!fileArray.length || typeof Worker === 'undefined') {
    return Promise.resolve(fileArray);
  }

  return new Promise<UploadableFile[]>((resolve) => {
    const worker = new Worker(
      new URL('./upload-folder-worker.ts', import.meta.url),
      {
        type: 'module',
      },
    );

    worker.onmessage = (
      event: MessageEvent<{ files: Array<{ file: File; path: string }> }>,
    ) => {
      worker.terminate();
      resolve(
        event.data.files.map((item) =>
          setRelativePath(item.file, item.path || item.file.name),
        ),
      );
    };

    worker.onerror = () => {
      worker.terminate();
      resolve(fileArray);
    };

    worker.postMessage({
      files: fileArray,
      paths: fileArray.map((file) => file.webkitRelativePath || file.name),
    });
  });
}

function readEntryFile(entry: WebKitEntry, path: string) {
  return new Promise<UploadableFile[]>((resolve, reject) => {
    entry.file?.(
      (file) => resolve([setRelativePath(file, `${path}${file.name}`)]),
      reject,
    );
  });
}

async function readDirectoryEntries(entry: WebKitEntry) {
  const reader = entry.createReader?.();
  if (!reader) return [];
  const allEntries: WebKitEntry[] = [];

  while (true) {
    const batch = await new Promise<WebKitEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    allEntries.push(...batch);
  }

  return allEntries;
}

async function readEntry(
  entry: WebKitEntry,
  path = '',
): Promise<UploadableFile[]> {
  if (entry.isFile) return readEntryFile(entry, path);
  if (!entry.isDirectory) return [];

  const entries = await readDirectoryEntries(entry);
  const files = await Promise.all(
    entries.map((child) => readEntry(child, `${path}${entry.name}/`)),
  );
  return files.flat();
}

export async function filesFromDataTransfer(
  items: DataTransferItemList,
  files: FileList,
) {
  const entries = Array.from(items)
    .map((item) => (item as WebKitDataTransferItem).webkitGetAsEntry?.())
    .filter(Boolean) as WebKitEntry[];

  if (!entries.length) return Array.from(files) as UploadableFile[];

  const collected = await Promise.all(entries.map((entry) => readEntry(entry)));
  return collected.flat();
}

export function putSignedUrl(
  url: string,
  body: Blob,
  headers: Record<string, string> | undefined,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) {
  return new Promise<string | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const abort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    signal.addEventListener('abort', abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onerror = () => reject(new Error('对象存储上传失败'));
    xhr.onabort = () =>
      reject(new DOMException('Upload aborted', 'AbortError'));
    xhr.onload = () => {
      signal.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag'));
      } else {
        reject(new Error(`对象存储返回 ${xhr.status}`));
      }
    };

    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers || {})) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(body);
  });
}
