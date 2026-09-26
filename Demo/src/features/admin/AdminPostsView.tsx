/**
 * 文章管理列表：搜尋、狀態 / 地區 / 分類篩選、排序與垃圾桶。
 * 後台 API 一次最多回傳 100 篇且不支援地區 / 分類篩選，因此在前端篩選已載入的完整清單；
 * 篩選條件同步到網址 query（replaceState），從編輯頁返回時會保留。
 */

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ExternalLink, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { SafeImage } from "../../shared/SafeMedia";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  REGION_LABELS,
  REGION_OPTIONS,
  formatPostCategory,
  formatPostRegion,
  type PostCategory,
  type PostRegion,
} from "../../shared/contentLabels";
import { permanentlyDeletePost, restorePost, type PostResponse, type PostStatus } from "./admin.api";
import {
  AdminButton,
  AdminPageHeader,
  EmptyState,
  POST_STATUS_LABELS,
  StatusBadge,
  formatDate,
  formatDateTime,
} from "./adminUi";
import { ADMIN_PATHS, mediaThumbUrl, type AdminContext } from "./adminContext";

type Props = { ctx: AdminContext };

type StatusFilter = "all" | PostStatus | "trash";
type SortKey = "updated_desc" | "event_desc" | "event_asc" | "title";

type Filters = {
  q: string;
  status: StatusFilter;
  region: "all" | PostRegion;
  category: "all" | PostCategory;
  sort: SortKey;
};

const DEFAULT_FILTERS: Filters = { q: "", status: "all", region: "all", category: "all", sort: "updated_desc" };

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: "最近更新",
  event_desc: "活動日期（新→舊）",
  event_asc: "活動日期（舊→新）",
  title: "標題",
};

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const region = params.get("region");
  const category = params.get("category");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    status: status && (status === "trash" || status in POST_STATUS_LABELS) ? (status as StatusFilter) : "all",
    region: region && REGION_OPTIONS.includes(region as PostRegion) ? (region as PostRegion) : "all",
    category: category && CATEGORY_OPTIONS.includes(category as PostCategory) ? (category as PostCategory) : "all",
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : "updated_desc",
  };
}

function writeFilters(filters: Filters) {
  const params = new URLSearchParams();
  (Object.keys(filters) as Array<keyof Filters>).forEach((key) => {
    if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
  });
  const next = `${ADMIN_PATHS.posts}${params.size ? `?${params.toString()}` : ""}`;
  if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState({}, "", next);
}

function sortPosts(items: PostResponse[], sort: SortKey) {
  const sorted = [...items];
  if (sort === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
  if (sort === "event_desc" || sort === "event_asc") {
    const direction = sort === "event_desc" ? -1 : 1;
    // 沒有活動日期的文章排在最後。
    return sorted.sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return a.event_date.localeCompare(b.event_date) * direction;
    });
  }
  return sorted.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
}

