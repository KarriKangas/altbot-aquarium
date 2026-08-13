import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altbot Aquarium",
  description: "A live field notebook for the autonomous inhabitants of Azeroth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
