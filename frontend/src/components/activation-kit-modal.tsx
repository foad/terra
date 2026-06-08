import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Printer } from "lucide-react";
import { ICON_SCAN, ICON_CAMERA, ICON_SUBMIT, getCrisisIcon } from "../assets/poster-icons";
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (HTTP context or permissions denied)
    }
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
    const crisisIconSvg = getCrisisIcon(crisis.crisis_type);

    const instructions = Object.entries(POSTER_INSTRUCTIONS)
      .map(([, text]) => `<p class="instruction">${text}</p>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>TERRA — ${escapeHtml(crisis.name)}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: #fff; color: #111827; }

  .header { background: #0468b1; padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
  .terra-logo { font-size: 26px; font-weight: 900; letter-spacing: 0.1em; color: #fff; }
  .terra-sub { font-size: 9px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }

  .crisis-section { padding: 22px 40px 18px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 14px; }
  .crisis-icon { width: 32px; height: 32px; color: #0468b1; flex-shrink: 0; }
  .crisis-icon svg { width: 100%; height: 100%; display: block; }
  .crisis-name { font-size: 26px; font-weight: 700; color: #111827; letter-spacing: -0.01em; line-height: 1.2; }
  .crisis-type-label { font-size: 11px; font-weight: 600; color: #0468b1; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 3px; }

  .steps-section { padding: 20px 40px; border-bottom: 1px solid #e5e7eb; }
  .steps-heading { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; margin-bottom: 16px; }
  .steps-row { display: flex; align-items: center; }
  .step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .step-icon { width: 44px; height: 44px; color: #0468b1; }
  .step-icon svg { width: 100%; height: 100%; display: block; }
  .step-num { width: 20px; height: 20px; background: #0468b1; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .step-label { font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.06em; }
  .step-arrow { color: #d1d5db; font-size: 22px; font-weight: 200; padding: 0 4px; padding-bottom: 24px; }

  .qr-section { padding: 28px 40px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; border-bottom: 1px solid #e5e7eb; }
  .qr-frame { padding: 12px; border: 1.5px solid #e5e7eb; display: inline-block; }
  .qr-frame svg { display: block; width: 180px !important; height: 180px !important; }
  .instructions { text-align: center; }
  .instruction { font-size: 11px; color: #6b7280; line-height: 1.6; }

  .url-section { padding: 16px 40px 20px; }
  .url-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 9px 16px; text-align: center; font-family: "Courier New", monospace; font-size: 12px; color: #374151; letter-spacing: 0.02em; word-break: break-all; }

  .footer { padding: 12px 40px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="terra-logo">TERRA</div>
      <div class="terra-sub">RAPIDA · Crisis Damage Assessment</div>
    </div>
  </div>

  <div class="crisis-section">
    <div class="crisis-icon">${crisisIconSvg}</div>
    <div>
      <div class="crisis-name">${escapeHtml(crisis.name)}</div>
      <div class="crisis-type-label">${escapeHtml(crisis.crisis_type)}</div>
    </div>
  </div>

  <div class="steps-section">
    <div class="steps-heading">How to submit a report</div>
    <div class="steps-row">
      <div class="step">
        <div class="step-icon">${ICON_SCAN}</div>
        <div class="step-num">1</div>
        <div class="step-label">Scan</div>
      </div>
      <div class="step-arrow">&#8594;</div>
      <div class="step">
        <div class="step-icon">${ICON_CAMERA}</div>
        <div class="step-num">2</div>
        <div class="step-label">Photograph</div>
      </div>
      <div class="step-arrow">&#8594;</div>
      <div class="step">
        <div class="step-icon">${ICON_SUBMIT}</div>
        <div class="step-num">3</div>
        <div class="step-label">Submit</div>
      </div>
    </div>
  </div>

  <div class="qr-section">
    <div class="qr-frame">${svgString}</div>
    <div class="instructions">${instructions}</div>
  </div>

  <div class="url-section">
    <div class="url-box">${url}</div>
  </div>

  <div class="footer">
    <span class="footer-text">TERRA · Tool for Early Reporting and Rapid Assessment</span>
    <span class="footer-text">Field deployment material · UNDP RAPIDA</span>
  </div>

  <script>window.addEventListener('load', function() { window.print(); });</script>
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
