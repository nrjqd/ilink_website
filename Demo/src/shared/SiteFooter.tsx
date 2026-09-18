/**
 * 前端共用模組，提供跨頁使用的設定、媒體 URL、CMS 存取與導覽元件。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：共用頁尾元件，呈現站台資訊、連結與社群入口。

import { useEffect, useState } from "react";
import { defaultSiteSettings, fetchSiteSettings } from "./siteSettings";
import { SafeImage } from "./SafeMedia";

// 詳細註解：SiteFooter 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function SiteFooter() {
  const [settings, setSettings] = useState(defaultSiteSettings);

  useEffect(() => {
    const controller = new AbortController();
    fetchSiteSettings(controller.signal).then(setSettings).catch(() => setSettings(defaultSiteSettings));
    return () => controller.abort();
  }, []);

  return (
    <footer className="site-footer" aria-label={`${settings.site_name} footer`}>
      <div className="site-footer__brand">
        <a href="/" aria-label={settings.site_name}>
          <SafeImage
            src={settings.logo_url || defaultSiteSettings.logo_url || ""}
            alt={settings.site_name}
            width="209"
            height="80"
            loading="lazy"
            disableAutoCrossOrigin
          />
        </a>
        <p>{settings.footer_description}</p>
      </div>

      <nav className="site-footer__links" aria-label="Footer links">
        {settings.navigation.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="site-footer__meta">
        {settings.footer_label_primary ? <span>{settings.footer_label_primary}</span> : null}
        {settings.footer_label_secondary ? <span>{settings.footer_label_secondary}</span> : null}
        {settings.contact_email ? <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a> : null}
        <small>{settings.copyright_text}</small>
      </div>
    </footer>
  );
}
