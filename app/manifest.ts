import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beb's Gestão",
    short_name: "Beb's",
    start_url: "/",
    display: "standalone",
    background_color: "#070914",
    theme_color: "#ef2f9a",
    icons: [{ src: "/brand/bebs-logo-source.jpg", sizes: "512x512", type: "image/jpeg" }],
  };
}
