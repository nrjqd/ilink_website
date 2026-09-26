/**
 * 後台總覽：文章 / 媒體統計、最近更新文章、最近上傳圖片與快速操作。
 * 只使用 /admin/dashboard 與已載入的文章清單，不引入圖表套件。
 */

import type { MouseEvent } from "react";
import { ExternalLink, Plus, Upload } from "lucide-react";
import { SafeImage } from "../../shared/SafeMedia";
import { formatPostCategory } from "../../shared/contentLabels";
import { AdminButton, AdminPageHeader, EmptyState, StatusBadge, formatBytes, formatDateTime } from "./adminUi";
import { ADMIN_PATHS, mediaThumbUrl, type AdminContext } from "./adminContext";

type Props = { ctx: AdminContext };

export function AdminDashboardView({ ctx }: Props) {
  const { dashboard, posts, health } = ctx;
  const counts = dashboard?.posts;
  const recentPosts = [...posts]
    .sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? ""))
    .slice(0, 6);
  const recentMedia = dashboard?.recent_media ?? [];

  function go(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.navigate(path);
  }

  const stats = [
    { label: "文章總數", value: counts?.total, href: ADMIN_PATHS.posts, hint: counts ? `已封存 ${counts.archived}` : undefined },
    { label: "已發布", value: counts?.published, href: `${ADMIN_PATHS.posts}?status=published`, hint: "公開網站可見" },
    { label: "草稿", value: counts?.draft, href: `${ADMIN_PATHS.posts}?status=draft`, hint: "尚未公開" },
    {
      label: "媒體檔案",
      value: dashboard?.media_total,
      href: ADMIN_PATHS.media,
      hint: dashboard ? `使用容量 ${formatBytes(dashboard.media_total_bytes)}` : undefined,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="總覽"
        description="掌握文章與媒體狀態，從這裡快速開始今天的編輯工作。"
        actions={
          <>
            <AdminButton variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => ctx.navigate(ADMIN_PATHS.newPost)}>
              新增文章
            </AdminButton>
            <AdminButton icon={<Upload size={16} aria-hidden="true" />} onClick={() => ctx.navigate(ADMIN_PATHS.media)}>
              上傳圖片
            </AdminButton>
          </>
        }
      />

      <section aria-label="內容統計" className="adm-stats">
        {stats.map((stat) => (
          <a key={stat.label} className="adm-stat" href={stat.href} onClick={(event) => go(event, stat.href)}>
            <span className="adm-stat__label">{stat.label}</span>
            <strong className="adm-stat__value">{typeof stat.value === "number" ? stat.value : "—"}</strong>
            {stat.hint ? <span className="adm-stat__hint">{stat.hint}</span> : null}
          </a>
        ))}
      </section>

      <div className="adm-dashboard-grid">
        <section className="adm-card" aria-labelledby="adm-recent-posts">
          <header className="adm-card__header">
            <h2 id="adm-recent-posts">最近更新的文章</h2>
            <a className="adm-link" href={ADMIN_PATHS.posts} onClick={(event) => go(event, ADMIN_PATHS.posts)}>
              全部文章
            </a>
          </header>
          {recentPosts.length === 0 ? (
            <EmptyState
              title="目前還沒有文章"
              description="建立第一篇文章，發布後就會出現在網站上。"
              action={
                <AdminButton variant="primary" size="sm" onClick={() => ctx.navigate(ADMIN_PATHS.newPost)}>
                  建立第一篇文章
                </AdminButton>
              }
            />
          ) : (
            <ul className="adm-recent-list">
              {recentPosts.map((post) => (
                <li key={post.id}>
                  <a href={ADMIN_PATHS.post(post.id)} onClick={(event) => go(event, ADMIN_PATHS.post(post.id))}>
                    <span className="adm-recent-list__title">{post.title}</span>
                    <span className="adm-recent-list__meta">
                      {formatPostCategory(post.category)} · 更新於 {formatDateTime(post.updated_at)}
                    </span>
                  </a>
                  <StatusBadge status={post.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card" aria-labelledby="adm-quick-actions">
          <header className="adm-card__header">
            <h2 id="adm-quick-actions">快速操作</h2>
          </header>
          <div className="adm-quick-actions">
            <AdminButton variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => ctx.navigate(ADMIN_PATHS.newPost)}>
              新增文章
            </AdminButton>
            <AdminButton icon={<Upload size={16} aria-hidden="true" />} onClick={() => ctx.navigate(ADMIN_PATHS.media)}>
              上傳圖片
            </AdminButton>
            <a className="adm-btn adm-btn--secondary" href="/" target="_blank" rel="noopener">
              <ExternalLink size={16} aria-hidden="true" />
              查看網站
            </a>
          </div>
          <dl className="adm-facts">
            <div>
              <dt>首頁時間軸</dt>
              <dd>
                {dashboard ? `${dashboard.timeline_events.published} 篇` : "—"}
                <small>已發布且有活動日期的文章會自動排入首頁時間軸與「活動現場」。</small>
              </dd>
            </div>
            <div>
              <dt>系統狀態</dt>
              <dd>
                {health ? (
                  <span className={health.ok ? "adm-text-ok" : "adm-text-warn"}>{health.ok ? "正常" : "需要檢查"}</span>
                ) : (
                  "—"
                )}
                {health ? <small>圖片儲存（R2）：{health.r2_enabled ? "已啟用" : "未啟用"}</small> : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="adm-card adm-dashboard-grid__wide" aria-labelledby="adm-recent-media">
          <header className="adm-card__header">
            <h2 id="adm-recent-media">最近上傳的圖片</h2>
            <a className="adm-link" href={ADMIN_PATHS.media} onClick={(event) => go(event, ADMIN_PATHS.media)}>
              媒體庫
            </a>
          </header>
          {recentMedia.length === 0 ? (
            <EmptyState
              title="目前還沒有媒體"
              description="上傳的圖片會自動轉成 WebP 並產生縮圖。"
              action={
                <AdminButton variant="primary" size="sm" onClick={() => ctx.navigate(ADMIN_PATHS.media)}>
                  上傳第一張圖片
                </AdminButton>
              }
            />
          ) : (
            <ul className="adm-thumb-strip">
              {recentMedia.map((item) => (
                <li key={item.id}>
                  <SafeImage
                    src={mediaThumbUrl(item)}
                    alt={item.original_filename}
                    loading="lazy"
                    decoding="async"
                    fallbackLabel="無法載入"
                  />
                  <span title={item.original_filename}>{item.original_filename}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
