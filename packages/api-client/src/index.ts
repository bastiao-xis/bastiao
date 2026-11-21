/**
 * Cliente mínimo da API. Na Fase 1 cobre saúde e login da equipe;
 * cresce junto com os módulos da API.
 */

export type StaffRole = 'CASHIER' | 'KITCHEN' | 'MANAGER' | 'OWNER';

export interface StaffProfile {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  mfaEnabled: boolean;
}

export type LoginResult =
  | {
      status: 'AUTHENTICATED';
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: StaffProfile;
    }
  | { status: 'MFA_REQUIRED'; mfaToken: string }
  | { status: 'MFA_ENROLLMENT_REQUIRED'; mfaToken: string };

export interface Store {
  id: string;
  code: string;
  name: string;
  timezone: string;
  active: boolean;
}

export type UnitKind = 'MASS' | 'VOLUME' | 'UNIT';
export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'un';

export interface Ingredient {
  id: string;
  name: string;
  unitKind: UnitKind;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  active: boolean;
}

/** Quantidades na unidade-base (g, ml, un), como texto decimal. Custo médio em centavos por unidade-base. */
export interface StockLine {
  ingredientId: string;
  name: string;
  unitKind: UnitKind;
  quantity: string;
  avgCost: string;
  valueCents: number;
  minQuantity: string | null;
  belowMinimum: boolean;
}

export type StockMovementType = 'PURCHASE' | 'ADJUSTMENT' | 'WASTE' | 'COUNT';

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantityDelta: string;
  quantityAfter: string;
  unitCost: string;
  avgCostAfter: string;
  valueCents: number;
  reason: string | null;
  purchaseId: string | null;
  createdAt: string;
}

export interface PurchaseItemInput {
  ingredientId: string;
  quantity: string;
  unit: Unit;
  totalCents: number;
}

export interface PurchaseInput {
  supplierId: string;
  invoiceNumber?: string;
  purchasedAt: string;
  notes?: string;
  items: PurchaseItemInput[];
}

export interface Purchase {
  id: string;
  storeId: string;
  status: 'DRAFT' | 'POSTED';
  invoiceNumber: string | null;
  purchasedAt: string;
  notes: string | null;
  totalCents: number;
  postedAt: string | null;
  supplier: { id: string; name: string };
  items?: Array<{
    id: string;
    quantity: string;
    unit: Unit;
    baseQuantity: string;
    totalCents: number;
    ingredient: { id: string; name: string; unitKind: UnitKind };
  }>;
}

export interface AdjustmentInput {
  ingredientId: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'WASTE';
  quantity: string;
  unit: Unit;
  reason: string;
}

export interface CountInput {
  note?: string;
  items: Array<{ ingredientId: string; countedQuantity: string; unit: Unit }>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${status}`,
    );
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
  fetch?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = opts.getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
  }

  return {
    health: () => call<{ status: 'ok' }>('GET', '/health'),
    auth: {
      login: (email: string, password: string) =>
        call<LoginResult>('POST', '/auth/login', { email, password }),
      verifyMfa: (mfaToken: string, code: string) =>
        call<LoginResult>('POST', '/auth/mfa/verify', { mfaToken, code }),
      beginMfaEnrollment: (mfaToken: string) =>
        call<{ secret: string; otpauthUrl: string }>('POST', '/auth/mfa/enroll', { mfaToken }),
      confirmMfaEnrollment: (mfaToken: string, code: string) =>
        call<LoginResult>('POST', '/auth/mfa/enroll/confirm', { mfaToken, code }),
      refresh: (refreshToken: string) =>
        call<LoginResult>('POST', '/auth/refresh', { refreshToken }),
      logout: () => call<void>('POST', '/auth/logout'),
      me: () => call<StaffProfile>('GET', '/auth/me'),
    },
    stores: { list: () => call<Store[]>('GET', '/stores') },
    ingredients: {
      list: () => call<Ingredient[]>('GET', '/ingredients'),
      create: (body: { name: string; unitKind: UnitKind }) =>
        call<Ingredient>('POST', '/ingredients', body),
      update: (id: string, body: { name?: string; active?: boolean }) =>
        call<Ingredient>('PATCH', `/ingredients/${id}`, body),
    },
    suppliers: {
      list: () => call<Supplier[]>('GET', '/suppliers'),
      create: (body: { name: string; document?: string; phone?: string }) =>
        call<Supplier>('POST', '/suppliers', body),
      update: (
        id: string,
        body: Partial<Pick<Supplier, 'name' | 'active'>> & { document?: string; phone?: string },
      ) => call<Supplier>('PATCH', `/suppliers/${id}`, body),
    },
    stock: {
      list: (storeId: string) => call<StockLine[]>('GET', `/stores/${storeId}/stock`),
      movements: (storeId: string, ingredientId: string) =>
        call<StockMovement[]>('GET', `/stores/${storeId}/stock/${ingredientId}/movements`),
      setMin: (storeId: string, ingredientId: string, minQuantity: string | null, unit: Unit) =>
        call<{ minQuantity: string | null }>(
          'PUT',
          `/stores/${storeId}/stock/${ingredientId}/min`,
          { minQuantity, unit },
        ),
      adjust: (storeId: string, body: AdjustmentInput) =>
        call<StockMovement>('POST', `/stores/${storeId}/stock/adjustments`, body),
      count: (storeId: string, body: CountInput) =>
        call<StockMovement[]>('POST', `/stores/${storeId}/stock/counts`, body),
    },
    purchases: {
      list: (storeId: string) => call<Purchase[]>('GET', `/stores/${storeId}/purchases`),
      get: (storeId: string, id: string) =>
        call<Purchase>('GET', `/stores/${storeId}/purchases/${id}`),
      create: (storeId: string, body: PurchaseInput) =>
        call<Purchase>('POST', `/stores/${storeId}/purchases`, body),
      update: (storeId: string, id: string, body: PurchaseInput) =>
        call<Purchase>('PUT', `/stores/${storeId}/purchases/${id}`, body),
      remove: (storeId: string, id: string) =>
        call<void>('DELETE', `/stores/${storeId}/purchases/${id}`),
      post: (storeId: string, id: string) =>
        call<Purchase>('POST', `/stores/${storeId}/purchases/${id}/post`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
