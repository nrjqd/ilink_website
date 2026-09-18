import { ImgHTMLAttributes, VideoHTMLAttributes, useState } from "react";
import { resolveMediaUrl } from "./media";

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallbackLabel?: string;
  disableAutoCrossOrigin?: boolean;
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

function shouldUseAnonymousCors(src: string) {
  return /^https?:\/\//i.test(src);
}

export function SafeImage({ src, fallbackLabel, className, alt, crossOrigin, disableAutoCrossOrigin = false, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);

  if (!resolvedSrc || failed) {
    return <MediaFallback className={className} label={fallbackLabel} />;
  }

  return (
    <img
      {...props}
      className={className}
      crossOrigin={crossOrigin ?? (!disableAutoCrossOrigin && shouldUseAnonymousCors(resolvedSrc) ? "anonymous" : undefined)}
      src={resolvedSrc}
      alt={alt ?? ""}
      onError={() => setFailed(true)}
    />
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
