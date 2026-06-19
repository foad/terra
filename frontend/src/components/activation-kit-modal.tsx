import { useEffect, useId, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Printer } from "lucide-react";
import styles from "./activation-kit-modal.module.css";

interface Props {
  name: string;
  crisisType: string;
  crisisId: string;
  onClose: () => void;
}

const LANGUAGES = ["EN", "ES", "FR", "AR", "RU", "ZH", "TR"] as const;
type Lang = (typeof LANGUAGES)[number];

const LANG_LABELS: Record<Lang, string> = {
  EN: "English",
  ES: "Español",
  FR: "Français",
  AR: "العربية",
  RU: "Русский",
  ZH: "中文",
  TR: "Türkçe",
};

const LANG_META: Record<Lang, { bcp47: string; dir: "ltr" | "rtl" }> = {
  EN: { bcp47: "en", dir: "ltr" },
  ES: { bcp47: "es", dir: "ltr" },
  FR: { bcp47: "fr", dir: "ltr" },
  AR: { bcp47: "ar", dir: "rtl" },
  RU: { bcp47: "ru", dir: "ltr" },
  ZH: { bcp47: "zh", dir: "ltr" },
  TR: { bcp47: "tr", dir: "ltr" },
};

function whatsappTemplate(
  name: string,
  linkFor: (lang: Lang) => string,
): Record<Lang, string> {
  return {
    EN: `🚨 *${name}*\n\nWe need your help. Can you share what you're seeing near you? It takes less than 2 minutes and helps emergency teams reach the right places first.\n\nTake a photo and submit here:\n${linkFor("EN")}\n\nEvery report makes a difference. Thank you.`,
    ES: `🚨 *${name}*\n\nNecesitamos tu ayuda. ¿Puedes compartir lo que estás viendo cerca de ti? Toma menos de 2 minutos y ayuda a los equipos de emergencia a llegar primero a los lugares correctos.\n\nToma una foto y envíala aquí:\n${linkFor("ES")}\n\nCada informe marca la diferencia. Gracias.`,
    FR: `🚨 *${name}*\n\nNous avons besoin de votre aide. Pouvez-vous nous dire ce que vous voyez près de chez vous ? Cela prend moins de 2 minutes et aide les équipes d'urgence à se rendre là où c'est le plus nécessaire.\n\nPrenez une photo et signalez ici :\n${linkFor("FR")}\n\nChaque signalement compte. Merci.`,
    AR: `🚨 *${name}*\n\nنحتاج إلى مساعدتك. هل يمكنك مشاركة ما تراه بالقرب منك؟ يستغرق الأمر أقل من دقيقتين ويساعد فرق الطوارئ على الوصول إلى الأماكن الصحيحة أولاً.\n\nالتقط صورة وأرسل تقريرك هنا:\n${linkFor("AR")}\n\nكل تقرير يُحدث فرقاً. شكراً لك.`,
    RU: `🚨 *${name}*\n\nНам нужна ваша помощь. Можете рассказать, что происходит рядом с вами? Это займёт менее 2 минут и поможет экстренным службам прибыть туда, где это нужнее всего.\n\nСфотографируйте и отправьте здесь:\n${linkFor("RU")}\n\nКаждый отчёт важен. Спасибо.`,
    ZH: `🚨 *${name}*\n\n我们需要您的帮助。您能分享一下您附近看到的情况吗？只需不到2分钟，就能帮助救援队第一时间到达最需要的地方。\n\n拍一张照片，在此提交：\n${linkFor("ZH")}\n\n每一份报告都很重要。谢谢您。`,
    TR: `🚨 *${name}*\n\nYardımınıza ihtiyacımız var. Yakınınızda neler olduğunu paylaşabilir misiniz? 2 dakikadan az sürer ve acil ekiplerin doğru yerlere önce ulaşmasına yardımcı olur.\n\nBir fotoğraf çekin ve buradan gönderin:\n${linkFor("TR")}\n\nHer rapor bir fark yaratır. Teşekkür ederiz.`,
  };
}

