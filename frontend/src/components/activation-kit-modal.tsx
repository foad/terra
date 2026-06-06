import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Printer } from "lucide-react";
import styles from "./activation-kit-modal.module.css";

interface CrisisEvent {
  id: string;
  name: string;
  crisis_type: string;
}

interface Props {
  crisis: CrisisEvent;
  onClose: () => void;
}

const LANGUAGES = ["EN", "ES", "FR", "AR", "RU", "ZH"] as const;
type Lang = (typeof LANGUAGES)[number];

const LANG_LABELS: Record<Lang, string> = {
  EN: "English",
  ES: "Español",
  FR: "Français",
  AR: "العربية",
  RU: "Русский",
  ZH: "中文",
};

function whatsappTemplate(name: string, url: string): Record<Lang, string> {
  return {
    EN: `🚨 *${name}*\n\nWe need your help. Can you share what you're seeing near you? It takes less than 2 minutes and helps emergency teams reach the right places first.\n\nTake a photo and submit here:\n${url}\n\nEvery report makes a difference. Thank you.`,
    ES: `🚨 *${name}*\n\nNecesitamos tu ayuda. ¿Puedes compartir lo que estás viendo cerca de ti? Toma menos de 2 minutos y ayuda a los equipos de emergencia a llegar primero a los lugares correctos.\n\nToma una foto y envíala aquí:\n${url}\n\nCada informe marca la diferencia. Gracias.`,
    FR: `🚨 *${name}*\n\nNous avons besoin de votre aide. Pouvez-vous nous dire ce que vous voyez près de chez vous ? Cela prend moins de 2 minutes et aide les équipes d'urgence à se rendre là où c'est le plus nécessaire.\n\nPrenez une photo et signalez ici :\n${url}\n\nChaque signalement compte. Merci.`,
    AR: `🚨 *${name}*\n\nنحتاج إلى مساعدتك. هل يمكنك مشاركة ما تراه بالقرب منك؟ يستغرق الأمر أقل من دقيقتين ويساعد فرق الطوارئ على الوصول إلى الأماكن الصحيحة أولاً.\n\nالتقط صورة وأرسل تقريرك هنا:\n${url}\n\nكل تقرير يُحدث فرقاً. شكراً لك.`,
    RU: `🚨 *${name}*\n\nНам нужна ваша помощь. Можете рассказать, что происходит рядом с вами? Это займёт менее 2 минут и поможет экстренным службам прибыть туда, где это нужнее всего.\n\nСфотографируйте и отправьте здесь:\n${url}\n\nКаждый отчёт важен. Спасибо.`,
    ZH: `🚨 *${name}*\n\n我们需要您的帮助。您能分享一下您附近看到的情况吗？只需不到2分钟，就能帮助救援队第一时间到达最需要的地方。\n\n拍一张照片，在此提交：\n${url}\n\n每一份报告都很重要。谢谢您。`,
  };
}

const POSTER_INSTRUCTIONS: Record<Lang, string> = {
  EN: "Scan to report damage in your area",
  ES: "Escanee para reportar daños en su área",
  FR: "Scannez pour signaler des dommages dans votre zone",
  AR: "امسح لإبلاغ عن الأضرار في منطقتك",
  RU: "Сканируйте, чтобы сообщить об ущербе",
  ZH: "扫描以报告您所在地区的损坏情况",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className={styles.copyButton} onClick={handle}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ActivationKitModal({ crisis, onClose }: Props) {
  const url = window.location.origin;
  const templates = whatsappTemplate(crisis.name, url);
  const [activeLang, setActiveLang] = useState<Lang>("EN");
  const qrRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const svgEl = qrRef.current?.querySelector("svg");
    const svgString = svgEl ? svgEl.outerHTML : "";

    const instructions = Object.entries(POSTER_INSTRUCTIONS)
      .map(([, text]) => `<p>${text}</p>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>TERRA — ${crisis.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #fff;
    color: #111;
    padding: 48px 56px;
  }
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #0468b1;
    padding-bottom: 16px;
    margin-bottom: 28px;
  }
  .terra-name {
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #0468b1;
  }
  .undp-label {
    font-size: 0.75rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .crisis-name {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .crisis-type {
    font-size: 0.9rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 36px;
  }
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 auto 32px;
    width: fit-content;
  }
  .qr-section svg {
    display: block;
    width: 200px !important;
    height: 200px !important;
  }
  .instructions {
    margin-top: 16px;
    text-align: center;
    font-size: 0.8rem;
    color: #444;
    line-height: 1.6;
  }
  .url-box {
    margin-top: 24px;
    border: 1px solid #ccc;
    padding: 10px 16px;
    font-size: 0.85rem;
    color: #333;
    text-align: center;
    word-break: break-all;
  }
  .footer {
    margin-top: 48px;
    border-top: 1px solid #ddd;
    padding-top: 14px;
    font-size: 0.7rem;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="top-bar">
    <span class="terra-name">TERRA</span>
    <span class="undp-label">Crisis Damage Assessment · UNDP RAPIDA</span>
  </div>
  <div class="crisis-name">${crisis.name}</div>
  <div class="crisis-type">${crisis.crisis_type}</div>
  <div class="qr-section">
    ${svgString}
    <div class="instructions">${instructions}</div>
  </div>
  <div class="url-box">${url}</div>
  <div class="footer">Generated by TERRA · Tool for Early Reporting and Rapid Assessment</div>
  <script>window.addEventListener('load', function() { window.print(); });<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Community Activation Kit</h2>
            <p className={styles.modalSubtitle}>
              {crisis.name} · {crisis.crisis_type}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>QR Code</div>
          <div className={styles.qrWrap} ref={qrRef}>
            <QRCodeSVG value={url} size={160} />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Shareable link</div>
          <div className={styles.urlRow}>
            <span className={styles.urlText}>{url}</span>
            <CopyButton text={url} />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>WhatsApp / SMS template</div>
          <div className={styles.langTabs}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`${styles.langTab} ${activeLang === lang ? styles.langTabActive : ""}`}
                onClick={() => setActiveLang(lang)}
              >
                {LANG_LABELS[lang]}
              </button>
            ))}
          </div>
          <div className={styles.templateBox}>
            <pre className={styles.templateText}>{templates[activeLang]}</pre>
            <CopyButton text={templates[activeLang]} />
          </div>
        </div>

        <div className={styles.printRow}>
          <button
            type="button"
            className={styles.printButton}
            onClick={handlePrint}
          >
            <Printer size={16} />
            Print deployment poster
          </button>
        </div>
      </div>
    </div>
  );
}
