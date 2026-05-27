import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  /** 不区分大小写的键名，例如 "k"、"Enter"、"Escape"、"/"。 */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** 在输入框、textarea、contenteditable 中是否仍然触发。默认 false。 */
  allowInInput?: boolean;
  /** 触发时阻止默认行为，默认 true。 */
  preventDefault?: boolean;
}

export type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function matches(event: KeyboardEvent, shortcut: KeyboardShortcut) {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (Boolean(shortcut.ctrl) !== event.ctrlKey) return false;
  if (Boolean(shortcut.meta) !== event.metaKey) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;
  if (Boolean(shortcut.alt) !== event.altKey) return false;
  return true;
}

export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  handler: KeyboardShortcutHandler,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (event: KeyboardEvent) => {
      if (!matches(event, shortcut)) return;
      if (!shortcut.allowInInput && isEditableTarget(event.target)) return;
      if (shortcut.preventDefault !== false) event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [
    enabled,
    shortcut.key,
    shortcut.ctrl,
    shortcut.meta,
    shortcut.shift,
    shortcut.alt,
    shortcut.allowInInput,
    shortcut.preventDefault,
  ]);
}
