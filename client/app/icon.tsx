import { ImageResponse } from "next/og";

// App icons for the browser tab and the PWA manifest (/icon/32, /icon/192, /icon/512)
const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

// Heart drawn as SVG so no emoji font has to be fetched at build time
export function HeartIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #3d1531 0%, #2b1238 55%, #170c2b 100%)",
        borderRadius: size >= 192 ? size * 0.22 : size * 0.2,
      }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fb7185" />
            <stop offset="1" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path
          fill="url(#g)"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
        {/* dice "3" on a diagonal */}
        {size >= 192 && <circle cx="8.6" cy="8.4" r="1.25" fill="#1b1020" />}
        {size >= 192 && <circle cx="12" cy="11.4" r="1.25" fill="#1b1020" />}
        {size >= 192 && <circle cx="15.4" cy="14.4" r="1.25" fill="#1b1020" />}
      </svg>
    </div>
  );
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id) || 32;
  return new ImageResponse(<HeartIcon size={size} />, { width: size, height: size });
}
