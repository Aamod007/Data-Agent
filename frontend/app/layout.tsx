import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Data Agents Workspace",
  description: "A unified workspace for Data Agents",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><WorkspaceShell>{children}</WorkspaceShell></body></html>;
}
