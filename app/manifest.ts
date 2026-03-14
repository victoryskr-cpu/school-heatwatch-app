import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "급식실 폭염 입력",
    short_name: "폭염입력",
    description: "학교 급식실 폭염 위험 데이터 수집",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#0b7a53",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}