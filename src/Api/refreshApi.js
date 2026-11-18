
import axios from "axios";

import {
  getRefreshToken,
  getSessionId,
  isSessionValid,
  getTokenExpiry,
  updateAccessToken,
  updateRefreshToken,
} from "./session.js";

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

let refreshPromise = null;

export const refreshAccessToken = async () => {
  const sessionId = getSessionId();

  if (!isSessionValid()) {
    throw new Error("Session expired");
  }

  // Reuse an existing refresh request
  if (refreshPromise?.sessionId === sessionId) {
    return refreshPromise.promise;
  }

  const entry = {
    sessionId,
    promise: null,
  };

  entry.promise = (async () => {
    try {
      const { data } = await refreshClient.post(
        import.meta.env.VITE_AUTH_REFRESH_PATH,
        {
          refreshToken: getRefreshToken(),
        }
      );

      if (getSessionId() !== sessionId) {
        throw new axios.CanceledError(
          "Session changed"
        );
      }

      if (!data.accessToken) {
        throw new Error("Access token missing");
      }

      if (
        data.refreshToken &&
        getTokenExpiry(data.refreshToken) <= Date.now()
      ) {
        throw new Error("Invalid refresh token");
      }

      updateAccessToken(data.accessToken);

      if (data.refreshToken) {
        updateRefreshToken(data.refreshToken);
      }

      return data.accessToken;
    } finally {
      if (refreshPromise === entry) {
        refreshPromise = null;
      }
    }
  })();

  refreshPromise = entry;

  return entry.promise;
};
