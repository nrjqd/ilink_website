/**
 * 站台設定 API helper。
 *
 * 導覽、品牌、SEO 與 footer 文字優先由後端 CMS 提供；本檔只保留 I-LINK 的
 * 最小 fallback，避免 API 尚未回應時畫面出現錯誤站台資料。
 */

import { resolveMediaUrl } from "./media";
import { apiBaseUrl } from "./api";

export type NavigationItem = {
  label: string;
  href: string;
};

export type SiteSettings = {
  site_name: string;
  tagline?: string | null;
  logo_url?: string | null;
  default_seo_title?: string | null;
  default_seo_description?: string | null;
  og_image_url?: string | null;
  footer_description?: string | null;
  footer_label_primary?: string | null;
  footer_label_secondary?: string | null;
  copyright_text?: string | null;
  contact_email?: string | null;
  social_facebook_url?: string | null;
  social_instagram_url?: string | null;
  social_youtube_url?: string | null;
  navigation: NavigationItem[];
};

export const defaultSiteSettings: SiteSettings = {
  site_name: "I-LINK 旗美內門地方內容平台",
  tagline: "看故事、逛地方、看見學生把地方文化轉成作品",
  logo_url: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/branding/favicon/i-link-logo-header-small.png",
  default_seo_title: "I-LINK｜旗山、美濃、內門地方故事與成果平台",
  default_seo_description: "用故事、場域、學生作品、活動現場與成果數據，整理旗山、美濃、內門的地方文化行動。",
  og_image_url: resolveMediaUrl("/assets/img/1020/1020iLink美濃藍染文創設計工坊_001.webp"),
  footer_description: "I-LINK 把旗山、美濃、內門的地方走讀、人物故事、學生作品與活動成果整理成可持續被看見的內容平台。",
  footer_label_primary: "I-LINK LOCAL STORIES",
  footer_label_secondary: "QISHAN MEINONG NEIMEN",
  copyright_text: "© 2026 I-LINK",
  navigation: [
    { label: "看故事", href: "/" },
    { label: "逛地方", href: "/places" },
    { label: "學生作品", href: "/works" },
    { label: "活動現場", href: "/events" },
    { label: "成果總覽", href: "/impact" },
    { label: "關於 I-LINK", href: "/about" },
  ],
};

export async function fetchSiteSettings(signal?: AbortSignal): Promise<SiteSettings> {
  const response = await fetch(`${apiBaseUrl}/site-settings`, { cache: "no-store", signal });
  if (!response.ok) return defaultSiteSettings;
  const settings = (await response.json()) as SiteSettings;
  return {
    ...defaultSiteSettings,
    ...settings,
    logo_url: resolveMediaUrl(settings.logo_url || defaultSiteSettings.logo_url),
    og_image_url: resolveMediaUrl(settings.og_image_url || defaultSiteSettings.og_image_url),
    navigation: settings.navigation?.length ? settings.navigation : defaultSiteSettings.navigation,
  };
}
