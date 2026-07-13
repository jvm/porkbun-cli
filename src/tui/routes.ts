/**
 * Typed route/navigation state: startup, domains list, domain detail tab,
 * transfers, register, account, help, command palette, modal/form/review/result overlays.
 */

export type Route =
  | StartupRoute
  | DomainsRoute
  | DomainDetailRoute
  | TransfersRoute
  | RegisterRoute
  | AccountRoute
  | HelpRoute;

export interface StartupRoute {
  name: "startup";
}

export interface DomainsRoute {
  name: "domains";
  query?: string;
  filters?: DomainFilters;
  sort?: DomainSort;
  selected?: string;
  start?: number;
}

export type DomainDetailTab =
  "overview" | "dns" | "nameservers" | "glue" | "forwards" | "dnssec" | "ssl" | "transfer";

export interface DomainDetailRoute {
  name: "domain-detail";
  domain: string;
  tab: DomainDetailTab;
}

export interface TransfersRoute {
  name: "transfers";
}

export interface RegisterRoute {
  name: "register";
}

export interface AccountRoute {
  name: "account";
}

export interface HelpRoute {
  name: "help";
}

export interface DomainFilters {
  tlds?: string[];
  expiringWithinDays?: number;
  autoRenew?: boolean;
  apiAccess?: boolean;
  status?: string;
  labels?: string[];
}

export interface DomainSort {
  field: "domain" | "expiration" | "tld" | "autoRenew" | "apiAccess";
  direction: "asc" | "desc";
}

export type Modal =
  | ProfilePickerModal
  | ConfirmModal
  | ReviewModal
  | ResultModal
  | CommandPaletteModal
  | HelpModal
  | FormModal;

export interface ProfilePickerModal {
  type: "profile-picker";
  profiles: string[];
}

export interface ConfirmModal {
  type: "confirm";
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ReviewModal {
  type: "review";
  operation: string;
  target: string;
  fields: Array<{ label: string; value: string; sensitive?: boolean }>;
  classification: "read-only" | "mutating" | "destructive" | "billable";
  idempotencyKey?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
}

export interface ResultModal {
  type: "result";
  success: boolean;
  message: string;
  details?: string;
  onClose: () => void;
}

export interface CommandPaletteModal {
  type: "command-palette";
  context: string;
}

export interface HelpModal {
  type: "help";
  context: string;
}

export interface FormModal {
  type: "form";
  formType: string;
  domain?: string;
  recordId?: string;
  initialValues?: Record<string, unknown>;
}

export interface NavigationState {
  current: Route;
  history: Route[];
  modals: Modal[];
  focusRegion: "header" | "nav" | "main" | "footer";
}

export function createInitialNavigationState(): NavigationState {
  return {
    current: { name: "startup" },
    history: [],
    modals: [],
    focusRegion: "main",
  };
}

export function pushRoute(state: NavigationState, route: Route): NavigationState {
  return {
    ...state,
    current: route,
    history: [...state.history, state.current],
    modals: [],
  };
}

export function popRoute(state: NavigationState): NavigationState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return {
    ...state,
    current: previous,
    history: state.history.slice(0, -1),
    modals: [],
  };
}

export function pushModal(state: NavigationState, modal: Modal): NavigationState {
  return {
    ...state,
    modals: [...state.modals, modal],
  };
}

export function popModal(state: NavigationState): NavigationState {
  if (state.modals.length === 0) return state;
  return {
    ...state,
    modals: state.modals.slice(0, -1),
  };
}
