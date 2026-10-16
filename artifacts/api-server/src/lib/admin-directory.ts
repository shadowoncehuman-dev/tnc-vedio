import { supabaseRequest } from "./supabase-rest";
import { getSharedTncSession, tncOptionalAuthRequest } from "./tnc-session";

const PAGE_SIZE = 500;
const CRM_PAGE_SIZE = 500;
const CRM_PAGE_CONCURRENCY = 8;
const DIRECTORY_CACHE_MS = 30_000;
const PARTIAL_DIRECTORY_CACHE_MS = 15_000;
const SENSITIVE_FIELD = /(password|pass|(?:^|[_-])pa(?:$|[_-])|token|secret|authorization|credential|api[_-]?key|otp|jwt)/i;

type SafeValue = string | number | boolean | null | SafeValue[] | { [key: string]: SafeValue };

export interface AdminDirectoryUser {
  id: string;
  source: "app" | "telegram" | "mobile" | "crm";
  name: string;
  details: Record<string, SafeValue>;
  activityAt: string | null;
}

type AdminDirectoryResult = {
  users: AdminDirectoryUser[];
  unavailableSources: string[];
};

let directoryCache: { value: AdminDirectoryResult; expiresAt: number } | null = null;
let directoryLoad: Promise<AdminDirectoryResult> | null = null;

function redact(value: unknown): SafeValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item) ?? null);
  }
  if (typeof value === "object") {
    const safe: Record<string, SafeValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) continue;
      const safeValue = redact(item);
      if (safeValue !== undefined) safe[key] = safeValue;
    }
    return safe;
  }
  return undefined;
}

async function fetchAllRows<T>(table: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabaseRequest<T[]>(
      `${table}?select=*&order=${order}&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function unwrapCrmJson(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function fetchCrmUsers(): Promise<AdminDirectoryUser[]> {
  if (!await getSharedTncSession()) throw new Error("No shared TNC session is available");
  const rows: Record<string, unknown>[] = [];
  for (let firstPage = 1; firstPage <= 100; firstPage += CRM_PAGE_CONCURRENCY) {
    const pages = await Promise.all(Array.from({ length: CRM_PAGE_CONCURRENCY }, (_, index) => {
      const page = firstPage + index;
      return tncOptionalAuthRequest("fe", { json: "*" }, {
        sch: "t_us",
        cond: {},
        page,
        limit: CRM_PAGE_SIZE,
      });
    }));
    let foundLastPage = false;
    for (const result of pages) {
      if (!Array.isArray(result)) throw new Error("CRM user list response was not an array");
      rows.push(...result as Record<string, unknown>[]);
      if (result.length < CRM_PAGE_SIZE) {
        foundLastPage = true;
        break;
      }
    }
    if (foundLastPage) break;
    if (firstPage + CRM_PAGE_CONCURRENCY > 100) throw new Error("CRM user list exceeded the paging limit");
  }

  return rows.map((row) => {
    const crmJson = unwrapCrmJson(row.json);
    const flat = { ...row, ...crmJson };
    return toDirectoryUser(
      "crm",
      row.row_id ?? crmJson._us_id ?? row.id,
      crmJson._us_na ?? crmJson._na ?? row.mobilenumber ?? row.mobile ?? "CRM user",
      flat,
      row.up_on ?? row.cr_on ?? row.last_seen,
    );
  });
}

function toDirectoryUser(
  source: AdminDirectoryUser["source"],
  id: unknown,
  name: unknown,
  row: Record<string, unknown>,
  activityAt: unknown,
): AdminDirectoryUser {
  const safeDetails = redact(row);
  const details = safeDetails && typeof safeDetails === "object" && !Array.isArray(safeDetails)
    ? safeDetails as Record<string, SafeValue>
    : {};
  return {
    id: `${source}:${String(id ?? "unknown")}`,
    source,
    name: typeof name === "string" && name.trim() ? name.trim() : String(id ?? "Unnamed user"),
    details,
    activityAt: typeof activityAt === "string" ? activityAt : null,
  };
}

async function loadAdminDirectoryUsers(): Promise<AdminDirectoryResult> {
  const [appRows, telegramRows, mobileRows] = await Promise.all([
    fetchAllRows<Record<string, unknown>>("app_users", "id.asc"),
    fetchAllRows<Record<string, unknown>>("bot_users", "id.asc"),
    fetchAllRows<Record<string, unknown>>("mobile_app_users", "install_id.asc"),
  ]);
  let crmUsers: AdminDirectoryUser[] = [];
  let unavailableSources: string[] = [];
  try {
    crmUsers = await fetchCrmUsers();
  } catch (error) {
    unavailableSources = ["crm"];
    const { logger } = await import("./logger");
    logger.warn({ err: error }, "CRM users could not be added to the admin directory");
  }

  return {
    users: [
    ...appRows.map((row) => toDirectoryUser("app", row.user_id ?? row.id, row.name, row, row.updated_at ?? row.created_at)),
    ...telegramRows.map((row) => toDirectoryUser(
      "telegram",
      row.telegram_id ?? row.id,
      [row.first_name, row.last_name].filter((part) => typeof part === "string" && part.trim()).join(" "),
      row,
      row.last_seen ?? row.first_seen,
    )),
    ...mobileRows.map((row) => toDirectoryUser(
      "mobile",
      row.install_id ?? row.id,
      row.display_name,
      row,
      row.last_seen ?? row.first_seen,
    )),
      ...crmUsers,
    ],
    unavailableSources,
  };
}

export async function listAdminDirectoryUsers(): Promise<AdminDirectoryResult> {
  if (directoryCache && Date.now() < directoryCache.expiresAt) {
    return directoryCache.value;
  }
  if (directoryLoad) return directoryLoad;

  const load = loadAdminDirectoryUsers();
  directoryLoad = load;
  try {
    const value = await load;
    directoryCache = {
      value,
      expiresAt: Date.now() + (value.unavailableSources.length ? PARTIAL_DIRECTORY_CACHE_MS : DIRECTORY_CACHE_MS),
    };
    return value;
  } finally {
    if (directoryLoad === load) directoryLoad = null;
  }
}

export function invalidateAdminDirectoryCache(): void {
  directoryCache = null;
}