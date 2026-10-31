import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./landing/landing-page";

const AdminApp = lazy(() =>
  import("./App").then(({ App }) => ({ default: App })),
);
const pathname = window.location.pathname;
const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

if (pathname !== "/") {
  document.title = isAdminRoute
    ? "Durian Admin"
    : "Không tìm thấy trang | Sầu Riêng AI";
  document.documentElement.lang = isAdminRoute ? "en" : "vi";
  document
    .querySelector('meta[name="robots"]')
    ?.setAttribute("content", "noindex, nofollow");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      isAdminRoute
        ? "Administration console for Sầu Riêng AI."
        : "Trang bạn tìm không tồn tại.",
    );
  document
    .querySelectorAll(
      'link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"]',
    )
    .forEach((element) => element.remove());
}

function SiteRouter() {
  if (pathname === "/") return <LandingPage />;
  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <p
            role="status"
            style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}
          >
            Loading…
          </p>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "10vh auto",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này không tồn tại hoặc đã được thay đổi.</p>
      <a href="/">Về trang chủ Sầu Riêng AI</a>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteRouter />
  </StrictMode>,
);
