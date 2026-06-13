import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router";
import styles from "./app-bar.module.css";

interface AppBarProps {
  subtitle: string;
}

export const AppBar = ({ subtitle }: AppBarProps) => {
  const auth = useAuth();
  const navigate = useNavigate();
  const email =
    (auth.user?.profile?.email as string | undefined) ??
    (auth.user?.profile?.["cognito:username"] as string | undefined) ??
    null;

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <h1 className={styles.title}>TERRA</h1>
        <span className={styles.subtitle}>{subtitle}</span>
        {email && (
          <span className={styles.userArea}>
            <span className={styles.email}>{email}</span>
            <button
              type="button"
              className={styles.signOut}
              onClick={() => navigate("/logout")}
            >
              Sign out
            </button>
          </span>
        )}
      </div>
    </header>
  );
};
