import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router";
import styles from "./login.module.css";

interface LoginPageProps {
  mode: "signin" | "signout";
}

const LoginPage = ({ mode }: LoginPageProps) => {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    auth.clearStaleState();
  }, []);

  useEffect(() => {
    if (mode === "signin" && auth.isAuthenticated) {
      navigate("/dashboard", { replace: true });
    } else if (mode === "signout" && !auth.isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [mode, auth.isAuthenticated]);

  const email = (auth.user?.profile?.email as string | undefined) ?? null;

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <h1 className={styles.brandTitle}>TERRA</h1>
        <div className={styles.brandSubtitle}>
          Tool for Early Reporting and Rapid Assessment
        </div>
      </div>
      <div className={styles.card}>
        {mode === "signin" ? (
          <>
            <h2 className={styles.cardTitle}>Analyst sign-in</h2>
            <p className={styles.cardBody}>
              Sign in with your TERRA analyst account to view the dashboard and
              manage crisis events.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => auth.signinRedirect()}
              >
                Sign in
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle}>Sign out of TERRA?</h2>
            <p className={styles.cardBody}>
              {email ? (
                <>
                  You are signed in as{" "}
                  <span className={styles.email}>{email}</span>.
                </>
              ) : (
                "You will be signed out of the current session."
              )}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={async () => {
                  // Cognito's OIDC end_session_endpoint targets /login on this
                  // pool which returns 400. Use Cognito's native logout flow
                  // directly: /logout?client_id=X&logout_uri=Y.
                  await auth.removeUser();
                  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
                  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
                  const logoutUri = window.location.origin + "/login";
                  window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
                }}
              >
                Sign out
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
