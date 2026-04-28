import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { api } from "../utils/api";
import styles from "./photo-capture.module.css";

const MAX_DIMENSION = 2048;
const MAX_SIZE_BYTES = 1_048_576;
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

export interface PhotoResult {
  photoKey: string | null;
  previewUrl: string;
  blob: Blob;
}

interface PhotoCaptureProps {
  onPhotoUploaded: (result: PhotoResult) => void;
  onPhotoCleared?: () => void;
  existingPhoto?: PhotoResult | null;
}

type UploadState = "idle" | "compressing" | "uploading" | "done" | "saved" | "error";

export const PhotoCapture = ({ onPhotoUploaded, onPhotoCleared, existingPhoto }: PhotoCaptureProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(() =>
    existingPhoto ? (existingPhoto.photoKey ? "done" : "saved") : "idle",
  );
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPhoto?.previewUrl ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    try {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      setState("compressing");
      const compressed = await compressImage(file);

      let photoKey: string | null = null;

      if (navigator.onLine) {
        try {
          setState("uploading");
          setProgress(0);
          const contentType = compressed.type || "image/jpeg";
          const { photo_key, upload_url } = await api("/photos/upload", {
            method: "POST",
            body: JSON.stringify({ content_type: contentType }),
          });

          await uploadWithProgress(upload_url, compressed, (pct) => {
            setProgress(pct);
          });

          photoKey = photo_key;
        } catch {
          photoKey = null;
        }
      }

      setState(photoKey ? "done" : "saved");
      onPhotoUploaded({ photoKey, previewUrl: preview, blob: compressed });
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRetry = () => {
    setState("idle");
    setPreviewUrl(null);
    setErrorMessage(null);
    setProgress(0);
  };

  const handleReplace = () => {
    setState("idle");
    setPreviewUrl(null);
    setErrorMessage(null);
    setProgress(0);
    onPhotoCleared?.();
  };

  return (
    <div className={styles.container}>
      {state === "idle" && (
        <div className={styles.capture}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.hiddenInput}
            onChange={handleInputChange}
          />
          <Camera size={48} className={styles.captureIcon} />
          <div className={styles.captureLabel}>{t("photo.uploadLabel")}</div>
          <div className={styles.captureHint}>{t("photo.uploadHint")}</div>
          <div className={styles.captureButtons}>
            <a
              role="button"
              className="button button-primary button-without-arrow"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("photo.takePhoto")}
            </a>
            <a
              role="button"
              className="button button-secondary button-without-arrow"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                  fileInputRef.current.setAttribute("capture", "environment");
                }
              }}
            >
              {t("photo.chooseGallery")}
            </a>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className={styles.preview}>
          <img src={previewUrl} alt="" className={styles.previewImage} />
        </div>
      )}

      {state === "compressing" && (
        <div className={styles.status}>{t("photo.compressing")}</div>
      )}

      {state === "uploading" && (
        <div className={styles.status}>
          <div className={styles.progressLabel}>
            {t("photo.uploading", { progress: Math.round(progress) })}
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {(state === "done" || state === "saved") && (
        <div className={styles.status}>
          <span data-testid="photo-uploaded">
            {state === "done" ? t("photo.uploaded") : t("photo.saved")}
          </span>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={handleReplace}
          >
            {t("photo.replace")}
          </a>
        </div>
      )}

      {state === "error" && (
        <div className={styles.error}>
          <div className={styles.errorMessage}>{errorMessage}</div>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={handleRetry}
          >
            {t("photo.retry")}
          </a>
        </div>
      )}
    </div>
  );
};

const compressImage = async (file: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let lastBlob: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) throw new Error("Image encoding failed");
      lastBlob = blob;
      if (blob.size <= MAX_SIZE_BYTES) return blob;
    }
    return lastBlob!;
  } finally {
    bitmap.close();
  }
};

const uploadWithProgress = (
  url: string,
  file: Blob,
  onProgress: (pct: number) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.send(file);
  });
};
