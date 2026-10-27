// Fetch wrapper. Every state-changing call carries the x-studio header the server requires.
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    Object.assign(this, data);
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "x-studio": "1", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Can't reach the Studio server. Is it running?", 0, {});
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") {
    window.dispatchEvent(new Event("studio:signedout"));
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: "POST", body });
export const patch = (p, body = {}) => api(p, { method: "PATCH", body });
export const del = (p) => api(p, { method: "DELETE" });
