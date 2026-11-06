import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "PGA27 Buildout Studio | 2027 PGA Championship, Fields Ranch East",
  description: "3D site, flythroughs, CAD plan, live BOM and AI-assisted scenario planning for the 2027 PGA Championship buildout at PGA Frisco.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
