import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Bảng giá điện thoại",
  description: "Tool theo dõi giá điện thoại từ các shop",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${roboto.variable} h-full antialiased`}>
      <body className="font-sans min-h-full flex flex-col">{children}</body>
    </html>
  );
}
