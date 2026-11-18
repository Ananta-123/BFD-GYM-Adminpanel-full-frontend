
import api, { clearApiCache } from "./axios.js";

import {
  saveSession,
  removeSession,
  getRefreshToken,
} from "./session.js";

// LOGIN
export const loginAdmin = async (loginData) => {
  const { data } = await api.post(
    "/auth/login",
    loginData,
    {
      cache: false,
    }
  );

  await clearApiCache();

  saveSession(data);

  return data;
};

// LOGOUT
export const logoutAdmin = async () => {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await api.post(
        "/auth/logout",
        {
          refreshToken,
        },
        {
          cache: false,
        }
      );
    }
  } finally {
    removeSession();

    await clearApiCache();
  }
};
