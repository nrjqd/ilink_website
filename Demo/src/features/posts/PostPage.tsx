import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { SiteFooter } from "../../shared/SiteFooter";
import { SiteHeader } from "../../shared/SiteHeader";
import { getPostDisplayImage, resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";
import { apiBaseUrl } from "../../shared/api";
import { Seo } from "../../shared/SeoHead";
import { NOINDEX_ROBOTS, formatPageTitle, type SeoMetadata } from "../../shared/seo";
import { SECTION_LINKS } from "../../shared/routes";
import { articleJsonLd, breadcrumbJsonLd, type BreadcrumbItem } from "../../shared/structuredData";
import { NOT_FOUND_TITLE, NotFoundContent } from "../../shared/NotFoundPage";
import { fetchPosts, type PostGalleryItem, type PostListItem } from "../../shared/posts";
import { REGION_LABELS, formatPostCategory, formatPostRegion, type PostRegion } from "../../shared/contentLabels";

interface PostPageProps {
  currentPath: string;
}

type MediaRecord = {
  original_filename?: string | null;
  original_url?: string | null;
  large_url?: string | null;
  width?: number | null;
  height?: number | null;
};

type PostRecord = {
  slug: string;
  title: string;
  summary?: string | null;
  content: string;
  region?: string | null;
  category?: string | null;
  event_date?: string | null;
  cover_media?: MediaRecord | null;
  gallery_links?: PostGalleryItem[] | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; post: PostRecord }
  | { status: "notFound" }
  | { status: "error" };

function getSlug(path: string) {
  const raw = path.replace(/^\/posts\//, "").replace(/\/$/, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function postPath(slug: string) {
  return `/posts/${encodeURIComponent(slug)}`;
}

function mediaUrl(media: MediaRecord | null | undefined) {
  return resolveMediaUrl(media?.large_url || media?.original_url || "");
}

function mediaDimensions(media: MediaRecord | null | undefined) {
  return media?.width && media?.height ? { width: media.width, height: media.height } : {};
}

function renderMarkdown(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block, index) => {
      const text = block.trim();
      if (!text) return null;
      // 文章頁唯一的 H1 是文章標題；內文的 "# " 降為 H2、"## " 降為 H3，維持標題層級。
      if (text.startsWith("## ")) return <h3 key={index}>{text.replace(/^## /, "")}</h3>;
      if (text.startsWith("# ")) return <h2 key={index}>{text.replace(/^# /, "")}</h2>;
      return <p key={index}>{text}</p>;
    })
    .filter(Boolean);
}

function plainTextSummary(content: string) {
  const text = content
    .replace(/[#*_>`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 150).trim()}…` : text;
}

function postDescription(post: PostRecord) {
  return post.summary?.trim() || plainTextSummary(post.content) || post.title;
}

/** 有活動日期的文章出現在「活動現場」時間軸，其餘歸在「學生作品」。 */
function postSection(post: PostRecord) {
  return post.event_date ? SECTION_LINKS.events : SECTION_LINKS.works;
}

function isKnownRegion(region: string | null | undefined): region is PostRegion {
  return !!region && region in REGION_LABELS;
}

function galleryAlt(post: PostRecord, link: PostGalleryItem, index: number) {
  return link.caption?.trim() || `${post.title}｜照片 ${index + 1}`;
}

function buildPostMetadata(post: PostRecord): SeoMetadata {
  const path = postPath(post.slug);
  const description = postDescription(post);
  const section = postSection(post);
  const coverImage = mediaUrl(post.cover_media);
  const galleryImages = [...(post.gallery_links ?? [])]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((link) => mediaUrl(link.media))
    .filter(Boolean);
  const images = Array.from(new Set([coverImage, ...galleryImages].filter(Boolean))).slice(0, 3);
  const regionLabel = isKnownRegion(post.region) ? formatPostRegion(post.region) : null;
  const categoryLabel = post.category ? formatPostCategory(post.category) : null;
  const breadcrumbs: BreadcrumbItem[] = [SECTION_LINKS.home, section, { name: post.title, path }];

  return {
    title: formatPageTitle(post.title),
    description,
    path,
    image: images[0],
    imageAlt: post.title,
    type: "article",
    publishedTime: post.published_at,
    modifiedTime: post.updated_at || post.published_at,
    jsonLd: [
      articleJsonLd({
        headline: post.title,
        description,
        path,
        images,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        section: categoryLabel,
        keywords: [regionLabel ?? "", categoryLabel ?? "", "I-LINK"],
        locationName: regionLabel,
      }),
      breadcrumbJsonLd(breadcrumbs),
    ],
  };
}

// 從站內頁面點進來時回到上一頁（保留捲動位置與篩選）；直接開啟文章時連回首頁。
function goBack(event: MouseEvent<HTMLAnchorElement>) {
  if (!document.referrer.startsWith(window.location.origin) || window.history.length < 2) return;
  event.preventDefault();
  window.history.back();
}

// 相關文章只使用既有 /posts API（同地區），最多 3 筆；失敗時不顯示，不阻塞文章。
function useRelatedPosts(post: PostRecord | null) {
  const [related, setRelated] = useState<PostListItem[]>([]);

  useEffect(() => {
    setRelated([]);
    if (!post?.region) return;
    const controller = new AbortController();
    fetchPosts({ status: "published", region: post.region, limit: 4 }, controller.signal)
      .then((items) => setRelated(items.filter((item) => item.slug !== post.slug).slice(0, 3)))
      .catch(() => setRelated([]));
    return () => controller.abort();
  }, [post?.slug, post?.region]);

  return related;
}

export function PostPage({ currentPath }: PostPageProps) {
  const slug = useMemo(() => getSlug(currentPath), [currentPath]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const post = state.status === "ready" ? state.post : null;
  const related = useRelatedPosts(post);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetch(`${apiBaseUrl}/posts/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setState({ status: "notFound" });
          return;
        }
        if (!response.ok) throw new Error(`Post API failed with ${response.status}`);
        setState({ status: "ready", post: (await response.json()) as PostRecord });
      })
      .catch((nextError: unknown) => {
        if (nextError instanceof DOMException && nextError.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [slug]);

  const seo: SeoMetadata = useMemo(() => {
    if (state.status === "ready") return buildPostMetadata(state.post);
    if (state.status === "notFound") {
      return {
        title: NOT_FOUND_TITLE,
        description: "這篇文章不存在或尚未發布。",
        path: postPath(slug),
        robots: NOINDEX_ROBOTS,
      };
    }
    // 載入中或 API 暫時失敗：不輸出 noindex（避免 API 短暫異常時被移出索引），也不輸出 Article JSON-LD。
    return {
      title: formatPageTitle(state.status === "error" ? "文章暫時無法載入" : "文章"),
      description: "I-LINK 旗山、美濃、內門地方故事文章。",
      path: postPath(slug),
      type: "article",
    };
  }, [state, slug]);

  const coverUrl = mediaUrl(post?.cover_media);
  const gallery = [...(post?.gallery_links ?? [])]
    .filter((link) => link.media)
    .sort((left, right) => left.sort_order - right.sort_order);
  const section = post ? postSection(post) : null;
  const region = post && isKnownRegion(post.region) ? post.region : null;

  return (
    <>
      <Seo {...seo} />
      <SiteHeader currentPath={currentPath} />
      <main className="post-page" id="main-content">
        <nav className="post-page__back" aria-label="返回">
          <a href="/" onClick={goBack}>
            ← 返回故事
          </a>
        </nav>

        {state.status === "loading" ? (
          <p className="post-page__status" role="status">
            文章載入中…
          </p>
        ) : null}

        {state.status === "notFound" ? (
          <NotFoundContent title="找不到這篇文章" message="這篇文章不存在、已下架或尚未發布。" />
        ) : null}

        {state.status === "error" ? (
          <section className="post-page__empty">
            <h1>文章暫時無法載入</h1>
            <p>請稍後重新整理頁面。</p>
            <a href="/">回首頁</a>
          </section>
        ) : null}

        {post && section ? (
          <article>
            <header className="post-page__header">
              <nav className="post-breadcrumb" aria-label="麵包屑">
                <ol>
                  <li>
                    <a href={SECTION_LINKS.home.path}>{SECTION_LINKS.home.name}</a>
                  </li>
                  <li>
                    <a href={section.path}>{section.name}</a>
                  </li>
                  <li aria-current="page">{post.title}</li>
                </ol>
              </nav>
              <p className="post-page__meta">
                {post.event_date ? <time dateTime={post.event_date}>{post.event_date.replace(/-/g, ".")}</time> : null}
                {region ? <span>{formatPostRegion(region)}</span> : null}
                {post.category ? <span>{formatPostCategory(post.category)}</span> : null}
              </p>
              <h1>{post.title}</h1>
              {post.summary ? <p className="post-page__summary">{post.summary}</p> : null}
            </header>
            {coverUrl ? (
              <div className="post-page__cover">
                <SafeImage
                  ratio="auto"
                  fit="contain"
                  src={coverUrl}
                  alt={post.title}
                  decoding="async"
                  {...mediaDimensions(post.cover_media)}
                />
              </div>
            ) : null}
            <div className="post-page__body">{renderMarkdown(post.content)}</div>

            {gallery.length > 0 ? (
              <section className="post-gallery" aria-labelledby="post-gallery-title">
                <h2 id="post-gallery-title">活動相簿</h2>
                <ul className="post-gallery__list">
                  {gallery.map((link, index) => (
                    <li key={link.id}>
                      <figure>
                        <SafeImage
                          ratio="landscape"
                          src={resolveMediaUrl(link.media?.large_url || link.media?.original_url || "")}
                          alt={galleryAlt(post, link, index)}
                          loading="lazy"
                          decoding="async"
                          {...mediaDimensions(link.media)}
                        />
                        {link.caption ? <figcaption>{link.caption}</figcaption> : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <nav className="post-more-links" aria-label="延伸瀏覽">
              <h2>繼續探索</h2>
              <ul>
                <li>
                  <a href={section.path}>更多{section.name} →</a>
                </li>
                {region ? (
                  <li>
                    <a href={`/works?region=${region}`}>更多{formatPostRegion(region)}的作品與故事 →</a>
                  </li>
                ) : null}
                {region ? (
                  <li>
                    <a href={`/places#${region}`}>逛{formatPostRegion(region)} →</a>
                  </li>
                ) : (
                  <li>
                    <a href={SECTION_LINKS.places.path}>逛旗山、美濃、內門 →</a>
                  </li>
                )}
              </ul>
            </nav>
          </article>
        ) : null}

        {post && related.length > 0 ? (
          <section className="post-related" aria-labelledby="post-related-title">
            <h2 id="post-related-title">同地區的其他故事</h2>
            <ul className="post-related__list">
              {related.map((item) => (
                <li key={item.id}>
                  <a className="post-related__card" href={postPath(item.slug)}>
                    <SafeImage
                      ratio="poster"
                      frameClassName="post-related__media"
                      src={getPostDisplayImage(item)}
                      alt=""
                      fallbackLabel="無圖片"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="post-related__body">
                      <span className="post-related__meta">
                        {item.event_date ? item.event_date.replace(/-/g, ".") : ""}
                        {item.category ? ` · ${formatPostCategory(item.category)}` : ""}
                      </span>
                      <strong>{item.title}</strong>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
