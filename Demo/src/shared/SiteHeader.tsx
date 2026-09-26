/**
 * 前端共用模組，提供跨頁使用的設定、媒體 URL、CMS 存取與導覽元件。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：共用頁首元件，處理導覽、目前頁狀態與行動版選單。
// ≤1023px 使用全螢幕選單：關閉時 inert（不在 Tab 順序與讀屏樹中），開啟時頁面其他區塊 inert、
// 鎖定捲動，Esc / 點遮罩 / 選擇連結後關閉並把焦點還給選單按鈕。

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { defaultSiteSettings, fetchSiteSettings } from "./siteSettings";
import { SafeImage } from "./SafeMedia";
import { useMediaQuery } from "../features/timeline/hooks/useMediaQuery";

const COMPACT_NAV_QUERY = "(max-width: 1023px)";

// 詳細註解：SiteHeaderProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface SiteHeaderProps {
  currentPath: string;
}

function resolveActiveHref(currentPath: string, hrefs: string[]) {
  if (hrefs.includes(currentPath)) return currentPath;
  // /places/xxx、/works/xxx 仍屬於該區；/posts/:slug 不對應任何導覽項目。
  return hrefs.find((href) => href !== "/" && currentPath.startsWith(`${href}/`)) ?? null;
}

// 詳細註解：SiteHeader 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function SiteHeader({ currentPath }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSiteSettings);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const isCompact = useMediaQuery(COMPACT_NAV_QUERY);
  const navigation = settings.navigation;
  const activeHref = resolveActiveHref(
    currentPath,
    navigation.map((item) => item.href),
  );
  const menuOpen = isCompact && mobileMenuOpen;

  // 詳細註解：closeMobileMenu 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchSiteSettings(controller.signal).then(setSettings).catch(() => setSettings(defaultSiteSettings));
    return () => controller.abort();
  }, []);

  // 關閉時導覽不可被聚焦（只在 compact 模式；桌機導覽永遠可用）。
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    if (isCompact && !menuOpen) nav.setAttribute("inert", "");
    else nav.removeAttribute("inert");
  }, [isCompact, menuOpen]);

  // 開啟時：頁面其他區塊 inert（等同 focus trap）、鎖定捲動、Esc 關閉。
  useEffect(() => {
    if (!menuOpen) return;
    const header = headerRef.current;
    const siblings = header?.parentElement
      ? Array.from(header.parentElement.children).filter((child) => child !== header)
      : [];
    const outside = [...siblings, ...Array.from(document.body.children).filter((child) => child.id !== "root")];
    outside.forEach((element) => element.setAttribute("inert", ""));
    document.documentElement.classList.add("is-scroll-locked");
    navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      toggleRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      outside.forEach((element) => element.removeAttribute("inert"));
      document.documentElement.classList.remove("is-scroll-locked");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    // 詳細註解：moveIndicator 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const moveIndicator = () => {
      const nav = navRef.current;
      const target = activeHref ? itemRefs.current[activeHref] : null;
      const indicator = indicatorRef.current;

      if (!indicator) return;
      if (!nav || !target) {
        indicator.style.opacity = "0";
        return;
      }

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
    <header ref={headerRef} className={`demo-header ${menuOpen ? "is-menu-open" : ""}`}>
      <a className="brand" href="/" aria-label={settings.site_name} onClick={closeMobileMenu}>
        <SafeImage
          src={settings.logo_url || defaultSiteSettings.logo_url || ""}
          alt={settings.site_name}
          width="209"
          height="80"
          decoding="async"
        />
      </a>
      <button
        ref={toggleRef}
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "關閉選單" : "開啟選單"}
        aria-controls="primary-navigation"
        aria-expanded={menuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen ? <div className="header-nav__backdrop" aria-hidden="true" onClick={closeMobileMenu} /> : null}
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
            {activeHref === item.href ? <span className="header-nav__current">目前頁面</span> : null}
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