export function AdminPostsView({ ctx }: Props) {
  const [filters, setFilters] = useState<Filters>(readFilters);
  const [busyId, setBusyId] = useState<number | null>(null);
  const isTrash = filters.status === "trash";

  useEffect(() => writeFilters(filters), [filters]);

  const source = isTrash ? ctx.trashPosts : ctx.posts;
  const visible = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    const filtered = source.filter((post) => {
      if (!isTrash && filters.status !== "all" && post.status !== filters.status) return false;
      if (filters.region !== "all" && post.region !== filters.region) return false;
      if (filters.category !== "all" && post.category !== filters.category) return false;
      if (query) {
        const haystack = `${post.title} ${post.slug} ${post.summary ?? ""} ${post.content}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    return sortPosts(filtered, isTrash ? "updated_desc" : filters.sort);
  }, [source, filters, isTrash]);

  const hasActiveFilters =
    filters.q.trim() !== "" || filters.region !== "all" || filters.category !== "all" || (filters.status !== "all" && !isTrash);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters((current) => ({ ...DEFAULT_FILTERS, status: current.status === "trash" ? "trash" : "all" }));
  }

  function openPost(event: MouseEvent<HTMLAnchorElement>, id: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.navigate(ADMIN_PATHS.post(id));
  }

  async function restore(post: PostResponse) {
    setBusyId(post.id);
    try {
      const restored = await restorePost(ctx.token, post.id);
      ctx.upsertPost(restored);
      ctx.notify("success", `已還原「${post.title}」為草稿`);
      void ctx.refreshDashboard().catch(() => undefined);
    } catch (error) {
      ctx.reportError(error, "還原失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function destroy(post: PostResponse) {
    const ok = await ctx.confirm({
      title: "永久刪除文章",
      message: (
        <>
          <p>
            確定永久刪除「<strong>{post.title}</strong>」？
          </p>
          <p>此操作無法復原，文章內容與相簿設定都會被移除（媒體庫中的圖片會保留）。</p>
        </>
      ),
      confirmLabel: "永久刪除",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(post.id);
    try {
      await permanentlyDeletePost(ctx.token, post.id);
      ctx.removePost(post.id);
      ctx.notify("success", `已永久刪除「${post.title}」`);
    } catch (error) {
      ctx.reportError(error, "永久刪除失敗");
    } finally {
      setBusyId(null);
    }
  }

  const statusCounts = {
    all: ctx.posts.length,
    draft: ctx.posts.filter((post) => post.status === "draft").length,
    published: ctx.posts.filter((post) => post.status === "published").length,
    archived: ctx.posts.filter((post) => post.status === "archived").length,
    trash: ctx.trashPosts.length,
  };

  return (
    <>
      <AdminPageHeader
        title="文章管理"
        description={
          ctx.postsComplete
            ? `共 ${ctx.posts.length} 篇文章${ctx.trashPosts.length ? `，垃圾桶 ${ctx.trashPosts.length} 篇` : ""}`
            : `顯示最近 ${ctx.posts.length} 篇（共 ${ctx.postsTotal} 篇）`
        }
        actions={
          <AdminButton variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => ctx.navigate(ADMIN_PATHS.newPost)}>
            新增文章
          </AdminButton>
        }
      />

      <div className="adm-tabs" role="group" aria-label="依狀態篩選">
        {(["all", "draft", "published", "archived", "trash"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={filters.status === status ? "is-active" : undefined}
            aria-pressed={filters.status === status}
            onClick={() => update("status", status)}
          >
            {status === "all" ? "全部" : status === "trash" ? "垃圾桶" : POST_STATUS_LABELS[status]}
            <span className="adm-tabs__count">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      <div className="adm-filterbar" role="search">
        <div className="adm-search">
          <Search size={16} aria-hidden="true" />
          <label className="adm-sr-only" htmlFor="adm-post-search">
            搜尋文章
          </label>
          <input
            id="adm-post-search"
            type="search"
            placeholder="搜尋標題、網址代稱或內文"
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
          />
        </div>
        {!isTrash ? (
          <>
            <label className="adm-select">
              <span className="adm-sr-only">地區</span>
              <select value={filters.region} onChange={(event) => update("region", event.target.value as Filters["region"])}>
                <option value="all">所有地區</option>
                {REGION_OPTIONS.map((region) => (
                  <option key={region} value={region}>
                    {REGION_LABELS[region]}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-select">
              <span className="adm-sr-only">分類</span>
              <select value={filters.category} onChange={(event) => update("category", event.target.value as Filters["category"])}>
                <option value="all">所有分類</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-select">
              <span className="adm-sr-only">排序</span>
              <select value={filters.sort} onChange={(event) => update("sort", event.target.value as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    排序：{SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <p className="adm-filterbar__count" aria-live="polite">
          {visible.length} 筆結果
        </p>
        {hasActiveFilters ? (
          <AdminButton variant="ghost" size="sm" onClick={clearFilters}>
            清除篩選
          </AdminButton>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="adm-card">
          {source.length === 0 ? (
            isTrash ? (
              <EmptyState title="垃圾桶是空的" description="移到垃圾桶的文章會保留在這裡，可以還原或永久刪除。" />
            ) : (
              <EmptyState
                title="目前還沒有文章"
                description="建立第一篇文章，儲存後會先成為草稿。"
                action={
                  <AdminButton variant="primary" size="sm" onClick={() => ctx.navigate(ADMIN_PATHS.newPost)}>
                    建立第一篇文章
                  </AdminButton>
                }
              />
            )
          ) : (
            <EmptyState
              title="找不到符合目前篩選條件的文章"
              action={
                <AdminButton size="sm" onClick={clearFilters}>
                  清除篩選
                </AdminButton>
              }
            />
          )}
        </div>
      ) : (
        <div className="adm-card adm-card--flush">
          <table className="adm-table">
            <caption className="adm-sr-only">{isTrash ? "垃圾桶中的文章" : "文章列表"}</caption>
            <thead>
              <tr>
                <th scope="col">標題</th>
                <th scope="col">分類</th>
                <th scope="col">地區</th>
                <th scope="col">{isTrash ? "原狀態" : "狀態"}</th>
                <th scope="col">活動日期</th>
                <th scope="col">{isTrash ? "刪除時間" : "更新時間"}</th>
                <th scope="col">
                  <span className="adm-sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((post) => {
                const thumb = post.cover_media ? mediaThumbUrl(post.cover_media) : "";
                return (
                  <tr key={post.id}>
                    <td className="adm-table__title">
                      <div className="adm-post-cell">
                        <span className="adm-post-cell__thumb">
                          {thumb ? <SafeImage src={thumb} alt="" loading="lazy" decoding="async" fallbackLabel="" /> : null}
                        </span>
                        <span className="adm-post-cell__text">
                          {isTrash ? (
                            <strong>{post.title}</strong>
                          ) : (
                            <a href={ADMIN_PATHS.post(post.id)} onClick={(event) => openPost(event, post.id)}>
                              {post.title}
                            </a>
                          )}
                          <small>/{post.slug}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="分類">{formatPostCategory(post.category)}</td>
                    <td data-label="地區">{post.region ? formatPostRegion(post.region) : "—"}</td>
                    <td data-label="狀態">
                      <StatusBadge status={post.status} />
                    </td>
                    <td data-label="活動日期">{formatDate(post.event_date)}</td>
                    <td data-label={isTrash ? "刪除時間" : "更新時間"}>
                      {formatDateTime(isTrash ? post.deleted_at : post.updated_at)}
                    </td>
                    <td className="adm-table__actions">
                      {isTrash ? (
                        <>
                          <AdminButton
                            size="sm"
                            icon={<RotateCcw size={14} aria-hidden="true" />}
                            busy={busyId === post.id}
                            onClick={() => void restore(post)}
                          >
                            還原
                          </AdminButton>
                          <AdminButton
                            size="sm"
                            variant="danger-ghost"
                            icon={<Trash2 size={14} aria-hidden="true" />}
                            disabled={busyId === post.id}
                            onClick={() => void destroy(post)}
                          >
                            永久刪除
                          </AdminButton>
                        </>
                      ) : (
                        <>
                          <a
                            className="adm-btn adm-btn--secondary adm-btn--sm"
                            href={ADMIN_PATHS.post(post.id)}
                            onClick={(event) => openPost(event, post.id)}
                            aria-label={`編輯「${post.title}」`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            編輯
                          </a>
                          {post.status === "published" ? (
                            <a
                              className="adm-btn adm-btn--ghost adm-btn--sm"
                              href={`/posts/${encodeURIComponent(post.slug)}`}
                              target="_blank"
                              rel="noopener"
                              aria-label={`在網站查看「${post.title}」（另開分頁）`}
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                              查看
                            </a>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
