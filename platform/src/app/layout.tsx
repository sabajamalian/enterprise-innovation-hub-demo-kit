import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Enterprise Innovation Hub",
  description: "Create a governed application workspace from an employee idea."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
