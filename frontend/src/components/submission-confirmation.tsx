import { CircleCheck, CloudOff, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./submission-confirmation.module.css";

interface SubmissionConfirmationProps {
  isOnline: boolean;
  onSubmitAnother: () => void;
  crisisName?: string;
}

export const SubmissionConfirmation = ({
  isOnline,
  onSubmitAnother,
  crisisName,
}: SubmissionConfirmationProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.origin;
  const shareText = crisisName
    ? t("confirmation.shareMessageWithCrisis", { crisisName, url: shareUrl })
    : t("confirmation.shareMessageGeneric", { url: shareUrl });

  const handleNativeShare = async () => {
    try {
      await navigator.share({ text: shareText, url: shareUrl });
    } catch {
      // User dismissed share sheet — no action needed
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silent fail
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const canNativeShare = typeof navigator.share === "function";

  return (
    <div className={styles.container}>
      {isOnline ? (
        <CircleCheck size={56} className={styles.icon} />
      ) : (
        <CloudOff size={56} className={styles.iconQueued} />
      )}
      <h2 className={styles.title}>
        {isOnline ? t("confirmation.submitted") : t("confirmation.queued")}
      </h2>
      <p className={styles.message}>
        {isOnline
          ? t("confirmation.submittedMessage")
          : t("confirmation.queuedMessage")}
      </p>

      <div className={styles.shareSection}>
        <p className={styles.shareHeading}>{t("confirmation.shareHeading")}</p>
        <p className={styles.shareBody}>{t("confirmation.shareBody")}</p>
        {canNativeShare ? (
          <button
            className="button button-secondary button-without-arrow"
            onClick={handleNativeShare}
          >
            <Share2 size={16} />
            {t("confirmation.shareButton")}
          </button>
        ) : (
          <div className={styles.shareButtons}>
            <button
              className="button button-secondary button-without-arrow"
              onClick={handleCopyLink}
            >
              <Copy size={16} />
              {copied ? t("confirmation.linkCopied") : t("confirmation.copyLink")}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary button-without-arrow"
            >
              <Share2 size={16} />
              {t("confirmation.shareWhatsApp")}
            </a>
          </div>
        )}
      </div>

      <a
        role="button"
        className="button button-primary button-without-arrow"
        onClick={onSubmitAnother}
      >
        {t("confirmation.submitAnother")}
      </a>
    </div>
  );
};
