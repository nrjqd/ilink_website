/**
 * 前端共用模組，提供跨頁使用的設定、媒體 URL、CMS 存取與導覽元件。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：共用頁首元件，處理導覽、目前頁狀態與行動版選單。

import { useLayoutEffect, useRef, useState } from "react";
import { defaultSiteSettings, fetchSiteSettings } from "./siteSettings";
import { SafeImage } from "./SafeMedia";

// 詳細註解：SiteHeaderProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface SiteHeaderProps {
  currentPath: string;
}

// 詳細註解：SiteHeader 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function SiteHeader({ currentPath }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSiteSettings);
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigation = settings.navigation;
  const activeHref = navigation.some((item) => item.href === currentPath) ? currentPath : "/";

  // 詳細註解：closeMobileMenu 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  useLayoutEffect(() => {
    const controller = new AbortController();
    fetchSiteSettings(controller.signal).then(setSettings).catch(() => setSettings(defaultSiteSettings));
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    // 詳細註解：moveIndicator 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const moveIndicator = () => {
      const nav = navRef.current;
      const target = itemRefs.current[activeHref];
      const indicator = indicatorRef.current;

      if (!nav || !target || !indicator) return;

      const navRect = nav.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const width = 44;
      const x = targetRect.left - navRect.left + targetRect.width / 2 - width / 2;

      indicator.style.opacity = "1";
      indicator.style.transform = `translate3d(${x}px, 0, 0)`;
    };

    moveIndicator();
    document.fonts?.ready.then(moveIndicator);

    // 詳細註解：onResize 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const onResize = () => moveIndicator();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [activeHref, navigation]);

  return (
    <header className={`demo-header ${mobileMenuOpen ? "is-menu-open" : ""}`}>
      <a className="brand" href="/" aria-label={settings.site_name} onClick={closeMobileMenu}>
        <SafeImage
          src={settings.logo_url || defaultSiteSettings.logo_url || ""}
          alt={settings.site_name}
          width="209"
          height="80"
          decoding="async"
          disableAutoCrossOrigin
        />
      </a>
      <button
        className="menu-toggle"
        type="button"
        aria-label={mobileMenuOpen ? "關閉選單" : "開啟選單"}
        aria-controls="primary-navigation"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="primary-navigation" ref={navRef} className="header-nav" aria-label={`${settings.site_name} navigation`}>
        {navigation.map((item) => (
          <a
            key={item.href}
            ref={(element) => {
              itemRefs.current[item.href] = element;
            }}
            href={item.href}
            className={`header-nav__item ${activeHref === item.href ? "is-active" : ""}`}
            aria-current={activeHref === item.href ? "page" : undefined}
            onClick={closeMobileMenu}
          >
            {item.label}
          </a>
        ))}
        <div ref={indicatorRef} className="header-nav__indicator" aria-hidden="true">
          <span className="header-nav__indicator-line" />
          <span className="header-nav__indicator-dot" />
        </div>
      </nav>
    </header>
  );
}
