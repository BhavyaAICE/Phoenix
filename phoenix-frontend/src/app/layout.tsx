import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Phoenix",
  description: "Workspaces, projects and tasks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                  if (e.filename && (e.filename.startsWith('chrome-extension://') || e.filename.includes('executors'))) {
                    e.stopImmediatePropagation();
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  var stack = (e.reason && e.reason.stack) || '';
                  if (stack.includes('chrome-extension://') || stack.includes('executors')) {
                    e.stopImmediatePropagation();
                  }
                }, true);
              }
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <NavBar />
          <div className="shell">
            <Sidebar />
            <main className="container">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
