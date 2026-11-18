
import { useEffect, useState } from "react";

import { Navigate } from "react-router-dom";

import {
  isSessionValid,
  getRemainingSessionTime,
  getSessionId,
  removeSession,
} from "../Api/session.js";

import { clearApiCache } from "../Api/axios.js";

const ProtectedRoute = ({ children }) => {
  const [valid, setValid] = useState(
    isSessionValid
  );

  useEffect(() => {
    let timer;

    const initialSessionId = getSessionId();

    const checkSession = () => {
      clearTimeout(timer);

      // Another tab changed the active account
      if (initialSessionId !== getSessionId()) {
        setValid(false);
        window.location.reload();
        return;
      }

      if (!isSessionValid()) {
        setValid(false);

        // Remove the listener before dispatching
        // another session-change event
        window.removeEventListener(
          "session-change",
          checkSession
        );

        removeSession();
        void clearApiCache();

        return;
      }

      setValid(true);

      timer = setTimeout(
        checkSession,
        Math.min(
          getRemainingSessionTime(),
          2147483647
        )
      );
    };

    window.addEventListener(
      "storage",
      checkSession
    );

    window.addEventListener(
      "session-change",
      checkSession
    );

    document.addEventListener(
      "visibilitychange",
      checkSession
    );

    checkSession();

    return () => {
      clearTimeout(timer);

      window.removeEventListener(
        "storage",
        checkSession
      );

      window.removeEventListener(
        "session-change",
        checkSession
      );

      document.removeEventListener(
        "visibilitychange",
        checkSession
      );
    };
  }, []);

  if (!valid || !isSessionValid()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
