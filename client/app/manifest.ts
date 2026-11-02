import type { MetadataRoute } from "next";

// Makes the game installable ("Add to home screen")
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Friendly Game",
    short_name: "Friendly Game",
    description: "A two-player board game of love, dares, memories and gifts",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1b1020",
    theme_color: "#1b1020",
    categories: ["games", "entertainment", "lifestyle"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