const POSTER_INSTRUCTIONS: Record<Lang, string> = {
  EN: "Scan to report damage in your area",
  ES: "Escanee para reportar daños en su área",
  FR: "Scannez pour signaler des dommages dans votre zone",
  AR: "امسح لإبلاغ عن الأضرار في منطقتك",
  RU: "Сканируйте, чтобы сообщить об ущербе",
  ZH: "扫描以报告您所在地区的损坏情况",
  TR: "Bölgenizdeki hasarı bildirmek için tarayın",
};

// Coverage-ring + map-pin mark (echoes the #234 coverage-ring identity).
// Kept as inline SVG so the kit carries no external logo asset dependency,
// and we deliberately avoid the UN/UNDP emblem (protected; implies an
// endorsement we don't have) — see #252.
const PIN_PATH =
  "M32 14c-7.2 0-13 5.7-13 12.8 0 9.1 11.4 20.4 12.3 21.3a1 1 0 0 0 1.4 0c.9-.9 12.3-12.2 12.3-21.3C45 19.7 39.2 14 32 14z";

function TerraMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="29"
        stroke="#0468b1"
        strokeWidth="3"
        strokeDasharray="4 5"
        opacity="0.55"
      />
      <path d={PIN_PATH} fill="#0468b1" />
      <circle cx="32" cy="27" r="5" fill="#fff" />
    </svg>
  );
}

// White-on-blue variant of the mark for the poster's solid header band.
const MARK_SVG_LIGHT = `<svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="32" cy="32" r="29" stroke="#fff" stroke-width="3" stroke-dasharray="4 5" opacity="0.7"/><path d="${PIN_PATH}" fill="#fff"/><circle cx="32" cy="27" r="5" fill="#0468b1"/></svg>`;

// Trust signals + the three-step flow for the printed poster. English on the
// poster body; the multilingual scan line below carries all 7 languages.
const TRUST_ITEMS = [
  ["✓", "Free"],
  ["📲", "No app needed"],
  ["🕶️", "Anonymous"],
  ["✈️", "Works offline"],
];

