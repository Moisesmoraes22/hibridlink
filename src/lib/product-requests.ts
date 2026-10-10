/** Key of the visitor's own list of requested products (this browser only). */
export const REQUESTS_KEY = "ezoom:requests"
/** A request is forgotten by the browser after this long. */
export const REQUEST_TTL_DAYS = 30

export interface StoredRequest {
  /** Normalised term (what the database knows it by). */
  term: string
  /** As the visitor typed it. */
  display: string
  at: number
}

/**
 * The form a search term is stored in: lowercase, no accents, letters, digits and a few
 * separators, single spaces. Null when it is not worth a request (too short or long, or it
 * looks like a link). The database repeats this check.
 */
export function normalizeTerm(text: string): string | null {
  const term = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 .+/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (term.length < 3 || term.length > 60) return null
  if (/(http|www\.|\.com)/.test(term)) return null
  return /^[a-z0-9]/.test(term) ? term : null
}

export function readRequests(now = Date.now()): StoredRequest[] {
  try {
    const list = JSON.parse(localStorage.getItem(REQUESTS_KEY) ?? "[]") as StoredRequest[]
    const limit = now - REQUEST_TTL_DAYS * 86_400_000
    return Array.isArray(list) ? list.filter((r) => r && typeof r.term === "string" && r.at > limit) : []
  } catch {
    return []
  }
}

export function writeRequests(list: StoredRequest[]) {
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list.slice(-10)))
  } catch {
    // Storage blocked: the request itself is already recorded on the server.
  }
}
