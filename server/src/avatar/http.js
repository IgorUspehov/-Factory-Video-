const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with retries on network errors. Non-GET requests are retried only when the TCP connection was never
 * established (the request was not sent), so a paid job is never submitted twice.
 */
export async function fetchRetry(url, opts = {}, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(60_000), ...opts });
    } catch (err) {
      const connectFailed = (err.cause?.errors ?? [err.cause]).every((e) => e?.syscall === 'connect');
      const safe = (opts.method ?? 'GET') === 'GET' || connectFailed;
      if (!safe || i >= tries) throw err;
      await sleep(2000 * i);
    }
  }
}

/** Seconds to wait before retrying: the Retry-After header (seconds or a date), else "available in N seconds" from the body. */
export function retryAfterSeconds(res, body) {
  const h = res.headers.get('retry-after');
  if (h) {
    const n = Number(h);
    if (Number.isFinite(n)) return Math.max(0, n);
    const t = Date.parse(h);
    if (Number.isFinite(t)) return Math.max(0, (t - Date.now()) / 1000);
  }
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const m = /available in (\d+(?:\.\d+)?) ?s/i.exec(text) ?? /retry_after"?:\s*(\d+(?:\.\d+)?)/i.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** JSON request; throws an Error with `.status` (and no secrets) on a non-2xx answer. */
export async function jsonRequest(url, opts = {}) {
  const res = await fetchRetry(url, opts);
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err = new Error(`${opts.method ?? 'GET'} ${new URL(url).host}${new URL(url).pathname} -> ${res.status}: ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 300)}`);
    err.status = res.status;
    err.retryAfter = retryAfterSeconds(res, body);
    throw err;
  }
  return body;
}

export { sleep };
