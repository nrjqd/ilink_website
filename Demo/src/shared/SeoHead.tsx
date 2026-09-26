/**
 * 宣告式 SEO 元件：頁面只需渲染 <Seo {...metadata} />，實際寫入 <head> 統一交給 updateSeo。
 * 同一時間只應有一個 <Seo> 掛載（App 負責固定頁，PostPage / NotFoundPage 負責自己的頁面）。
 */

import { useEffect } from "react";
import { updateSeo, type SeoMetadata } from "./seo";

export function Seo(props: SeoMetadata) {
  const serialized = JSON.stringify(props);

  useEffect(() => {
    updateSeo(JSON.parse(serialized) as SeoMetadata);
  }, [serialized]);

  return null;
}
