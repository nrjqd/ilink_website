import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "../../shared/SiteFooter";
import { SiteHeader } from "../../shared/SiteHeader";
import { resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";
import { apiBaseUrl } from "../../shared/api";

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
  published_at?: string | null;
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

export function PostPage({ currentPath }: PostPageProps) {
  const slug = useMemo(() => getSlug(currentPath), [currentPath]);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [error, setError] = useState("");

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
        document.title = `${nextPost.title} | I-LINK`;
        const description = document.querySelector<HTMLMetaElement>("meta[name='description']");
        if (description) description.content = nextPost.summary || nextPost.title;
      })
      .catch((nextError) => {
        if (nextError.name !== "AbortError") setError(nextError instanceof Error ? nextError.message : "文章載入失敗");
      });

    return () => controller.abort();
  }, [slug]);

  const coverUrl = mediaUrl(post?.cover_media);

  return (
    <>
      <SiteHeader currentPath="/posts" />
      <main className="post-page">
        {error ? (
          <section className="post-page__empty">
            <h1>{error}</h1>
            <a href="/">回首頁</a>
          </section>
        ) : null}

        {!error && post ? (
          <article>
            {coverUrl ? (
              <div className="post-page__cover">
                <SafeImage src={coverUrl} alt={post.cover_media?.original_filename ?? post.title} />
              </div>
            ) : null}
            <header className="post-page__header">
              <h1>{post.title}</h1>
              {post.summary ? <p className="post-page__summary">{post.summary}</p> : null}
            </header>
            <div className="post-page__body">{renderMarkdown(post.content)}</div>
          </article>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
