import http from "k6/http";
import { check } from "k6";

function encodeQuery(query) {
  if (!query) return "";

  const segments = [];
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== "") {
          segments.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`);
        }
      });
      return;
    }

    segments.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });

  return segments.length > 0 ? `?${segments.join("&")}` : "";
}

export function buildUrl(config, path, query) {
  if (/^https?:\/\//.test(path)) {
    return `${path}${encodeQuery(query)}`;
  }

  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.baseUrl}${normalisedPath}${encodeQuery(query)}`;
}

export function request(config, method, path, body = null, options = {}) {
  const route = options.route || path;
  const routeGroup = options.routeGroup || "uncategorised";
  const tags = {
    route,
    route_group: routeGroup,
    stage: config.stage,
    ...options.tags,
  };
  const headers = {
    "User-Agent": config.userAgent,
    Accept: options.accept || "application/json",
    ...options.headers,
  };

  const params = {
    headers,
    tags,
    redirects: options.redirects === undefined ? 5 : options.redirects,
    timeout: options.timeout || "30s",
  };

  const response = http.request(method, buildUrl(config, path, options.query), body, params);
  expectStatus(response, options.expectedStatuses || [200], route);
  return response;
}

export function getJson(config, path, options = {}) {
  return request(config, "GET", path, null, {
    ...options,
    headers: {
      ...options.headers,
      Accept: "application/json",
    },
  });
}

export function getHtml(config, path, options = {}) {
  return request(config, "GET", path, null, {
    ...options,
    accept: "text/html,application/xhtml+xml",
    routeGroup: options.routeGroup || "public",
  });
}

export function postJson(config, path, payload, options = {}) {
  return request(config, "POST", path, JSON.stringify(payload), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export function putJson(config, path, payload, options = {}) {
  return request(config, "PUT", path, JSON.stringify(payload), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export function deleteRequest(config, path, options = {}) {
  return request(config, "DELETE", path, null, options);
}

export function rawPost(config, path, body, options = {}) {
  return request(config, "POST", path, body, options);
}

export function safeJson(response, fallback = null) {
  if (!response || !response.body) return fallback;
  try {
    return response.json();
  } catch (error) {
    console.warn(`Unable to parse JSON from ${response.url}: ${error}`);
    return fallback;
  }
}

export function expectStatus(response, expectedStatuses, label) {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  check(response, {
    [`${label} returned ${expected.join("/")}`]: (result) => expected.includes(result.status),
  });
}

export function expectJsonArray(response, label) {
  check(response, {
    [`${label} returned an array`]: (result) => Array.isArray(safeJson(result, null)),
  });
}

export function expectJsonObject(response, label) {
  check(response, {
    [`${label} returned an object`]: (result) => {
      const parsed = safeJson(result, null);
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    },
  });
}
