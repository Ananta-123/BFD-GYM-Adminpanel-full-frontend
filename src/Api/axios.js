
import axios from "axios";

import {
  setupCache,
  buildMemoryStorage,
  defaultKeyGenerator,
} from "axios-cache-interceptor";

import {
  getAccessToken,
  getSessionId,
  isSessionValid,
  removeSession,
} from "./session.js";

import { refreshAccessToken } from "./refreshApi.js";

import {
  getCacheGroup,
  getCacheTTL,
  cacheDependencies,
} from "./cacheConfig.js";

// CREATE AXIOS INSTANCE
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

// CACHE GENERATIONS
let cacheEpoch = 0;

const groupVersions = new Map();

const getGroupVersion = (group) =>
  groupVersions.get(group) || 0;

// SETUP CACHE
const api = setupCache(instance, {
  storage: buildMemoryStorage(
    "double",
    60000,
    500
  ),

  methods: ["get"],

  interpretHeader: false,

  staleIfError: false,

  cachePredicate: {
    statusCheck: (status) => status === 200,
  },

  generateKey: (config) => {
    const group = getCacheGroup(config.url);

    return [
      config.sessionScope || "anonymous",
      cacheEpoch,
      group,
      getGroupVersion(group),
      defaultKeyGenerator(config),
    ].join(":");
  },
});

// CLEAR ENTIRE CACHE
export const clearApiCache = async () => {
  cacheEpoch += 1;

  groupVersions.clear();

  await api.storage.clear();
};

// SELECTIVE CACHE INVALIDATION
export const invalidateCache = (url) => {
  const group = getCacheGroup(url);

  const affectedGroups =
    cacheDependencies[group] || [group];

  affectedGroups.forEach((name) => {
    groupVersions.set(
      name,
      getGroupVersion(name) + 1
    );
  });
};

// END SESSION
export const expireSession = async () => {
  removeSession();

  await clearApiCache();

  window.location.replace("/login");
};

const isAuthRequest = (url = "") =>
  url.startsWith("/auth/");

// REQUEST INTERCEPTOR
api.interceptors.request.use(async (config) => {
  const authRequest = isAuthRequest(config.url);

  const sessionId = getSessionId();

  if (!authRequest && !isSessionValid()) {
    await expireSession();

    throw new axios.CanceledError(
      "Session expired"
    );
  }

  config.sessionScope = sessionId;

  const token = getAccessToken();

  if (token && config.url !== "/auth/login") {
    config.headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  // Cache only eligible GET requests
  const cacheAllowed =
    config.method?.toLowerCase() === "get" &&
    !authRequest &&
    config.responseType !== "blob" &&
    config.responseType !== "arraybuffer" &&
    config.cache !== false;

  if (cacheAllowed) {
    config.cache = {
      ...config.cache,
      ttl: () => getCacheTTL(config.url),
    };
  } else {
    config.cache = false;
  }

  // FORM DATA
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    const { config } = response;

    const authRequest = isAuthRequest(config.url);

    // Reject responses from expired/old sessions
    if (
      !authRequest &&
      (
        config.sessionScope !== getSessionId() ||
        !isSessionValid()
      )
    ) {
      throw new axios.CanceledError(
        "Response belongs to an inactive session"
      );
    }

    const method = config.method?.toLowerCase();

    // Selective invalidation after successful mutation
    if (
      !authRequest &&
      ["post", "put", "patch", "delete"].includes(method)
    ) {
      invalidateCache(config.url);
    }

    // DEVELOPMENT LOGGING
    if (import.meta.env.DEV && method === "get") {
      console.log(
        response.cached ? "[CACHE HIT]" : "[API REQUEST]",
        config.url
      );
    }

    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    const status = error.response?.status;

    // AUTOMATIC TOKEN REFRESH
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest(originalRequest.url) &&
      originalRequest.sessionScope === getSessionId()
    ) {
      originalRequest._retry = true;

      try {
        // Another request may have refreshed already
        const currentToken = getAccessToken();

        const sentToken =
          originalRequest.headers?.get("Authorization");

        if (
          currentToken &&
          sentToken !== `Bearer ${currentToken}`
        ) {
          originalRequest.headers.set(
            "Authorization",
            `Bearer ${currentToken}`
          );
        } else {
          const newToken = await refreshAccessToken();

          originalRequest.headers.set(
            "Authorization",
            `Bearer ${newToken}`
          );
        }

        // Prevent retrying within a different login
        if (
          originalRequest.sessionScope !== getSessionId()
        ) {
          throw new axios.CanceledError(
            "Session changed"
          );
        }

        delete originalRequest.id;

        return api(originalRequest);

      } catch (refreshError) {
        const refreshStatus =
          refreshError.response?.status;

        if (
          originalRequest.sessionScope === getSessionId() &&
          (
            !isSessionValid() ||
            [401, 403].includes(refreshStatus)
          )
        ) {
          await expireSession();
        }

        return Promise.reject(refreshError);
      }
    }

    // RATE LIMIT
    if (status === 429) {
      console.warn(
        "API rate limit reached.",
        error.response?.headers?.["retry-after"]
      );
    }

    // SERVER ERROR
    if (status >= 500) {
      console.warn("Server temporarily unavailable.");
    }

    if (!error.response && !axios.isCancel(error)) {
      console.warn("Network request failed.");
    }

    return Promise.reject(error);
  }
);

export default api;
