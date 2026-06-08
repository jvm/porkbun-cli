/**
 * Session, portfolio, resource cache, form, operation, and selection state.
 */
import type {
  NormalizedDomain,
  ResourceState,
  DomainQuery,
  DomainSelection,
  OperationContext,
  ConfirmationLevel,
  TerminalCapabilities,
} from '../types.js';
import type { Route, NavigationState } from '../routes.js';

export interface SessionState {
  credentialSource?: 'flags' | 'env' | 'profile';
  profileName?: string;
  baseUrl?: string;
  ipv4: boolean;
  timeout: number;
  verbose: boolean;
  noColor: boolean;
  terminal: TerminalCapabilities;
  pingStatus: ResourceState<{ yourIp: string; credentialsValid: boolean }>;
  balanceStatus: ResourceState<{ balanceCents: number; displayBalance: string }>;
  settingsStatus: ResourceState<{ settings: Record<string, unknown>; monthlySpendCents?: number }>;
}

export interface PortfolioState {
  query: DomainQuery;
  searchText: string;
  debouncedSearch: string;
  domains: ResourceState<{ domains: NormalizedDomain[]; count: number }>;
  loadedPages: Map<number, NormalizedDomain[]>;
  completeness: 'unknown' | 'complete' | 'incomplete';
  scrollIndex: number;
  selectedIndex: number;
  selection: DomainSelection;
  sort: { field: string; direction: 'asc' | 'desc' };
  freshnessTimestamp?: number;
}

export interface ResourceCacheEntry<T = unknown> {
  state: ResourceState<T>;
  cacheKey: string;
}

export interface DomainDetailCache {
  domain: string;
  overview?: ResourceState<NormalizedDomain>;
  dns?: ResourceState<NormalizedDomain[]>;
  nameservers?: ResourceState<string[]>;
  glue?: ResourceState<unknown[]>;
  forwards?: ResourceState<unknown[]>;
  dnssec?: ResourceState<unknown[]>;
  ssl?: ResourceState<unknown>;
  transfer?: ResourceState<unknown>;
  visitedTabs: Set<string>;
}

export interface AppState {
  session: SessionState;
  navigation: NavigationState;
  portfolio: PortfolioState;
  domainCache: Map<string, DomainDetailCache>;
  operation?: OperationContext;
}

export function createInitialAppState(terminal: TerminalCapabilities): AppState {
  return {
    session: {
      ipv4: false,
      timeout: 30_000,
      verbose: false,
      noColor: false,
      terminal,
      pingStatus: { status: 'idle' },
      balanceStatus: { status: 'idle' },
      settingsStatus: { status: 'idle' },
    },
    navigation: {
      current: { name: 'startup' },
      history: [],
      modals: [],
      focusRegion: 'main',
    },
    portfolio: {
      query: { includeLabels: true, start: 0 },
      searchText: '',
      debouncedSearch: '',
      domains: { status: 'idle' },
      loadedPages: new Map(),
      completeness: 'unknown',
      scrollIndex: 0,
      selectedIndex: 0,
      selection: { type: 'none', domains: [], count: 0 },
      sort: { field: 'domain', direction: 'asc' },
    },
    domainCache: new Map(),
  };
}

export function getConfirmationLevel(operation: string): ConfirmationLevel {
  const billableOps = ['domainCreate', 'domainRenew', 'transferDomain'];
  const destructiveOps = ['dnsDelete', 'dnsDeleteByNameType', 'domainDeleteGlue', 'domainDeleteUrlForward', 'dnsDeleteDnssecRecord'];
  const disruptiveOps = ['domainUpdateNs', 'dnsEditByNameType', 'domainUpdateAutoRenew'];

  if (billableOps.includes(operation)) return 'billable';
  if (destructiveOps.includes(operation)) return 'disruptive';
  if (disruptiveOps.includes(operation)) return 'disruptive';
  return 'standard';
}

export type AppAction =
  | { type: 'SET_PING_STATUS'; payload: ResourceState<{ yourIp: string; credentialsValid: boolean }> }
  | { type: 'SET_BALANCE_STATUS'; payload: ResourceState<{ balanceCents: number; displayBalance: string }> }
  | { type: 'SET_SETTINGS_STATUS'; payload: ResourceState<{ settings: Record<string, unknown>; monthlySpendCents?: number }> }
  | { type: 'SET_CREDENTIALS'; payload: { source: 'flags' | 'env' | 'profile'; profile?: string } }
  | { type: 'NAVIGATE'; payload: Route }
  | { type: 'GO_BACK' }
  | { type: 'SET_DOMAINS_STATUS'; payload: ResourceState<{ domains: NormalizedDomain[]; count: number }> }
  | { type: 'SET_SEARCH_TEXT'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SELECT_DOMAIN'; payload: number }
  | { type: 'TOGGLE_SELECTION'; payload: string }
  | { type: 'SET_SORT'; payload: { field: string; direction: 'asc' | 'desc' } }
  | { type: 'SET_OPERATION'; payload: OperationContext | undefined }
  | { type: 'SET_SCROLL_INDEX'; payload: number };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PING_STATUS':
      return { ...state, session: { ...state.session, pingStatus: action.payload } };
    case 'SET_BALANCE_STATUS':
      return { ...state, session: { ...state.session, balanceStatus: action.payload } };
    case 'SET_SETTINGS_STATUS':
      return { ...state, session: { ...state.session, settingsStatus: action.payload } };
    case 'SET_CREDENTIALS':
      return {
        ...state,
        session: {
          ...state.session,
          credentialSource: action.payload.source,
          profileName: action.payload.profile,
        },
      };
    case 'NAVIGATE':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          history: [...state.navigation.history, state.navigation.current],
          current: action.payload,
          modals: [],
        },
      };
    case 'GO_BACK':
      if (state.navigation.history.length === 0) return state;
      return {
        ...state,
        navigation: {
          ...state.navigation,
          current: state.navigation.history[state.navigation.history.length - 1],
          history: state.navigation.history.slice(0, -1),
          modals: [],
        },
      };
    case 'SET_DOMAINS_STATUS':
      return {
        ...state,
        portfolio: {
          ...state.portfolio,
          domains: action.payload,
          freshnessTimestamp: Date.now(),
        },
      };
    case 'SET_SEARCH_TEXT':
      return { ...state, portfolio: { ...state.portfolio, searchText: action.payload } };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, portfolio: { ...state.portfolio, debouncedSearch: action.payload } };
    case 'SELECT_DOMAIN':
      return { ...state, portfolio: { ...state.portfolio, selectedIndex: action.payload } };
    case 'TOGGLE_SELECTION': {
      const current = state.portfolio.selection;
      const domain = action.payload;
      const domains = current.domains.includes(domain)
        ? current.domains.filter(d => d !== domain)
        : [...current.domains, domain];
      return {
        ...state,
        portfolio: {
          ...state.portfolio,
          selection: {
            type: domains.length === 0 ? 'none' : domains.length === 1 ? 'single' : 'multiple',
            domains,
            count: domains.length,
          },
        },
      };
    }
    case 'SET_SORT':
      return { ...state, portfolio: { ...state.portfolio, sort: action.payload } };
    case 'SET_OPERATION':
      return { ...state, operation: action.payload };
    case 'SET_SCROLL_INDEX':
      return { ...state, portfolio: { ...state.portfolio, scrollIndex: action.payload } };
    default:
      return state;
  }
}
