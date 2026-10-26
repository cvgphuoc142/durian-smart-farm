const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const TOKEN_KEY = 'durian_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public field?: string,
  ) {
    super(message);
  }
}

let onUnauthenticated: () => void = () => {};
export const setUnauthenticatedHandler = (fn: () => void) => {
  onUnauthenticated = fn;
};

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v));
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ''}`;
  const token = getToken();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) onUnauthenticated();
    throw new ApiError(
      res.status,
      data?.code ?? 'http_' + res.status,
      data?.message ?? res.statusText,
      data?.request_id,
      data?.field,
    );
  }
  return data as T;
}

// ---- types (subset of the backend OpenAPI schema) ----
export type Status = 'draft' | 'in_review' | 'approved' | 'published' | 'unpublished';
export type Action = 'submit_review' | 'approve' | 'publish' | 'unpublish' | 'reject_to_draft';

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}
export interface ArticleSummary {
  id: string;
  published_version_id: string | null;
  latest_version_id: string;
  latest_version_no: number;
  latest_status: Status;
  title: string | null;
  disease_code: string | null;
}
export interface ArticleVersion {
  id: string;
  article_id: string;
  version_no: number;
  status: Status;
  title: string;
  body: string;
  search_keywords: string[];
  category: string | null;
  disease_code: string | null;
  source_links: string[];
  plant_parts: string[];
  stages: string[];
}
export interface StandardProfileSummary {
  id: string;
  market_code: string;
  product_form_code: string;
  published_version_id: string | null;
  latest_version_id: string | null;
  latest_status: Status | null;
}
export interface StandardItem {
  id: string;
  item_key: string;
  title: string;
  body: string | null;
  source_link: string;
  source_checked_at: string;
  sort_order: number;
}
export interface StandardVersion {
  id: string;
  version_no: number;
  status: Status;
  title: string;
  description: string | null;
  source_links: string[];
  effective_on: string | null;
}
export interface StandardDetail {
  profile: StandardProfileSummary;
  versions: { version: StandardVersion; items: StandardItem[] }[];
}
export interface Contact {
  id: string;
  kind: 'store' | 'expert';
  name: string;
  province: string | null;
  locality: string | null;
  address: string | null;
  phone: string | null;
  zalo: string | null;
  contact_url: string | null;
  source_link: string | null;
  verified_at: string | null;
  specialty: string | null;
  description: string | null;
  status: Status;
}
export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export interface ChatReport {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  citations: unknown[];
  reason: string | null;
  status: ReportStatus;
  created_at: string;
}

export const STATUSES: Status[] = ['draft', 'in_review', 'approved', 'published', 'unpublished'];
export const NEXT_ACTIONS: Record<Status, Action[]> = {
  draft: ['submit_review'],
  in_review: ['approve', 'reject_to_draft'],
  approved: ['publish', 'reject_to_draft'],
  published: ['unpublish'],
  unpublished: ['reject_to_draft'],
};
