import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VENTUREX",
    short_name: "VENTUREX",
    id: "/",
    scope: "/",
    lang: "id",
    description: "Temukan peluang usaha kuliner.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f2f0eb",
    theme_color: "#421d24",
    icons: [192, 512].map((size) => ({
      src: `/notification-icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
