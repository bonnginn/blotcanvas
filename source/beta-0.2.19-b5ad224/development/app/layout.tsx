import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlotCanvas ベータ版 — WB preparation workspace",
  description: "Western blot画像をブラウザ内で処理し、クロップ、分子量マーカー、条件ラベル、編集可能PDF、元画像記録、簡易定量を作成する無料アプリ。",
  keywords: [
    "Western blot",
    "ウェスタンブロット",
    "WB figure preparation",
    "Western blot quantification",
    "分子量マーカー",
    "ImageJ",
    "Illustrator",
    "research software",
  ],
  manifest: "/manifest.webmanifest",
  applicationName: "BlotCanvas",
  metadataBase: new URL("https://bonnginn.github.io/blotcanvas/"),
  alternates: {
    canonical: "./",
    languages: {
      ja: "./",
      en: "./?lang=en",
    },
  },
  openGraph: {
    type: "website",
    title: "BlotCanvas — Western blot figure preparation",
    description:
      "Western blot画像を端末内で処理し、Figure・元画像記録・簡易定量を作成します。",
    url: "./",
    images: [{ url: "demo/blotcanvas-og.png", width: 1200, height: 675 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlotCanvas — Western blot figure preparation",
    description:
      "Western blot画像を端末内で処理し、Figure・元画像記録・簡易定量を作成します。",
    images: ["demo/blotcanvas-og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "BlotCanvas ベータ版",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/blotcanvas-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
