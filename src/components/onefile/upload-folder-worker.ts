/// <reference lib="webworker" />

type FolderWorkerInput = {
  files: File[];
  paths: string[];
};

type FolderWorkerOutput = {
  files: Array<{
    file: File;
    path: string;
  }>;
};

function cleanPath(value: string) {
  return value
    .replaceAll('\\', '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..')
    .join('/');
}

self.onmessage = (event: MessageEvent<FolderWorkerInput>) => {
  const output: FolderWorkerOutput = {
    files: event.data.files.map((file, index) => ({
      file,
      path: cleanPath(event.data.paths[index] || file.name),
    })),
  };

  self.postMessage(output);
};

export {};
