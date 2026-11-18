
import { jwtDecode } from "jwt-decode";

export const getAccessToken = () =>
  localStorage.getItem("token");

export const getRefreshToken = () =>
  localStorage.getItem("refreshToken");

export const getSessionId = () =>
  localStorage.getItem("sessionId");

// TOKEN EXPIRY
export const getTokenExpiry = (token) => {
  if (!token) return 0;

  try {
    return (jwtDecode(token).exp || 0) * 1000;
  } catch {
    return 0;
  }
};

export const getRefreshTokenExpiry = () =>
  getTokenExpiry(getRefreshToken());

export const isSessionValid = () =>
  Boolean(getSessionId()) &&
  getRefreshTokenExpiry() > Date.now();

export const getRemainingSessionTime = () =>
  Math.max(
    0,
    getRefreshTokenExpiry() - Date.now()
  );

export const isAccessTokenExpired = () =>
  getTokenExpiry(getAccessToken()) <=
  Date.now() + 10000;

// START NEW LOGIN SESSION
export const saveSession = (data) => {
  if (
    !data.accessToken ||
    !data.refreshToken ||
    getTokenExpiry(data.refreshToken) <= Date.now()
  ) {
    throw new Error("Invalid authentication response");
  }

  localStorage.setItem(
    "sessionId",
    crypto.randomUUID()
  );

  localStorage.setItem("token", data.accessToken);

  localStorage.setItem(
    "refreshToken",
    data.refreshToken
  );

  localStorage.setItem(
    "user",
    JSON.stringify(data.user ?? null)
  );

  localStorage.setItem("adminAuth", "true");

  window.dispatchEvent(new Event("session-change"));
};

// UPDATE ACCESS TOKEN
export const updateAccessToken = (token) => {
  localStorage.setItem("token", token);
};

// UPDATE REFRESH TOKEN
export const updateRefreshToken = (token) => {
  localStorage.setItem("refreshToken", token);

  window.dispatchEvent(new Event("session-change"));
};

// REMOVE SESSION
export const removeSession = () => {
  [
    "token",
    "refreshToken",
    "user",
    "adminAuth",
    "sessionId",
  ].forEach((key) => {
    localStorage.removeItem(key);
  });

  window.dispatchEvent(new Event("session-change"));
};
