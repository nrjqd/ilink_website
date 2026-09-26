import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { SiteFooter } from "../../shared/SiteFooter";
import { SiteHeader } from "../../shared/SiteHeader";
import { getPostDisplayImage, resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";
import { apiBaseUrl } from "../../shared/api";
import { absoluteSiteUrl, updateSeo } from "../../shared/seo";
import { fetchPosts, type PostGalleryItem, type PostListItem } from "../../shared/posts";
import { formatPostCategory, formatPostRegion } from "../../shared/contentLabels";

interface PostPageProps {
  currentPath: string;
}

type MediaRecord = {
  original_filename?: string | null;
  original_url?: string | null;
  large_url?: string | null;
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

function getSlug(path: string) {
  return decodeURIComponent(path.replace(/^\/posts\//, "").replace(/\/$/, ""));
}

function mediaUrl(media: MediaRecord | null | undefined) {
  return resolveMediaUrl(media?.large_url || media?.original_url || "");
}

function renderMarkdown(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block, index) => {
      const text = block.trim();
      if (!text) return null;
      if (text.startsWith("## ")) return <h2 key={index}>{text.replace(/^## /, "")}</h2>;
      if (text.startsWith("# ")) return <h1 key={index}>{text.replace(/^# /, "")}</h1>;
      return <p key={index}>{text}</p>;
    })
    .filter(Boolean);
}

function plainTextSummary(content: string) {
  return content
    .replace(/[#*_>`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function postDescription(post: PostRecord) {
  return post.summary?.trim() || plainTextSummary(post.content) || post.title;
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
  const [post, setPost] = useState<PostRecord | null>(null);
  const [error, setError] = useState("");
  const related = useRelatedPosts(post);

  useEffect(() => {
    const controller = new AbortController();
    setPost(null);
    setError("");

    fetch(`${apiBaseUrl}/posts/${slug}`, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "文章不存在或尚未發布" : "文章載入失敗");
        return response.json() as Promise<PostRecord>;
      })
      .then((nextPost) => {
        setPost(nextPost);
        const path = `/posts/${nextPost.slug}`;
        const description = postDescription(nextPost);
        const image = mediaUrl(nextPost.cover_media);
        updateSeo({
          title: `${nextPost.title} | I-LINK`,
          description,
          path,
          image: image || undefined,
          type: "article",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: nextPost.title,
            description,
            ...(image ? { image } : {}),
            ...(nextPost.published_at ? { datePublished: nextPost.published_at } : {}),
            ...(nextPost.updated_at || nextPost.published_at
              ? { dateModified: nextPost.updated_at || nextPost.published_at }
              : {}),
            mainEntityOfPage: absoluteSiteUrl(path),
          },
        });
      })
      .catch((nextError) => {
        if (nextError.name !== "AbortError") setError(nextError instanceof Error ? nextError.message : "文章載入失敗");
      });

    return () => controller.abort();
  }, [slug]);

  const coverUrl = mediaUrl(post?.cover_media);
  const gallery = [...(post?.gallery_links ?? [])]
    .filter((link) => link.media)
    .sort((left, right) => left.sort_order - right.sort_order);

  return (
    <>
      <SiteHeader currentPath={currentPath} />
      <main className="post-page">
        <nav className="post-page__back" aria-label="返回">
          <a href="/" onClick={goBack}>
            ← 返回故事
          </a>
        </nav>

        {error ? (
          <section className="post-page__empty">
            <h1>{error}</h1>
            <a href="/">回首頁</a>
          </section>
        ) : null}

        {!error && post ? (
          <article>
            <header className="post-page__header">
              <p className="post-page__meta">
                {post.event_date ? <time dateTime={post.event_date}>{post.event_date.replace(/-/g, ".")}</time> : null}
                {post.region ? <span>{formatPostRegion(post.region)}</span> : null}
                {post.category ? <span>{formatPostCategory(post.category)}</span> : null}
              </p>
              <h1>{post.title}</h1>
              {post.summary ? <p className="post-page__summary">{post.summary}</p> : null}
            </header>
            {coverUrl ? (
              <div className="post-page__cover">
                <SafeImage ratio="auto" fit="contain" src={coverUrl} alt={post.title} />
              </div>
            ) : null}
            <div className="post-page__body">{renderMarkdown(post.content)}</div>

            {gallery.length > 0 ? (
              <section className="post-gallery" aria-label="活動相簿">
                <h2>活動相簿</h2>
                <ul className="post-gallery__list">
                  {gallery.map((link) => (
                    <li key={link.id}>
                      <figure>
                        <SafeImage
                          ratio="landscape"
                          src={resolveMediaUrl(link.media?.large_url || link.media?.original_url || "")}
                          alt={link.caption || ""}
                          loading="lazy"
                          decoding="async"
                        />
                        {link.caption ? <figcaption>{link.caption}</figcaption> : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        ) : null}

        {!error && related.length > 0 ? (
          <section className="post-related" aria-labelledby="post-related-title">
            <h2 id="post-related-title">同地區的其他故事</h2>
            <ul className="post-related__list">
              {related.map((item) => (
                <li key={item.id}>
                  <a className="post-related__card" href={`/posts/${encodeURIComponent(item.slug)}`}>
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
