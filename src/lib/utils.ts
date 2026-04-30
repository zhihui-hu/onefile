import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanDisplayText(value: string) {
  return value
    .replace(
      // Strip ANSI/CSI terminal control sequences from provider and CLI errors.
      /(?:\u001b\[[0-?]*[ -/]*[@-~]|\u009b[0-?]*[ -/]*[@-~]|\u001b[@-Z\\-_])/g,
      '',
    )
    .replace(/\[\d+(?:[;:]\d+)*[A-Za-z~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')
    .trim();
}
