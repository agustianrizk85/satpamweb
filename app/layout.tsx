import type { Metadata } from "next";
import "./globals.css";
import { ReactQueryProvider } from "@/libs/react-query";
export const metadata: Metadata = {
  title: "Satpam Master Data",
  description: "Master data management for satpam app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body >
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  );
}