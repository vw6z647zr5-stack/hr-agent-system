import { authStore } from '../state/auth.store';
import { extractErrorMessage, translateErrorMessage } from '../utils/display';

const API_BASE = '/api';
const LOCAL_API_PORT = '3000';
const NATIVE_API_ORIGIN = 'http://127.0.0.1:3000';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
  contentType: string;
}

function getConfiguredUrl(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.replace(/\/+$/, '') : undefined;
}

function getConfiguredTimeoutMs() {
  const value = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 3_000 && value <= 120_000 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

function isLocalPreviewRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname, port } = window.location;
  return (hostname === '127.0.0.1' || hostname === 'localhost') && port === '4173';
}

function isLocalFrontendRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname, port } = window.location;
  return (hostname === '127.0.0.1' || hostname === 'localhost') && ['4173', '5173'].includes(port);
}

function isNativeRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const protocol = window.location.protocol;
  return protocol === 'file:' || protocol === 'capacitor:' || protocol === 'app:';
}

function getLocalApiOrigin() {
  if (typeof window === 'undefined') {
    return `http://127.0.0.1:${LOCAL_API_PORT}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:${LOCAL_API_PORT}`;
}

function assertSafeApiPath(path: string) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /^https?:\/\//i.test(path) ||
    /[\u0000-\u001f\\]/.test(path) ||
    path.length > 2048
  ) {
    throw new Error('请求路径不合法。');
  }

  return path;
}

function getAuthorizedHeaders(init?: RequestInit) {
  const token = authStore.getState().token;
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

function createTimeoutSignal(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), getConfiguredTimeoutMs());

  const clear = () => globalThis.clearTimeout(timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return { signal: controller.signal, clear };
}

async function fetchWithTimeout(path: string, init?: RequestInit) {
  const safePath = assertSafeApiPath(path);
  const { signal, clear } = createTimeoutSignal(init?.signal ?? undefined);

  try {
    return await fetch(`${API_BASE_URL}${safePath}`, {
      ...init,
      signal,
    });
  } finally {
    clear();
  }
}

function normalizeNetworkError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('请求超时，请检查网络或稍后重试。');
  }

  return new Error('无法连接服务器，请检查网络或后端服务是否已启动。');
}

async function handleError(response: Response) {
  if (response.status === 401) {
    authStore.getState().logout();
    throw new Error('登录状态已失效，请重新登录。');
  }

  const text = await readResponseText(response);
  throw new Error(translateErrorMessage(extractErrorMessage(text, getHttpStatusFallback(response.status))));
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function getHttpStatusFallback(status: number) {
  if (status === 400) {
    return '请求参数有误。';
  }

  if (status === 403) {
    return '当前无权执行该操作。';
  }

  if (status === 404) {
    return '请求的资源不存在。';
  }

  if (status >= 500) {
    return '服务器内部错误，请稍后再试。';
  }

  return '请求失败，请稍后再试。';
}

function getFileNameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return '下载文件';
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return sanitizeDownloadFileName(decodeFileNameComponent(utf8Match[1]));
  }

  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return sanitizeDownloadFileName(plainMatch[1]);
  }

  return '下载文件';
}

function decodeFileNameComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeDownloadFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\r\n\u0000]/g, '_').trim().slice(0, 180) || '下载文件';
}

export const API_BASE_URL =
  getConfiguredUrl(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (isNativeRuntime() ? `${NATIVE_API_ORIGIN}${API_BASE}` : undefined) ??
  (isLocalPreviewRuntime() ? `${getLocalApiOrigin()}${API_BASE}` : API_BASE);

export const SOCKET_BASE_URL =
  getConfiguredUrl(import.meta.env.VITE_SOCKET_BASE_URL as string | undefined) ??
  (isNativeRuntime() ? NATIVE_API_ORIGIN : undefined) ??
  (isLocalPreviewRuntime() ? getLocalApiOrigin() : undefined);

export function resolveAssetUrl(path?: string | null) {
  if (!path) {
    return undefined;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedPath.startsWith('/uploads/user-photos/')) {
    return undefined;
  }

  if (isLocalFrontendRuntime()) {
    return `${getLocalApiOrigin()}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetchWithTimeout(path, {
      ...init,
      headers: getAuthorizedHeaders(init),
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  if (!response.ok) {
    await handleError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await readResponseText(response);
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('服务器响应格式异常，请稍后再试。');
  }
}

export async function apiFileRequest(path: string, init?: RequestInit): Promise<DownloadedFile> {
  const headers = getAuthorizedHeaders(init);
  headers.delete('Content-Type');

  let response: Response;

  try {
    response = await fetchWithTimeout(path, {
      ...init,
      headers,
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  if (!response.ok) {
    await handleError(response);
  }

  return {
    blob: await response.blob(),
    fileName: getFileNameFromDisposition(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export function triggerBrowserDownload(file: DownloadedFile, openInline = false) {
  if (typeof document === 'undefined') {
    return;
  }

  const objectUrl = URL.createObjectURL(file.blob);

  if (openInline && typeof window !== 'undefined') {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = sanitizeDownloadFileName(file.fileName);
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
}

export function toQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const result = searchParams.toString();
  return result ? `?${result}` : '';
}
