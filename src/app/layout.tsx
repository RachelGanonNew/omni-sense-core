import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniSense Core",
  description: "Cognitive Second Brain for meetings and safety",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
