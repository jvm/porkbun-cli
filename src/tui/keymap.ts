/**
 * Centralized key definitions for global and contextual keys.
 */

export interface KeyBinding {
  key: string;
  label: string;
  description: string;
  context: 'global' | 'list' | 'form' | 'modal' | 'detail' | 'palette';
}

export const GLOBAL_KEYS: KeyBinding[] = [
  { key: '?', label: '?', description: 'Open contextual help', context: 'global' },
  { key: '/', label: '/', description: 'Focus search/filter input', context: 'global' },
  { key: 'escape', label: 'Esc', description: 'Close modal, cancel form, or navigate back', context: 'global' },
  { key: 'q', label: 'q', description: 'Quit when no modal/form has focus', context: 'global' },
  { key: 'ctrl+c', label: 'Ctrl+C', description: 'Cancel active request or request exit', context: 'global' },
  { key: 'r', label: 'r', description: 'Refresh the current resource', context: 'global' },
  { key: 'tab', label: 'Tab', description: 'Move focus forward', context: 'global' },
  { key: 'shift+tab', label: 'Shift+Tab', description: 'Move focus backward', context: 'global' },
  { key: ':', label: ':', description: 'Open command palette', context: 'global' },
];

export const LIST_KEYS: KeyBinding[] = [
  { key: 'up', label: '↑', description: 'Move selection up', context: 'list' },
  { key: 'down', label: '↓', description: 'Move selection down', context: 'list' },
  { key: 'j', label: 'j', description: 'Move selection down (vim)', context: 'list' },
  { key: 'k', label: 'k', description: 'Move selection up (vim)', context: 'list' },
  { key: 'enter', label: 'Enter', description: 'Open the focused item', context: 'list' },
  { key: 'space', label: 'Space', description: 'Toggle selection', context: 'list' },
  { key: 'pageUp', label: 'PgUp', description: 'Page up', context: 'list' },
  { key: 'pageDown', label: 'PgDn', description: 'Page down', context: 'list' },
];

export const FORM_KEYS: KeyBinding[] = [
  { key: 'enter', label: 'Enter', description: 'Submit form (goes to review)', context: 'form' },
  { key: 'escape', label: 'Esc', description: 'Cancel form', context: 'form' },
  { key: 'tab', label: 'Tab', description: 'Next field', context: 'form' },
  { key: 'shift+tab', label: 'Shift+Tab', description: 'Previous field', context: 'form' },
];

export const MODAL_KEYS: KeyBinding[] = [
  { key: 'escape', label: 'Esc', description: 'Close modal', context: 'modal' },
  { key: 'enter', label: 'Enter', description: 'Confirm', context: 'modal' },
];

export function getKeyBindingsForContext(context: KeyBinding['context']): KeyBinding[] {
  const bindings = [...GLOBAL_KEYS];
  switch (context) {
    case 'list':
      bindings.push(...LIST_KEYS);
      break;
    case 'form':
      bindings.push(...FORM_KEYS);
      break;
    case 'modal':
      bindings.push(...MODAL_KEYS);
      break;
  }
  return bindings;
}
