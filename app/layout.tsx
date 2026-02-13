import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Analytics Dashboard",
  description: "Personal health data visualization with Oura Ring integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