const STEP_ITEMS = [
  [
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0468b1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="4"/></svg>`,
    "Take a photo of the damage",
  ],
  [
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0468b1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    "Pick the building on the map",
  ],
  [
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0468b1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    "Answer a few quick questions",
  ],
];

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

export function ActivationKitModal({
  name,
  crisisType,
  crisisId,
  onClose,
}: Props) {
  // Deterministic entry link (#228): the QR and shared links carry the crisis
  // id so they open straight onto this crisis zone regardless of where the
  // device is, and each language template presets its own UI language.
  const base = window.location.origin;
  const url = `${base}/?crisis=${crisisId}`;
  const linkFor = (lang: Lang) => `${url}&lng=${LANG_META[lang].bcp47}`;
  const templates = whatsappTemplate(name, linkFor);
  const [activeLang, setActiveLang] = useState<Lang>("EN");
  const [printBlocked, setPrintBlocked] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePrint = () => {
    const svgEl = qrRef.current?.querySelector("svg");
    const svgString = svgEl ? svgEl.outerHTML : "";

    const instructions = (Object.entries(POSTER_INSTRUCTIONS) as [Lang, string][])
      .map(([lang, text]) => {
        const { bcp47, dir } = LANG_META[lang];
        return `<span lang="${bcp47}" dir="${dir}">${escapeHtml(text)}</span>`;
      })
      .join("");

    const trust = TRUST_ITEMS.map(
      ([icon, label]) =>
        `<div><span>${icon}</span>${escapeHtml(label)}</div>`,
    ).join("");

    const steps = STEP_ITEMS.map(
      ([icon, label], i) =>
        `<div class="step"><div class="ico">${icon}</div><div class="n">STEP ${i + 1}</div><div class="t">${escapeHtml(label)}</div></div>`,
    ).join('<div class="step-arrow">&rarr;</div>');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>TERRA — ${escapeHtml(name)}</title>
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
    background: #0468b1;
    color: #fff;
    /* Bleed the band to the page edges over the body padding. */
    margin: -48px -56px 30px;
    padding: 26px 56px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand svg { display: block; flex: none; }
  .wordmark {
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.10em;
    color: #fff;
    line-height: 1;
  }
  .wordmark small {
    display: block;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: rgba(255, 255, 255, 0.82);
    margin-top: 4px;
  }
  .attribution {
    text-align: right;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .crisis-name {
    font-size: 1.75rem;
    font-weight: 800;
    margin-bottom: 4px;
  }
  .crisis-type {
    font-size: 0.9rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .trust {
    display: flex;
    margin: 24px 0 30px;
    border: 1px solid #e3e3e3;
    border-radius: 10px;
    overflow: hidden;
  }
  .trust div {
    flex: 1;
    text-align: center;
    padding: 12px 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #2c2c2c;
    border-right: 1px solid #e3e3e3;
  }
  .trust div:last-child { border-right: none; }
  .trust div span { display: block; font-size: 1.05rem; margin-bottom: 3px; }
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 auto;
    width: fit-content;
  }
  .qr-frame {
    border: 3px solid #0468b1;
    border-radius: 16px;
    padding: 14px;
  }
  .qr-frame svg {
    display: block;
    width: 200px !important;
    height: 200px !important;
  }
  .scan-cta {
    margin-top: 14px;
    font-size: 1.05rem;
    font-weight: 700;
    color: #111;
  }
  .steps {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 12px;
    margin: 30px auto 26px;
    max-width: 540px;
  }
  .step { flex: 1; text-align: center; }
  .step .ico {
    width: 54px;
    height: 54px;
    margin: 0 auto 10px;
    border-radius: 50%;
    background: #eef5fb;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .step .n {
    font-size: 0.7rem;
    font-weight: 700;
    color: #0468b1;
    letter-spacing: 0.08em;
  }
  .step .t { font-size: 0.82rem; color: #333; margin-top: 3px; line-height: 1.35; }
  .step-arrow { color: #bcd3e6; align-self: center; }
  .instructions {
    text-align: center;
    font-size: 0.78rem;
    color: #666;
    line-height: 1.9;
    border-top: 1px solid #e3e3e3;
    padding-top: 18px;
  }
  .instructions span { white-space: nowrap; }
  .instructions span::after { content: "  •  "; color: #ccc; }
  .instructions span:last-child::after { content: ""; }
  .url-box {
    margin: 18px auto 0;
    max-width: 440px;
    border: 1px dashed #bbb;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 0.85rem;
    color: #444;
    text-align: center;
    word-break: break-all;
  }
  .footer {
    margin-top: 32px;
    border-top: 1px solid #e3e3e3;
    padding-top: 14px;
    font-size: 0.7rem;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="top-bar">
    <div class="brand">
      ${MARK_SVG_LIGHT}
      <span class="wordmark">TERRA<small>Tool for Early Reporting &amp; Rapid Assessment</small></span>
    </div>
    <span class="attribution">Crisis damage<br/>assessment<br/>· Built for UNDP RAPIDA ·</span>
  </div>
  <div class="crisis-name">${escapeHtml(name)}</div>
  <div class="crisis-type">${escapeHtml(crisisType)}</div>
  <div class="trust">${trust}</div>
  <div class="qr-section">
    <div class="qr-frame">${svgString}</div>
    <div class="scan-cta">Scan to report damage near you</div>
  </div>
  <div class="steps">${steps}</div>
  <div class="instructions">${instructions}</div>
  <div class="url-box">${url}</div>
  <div class="footer">TERRA · Tool for Early Reporting and Rapid Assessment · Less than 2 minutes per report</div>
  <script>window.addEventListener('load', function() { window.print(); });</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setPrintBlocked(false);
    } else {
      setPrintBlocked(true);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.modalHeader}>
          <div className={styles.titleBlock}>
            <TerraMark size={36} />
            <div>
              <h2 id={titleId} className={styles.modalTitle}>Community Activation Kit</h2>
              <p className={styles.modalSubtitle}>
                {name} · {crisisType}
              </p>
            </div>
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
            <QRCodeSVG value={linkFor(activeLang)} size={160} />
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
            <pre
              className={styles.templateText}
              lang={LANG_META[activeLang].bcp47}
              dir={LANG_META[activeLang].dir}
            >{templates[activeLang]}</pre>
            <CopyButton text={templates[activeLang]} />
          </div>
        </div>

        <div className={styles.printRow}>
          {printBlocked && (
            <span className={styles.printError} role="alert">
              Popup blocked. Allow popups for this site, then try again.
            </span>
          )}
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
