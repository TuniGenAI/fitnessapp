import { useState } from "react";

type Scrim = "none" | "bottom" | "full";

/**
 * Image with a graceful lifecycle: a brand-gradient placeholder shows while
 * loading, the photo fades in on load, and if the URL ever fails the gradient
 * simply stays (never a broken-image icon). An optional dark scrim keeps
 * overlaid white text legible.
 */
export function Photo({
  src,
  alt = "",
  className = "",
  scrim = "none",
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  scrim?: Scrim;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Gradient placeholder / permanent fallback. */}
      <div
        className="bg-grad-hero absolute inset-0"
        style={{
          opacity: loaded && !failed ? 0 : 1,
          transition: "opacity 500ms ease",
        }}
      />
      {!failed && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 500ms ease" }}
        />
      )}
      {scrim !== "none" && (
        <div
          className={`pointer-events-none absolute inset-0 ${
            scrim === "full" ? "scrim-full" : "scrim-bottom"
          }`}
        />
      )}
    </div>
  );
}
