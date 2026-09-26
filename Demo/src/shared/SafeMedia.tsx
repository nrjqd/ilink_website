import { ImgHTMLAttributes, VideoHTMLAttributes, useState } from "react";
import { resolveMediaUrl } from "./media";

export type MediaRatio = "landscape" | "poster" | "square" | "auto";
export type MediaFit = "cover" | "contain";

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallbackLabel?: string;
  /**
   * 指定後會以 .media-frame 包住圖片並固定比例：poster 3/4、landscape 16/10、square 1/1、auto 不限制。
   * fallback 也放在同一個 frame 內，載入失敗時版面不會塌陷。
   */
  ratio?: MediaRatio;
  /** 預設 poster 用 contain（不裁切海報文字），其他比例用 cover。 */
  fit?: MediaFit;
  frameClassName?: string;
};

type SafeVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  src: string | null | undefined;
  fallbackLabel?: string;
};

function MediaFallback({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={["media-fallback", className].filter(Boolean).join(" ")} role="note">
      {label || "圖片暫時無法載入"}
    </span>
  );
}

// 一般 DOM <img> 不設定 crossOrigin：R2 圖片只有 WebGL texture（StoryPanel 的 TextureLoader）需要 CORS。
// 同一張圖若同時以 no-cors 與 anonymous 請求，瀏覽器快取的不透明回應會讓 CORS 請求失敗（RWD-002）。
export function SafeImage({ src, fallbackLabel, className, alt, ratio, fit, frameClassName, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);
  const content =
    !resolvedSrc || failed ? (
      <MediaFallback className={ratio ? undefined : className} label={fallbackLabel} />
    ) : (
      <img
        {...props}
        className={ratio ? ["media-frame__img", className].filter(Boolean).join(" ") : className}
        src={resolvedSrc}
        alt={alt ?? ""}
        onError={() => setFailed(true)}
      />
    );

  if (!ratio) return content;

  const resolvedFit = fit ?? (ratio === "poster" ? "contain" : "cover");
  return (
    <span className={["media-frame", `media-frame--${ratio}`, `media-frame--${resolvedFit}`, frameClassName].filter(Boolean).join(" ")}>
      {content}
    </span>
  );
}

export function SafeVideo({ src, fallbackLabel, className, children, ...props }: SafeVideoProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);

  if (!resolvedSrc || failed) {
    return <MediaFallback className={className} label={fallbackLabel || "影片暫時無法載入"} />;
  }

  return (
    <video {...props} className={className} src={resolvedSrc} onError={() => setFailed(true)}>
      {children}
    </video>
  );
}
