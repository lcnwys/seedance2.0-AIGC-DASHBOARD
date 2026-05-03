import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seedance 2.0 & Wan 2.7 - AI 创作平台",
  description: "聚合 Seedance 2.0、Seedream 5.0、Wan 2.7 Video 与 Wan 2.7 Image 的 AI 创作平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased bg-[#050505] text-zinc-100">
        {children}
      </body>
    </html>
  );
}
