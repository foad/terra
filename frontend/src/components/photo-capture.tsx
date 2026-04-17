import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera } from "lucide-react";
import { api } from "../utils/api";
import styles from "./photo-capture.module.css";

export interface PhotoResult {
  photoKey: string;
  previewUrl: string;
}

interface PhotoCaptureProps {
  onPhotoUploaded: (result: PhotoResult) => void;
}

type UploadState = "idle" | "compressing" | "uploading" | "done" | "error";

export const PhotoCapture = ({ onPhotoUploaded }: PhotoCaptureProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    try {
      // Preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Compress
      setState("compressing");
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });

      // Get presigned URL
      setState("uploading");
      setProgress(0);
      const { photo_key, upload_url } = await api("/photos/upload", {
        method: "POST",
      });

      // Upload to S3
      await uploadWithProgress(upload_url, compressed, (pct) => {
        setProgress(pct);
      });

      setState("done");
      onPhotoUploaded({ photoKey: photo_key, previewUrl: preview });
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
          <div className={styles.captureLabel}>Upload a photo</div>
          <div className={styles.captureHint}>
            Take a photo of the damaged infrastructure or choose an existing one
          </div>
          <div className={styles.captureButtons}>
            <a
              role="button"
              className="button button-primary button-without-arrow"
              onClick={() => fileInputRef.current?.click()}
            >
              Take Photo
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
              Choose from Gallery
            </a>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className={styles.preview}>
          <img src={previewUrl} alt="Captured photo" className={styles.previewImage} />
        </div>
      )}

      {state === "compressing" && (
        <div className={styles.status}>Compressing image...</div>
      )}

      {state === "uploading" && (
        <div className={styles.status}>
          <div className={styles.progressLabel}>Uploading... {Math.round(progress)}%</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {state === "done" && (
        <div className={styles.status}>Photo uploaded</div>
      )}

      {state === "error" && (
        <div className={styles.error}>
          <div className={styles.errorMessage}>{errorMessage}</div>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={handleRetry}
          >
            Retry
          </a>
        </div>
      )}
    </div>
  );
};

const uploadWithProgress = (
  url: string,
  file: Blob,
  onProgress: (pct: number) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "image/jpeg");

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
