import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./landing.css";
import { AiSpotlight, ProductDifference } from "./product-story";

type IconName =
  | "leaf"
  | "flower"
  | "fruit"
  | "basket"
  | "chart"
  | "book"
  | "scan"
  | "chat"
  | "wallet"
  | "check"
  | "arrow"
  | "download"
  | "phone"
  | "menu"
  | "close"
  | "layers";
const paths: Record<IconName, ReactNode> = {
  leaf: (
    <>
      <path d="M20 3c-5 0-13 1-13 8a6 6 0 0 0 6 6c7 0 8-8 7-14Z" />
      <path d="M3 21 15 9M7 17v-6M7 17h6" />
    </>
  ),
  flower: (
    <>
      <path d="M12 8C6 0 1 9 8 12c-8 5 1 11 4 4 4 7 12 0 4-4 7-4 1-12-4-4Z" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 18v4" />
    </>
  ),
  fruit: (
    <>
      <path d="M12 6c-7-4-11 6-6 12 3 4 5 2 6 2s3 2 6-2c5-6 1-16-6-12ZM12 6c0-4 3-4 5-4" />
    </>
  ),
  basket: (
    <>
      <path d="m3 9 3 12h12l3-12H3Zm4 0 5-7 5 7M9 13v4M15 13v4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15l4-5 4 2 5-7" />
    </>
  ),
  book: (
    <>
      <path d="M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm0 15a3 3 0 0 1 3-3h12M8 7h7M8 10h5" />
    </>
  ),
  scan: (
    <>
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 12h18" />
      <path d="M15 8c-5 0-7 4-4 8 4-1 5-4 4-8Z" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11a9 9 0 0 1-9 9 11 11 0 0 1-4-1l-5 2 1-5a10 10 0 0 1-1-5 9 9 0 0 1 18 0ZM8 10h8M8 14h5" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 7H6a3 3 0 0 1 0-6h12v6M3 4v15a2 2 0 0 0 2 2h15V7M20 12h-5v5h5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M10 5h4M11 19h2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8l10-5ZM2 13l10 5 10-5M2 18l10 5 10-5" />
    </>
  ),
};

function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`lp-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const stages: {
  name: string;
  icon: IconName;
  headline: string;
  description: string;
  image: string;
  imageAlt: string;
  tools: string[];
}[] = [
  {
    name: "Phục hồi cây",
    icon: "leaf",
    image: "season-recovery",
    imageAlt: "Minh họa đọt lá mới và nhà vườn kiểm tra cây sau thu hoạch",
    headline: "Khởi đầu từ chính khu vườn.",
    description:
      "Tạo vườn, chia lô, mở vụ. Ghi lại từng việc chăm cây để có điểm bắt đầu rõ ràng.",
    tools: ["Vườn, lô & mùa vụ", "Nhật ký chăm sóc", "Vật tư đã dùng"],
  },
  {
    name: "Ra hoa",
    icon: "flower",
    image: "season-flowering",
    imageAlt: "Minh họa chùm hoa sầu riêng mọc trên cành gỗ",
    headline: "Hiểu cây ở từng giai đoạn.",
    description:
      "Tra cứu kiến thức theo giai đoạn, hỏi đáp khi cần và lưu lại những việc đã làm.",
    tools: ["Kiến thức canh tác", "Hỏi đáp có nguồn", "Nhật ký theo vụ"],
  },
  {
    name: "Đậu trái",
    icon: "fruit",
    image: "season-fruit-set",
    imageAlt: "Minh họa những trái sầu riêng non vừa hình thành trên cành",
    headline: "Theo sát từng thay đổi.",
    description:
      "Ghi hoạt động chăm sóc, quét ảnh khi thấy dấu hiệu bất thường và theo dõi ca bệnh trong vụ.",
    tools: ["Quét ảnh hỗ trợ nhận diện", "Lịch sử quét", "Ghi chép chăm sóc"],
  },
  {
    name: "Nuôi trái",
    icon: "layers",
    image: "durian-orchard",
    imageAlt: "Minh họa nhà vườn theo dõi sầu riêng trong giai đoạn nuôi trái",
    headline: "Chăm cây, nắm cả chi phí.",
    description:
      "Gắn công chăm sóc với vật tư và khoản chi. Tra cứu checklist tiêu chuẩn để tự đối chiếu.",
    tools: ["Nhật ký & vật tư", "Chi phí theo vụ", "Checklist tiêu chuẩn"],
  },
  {
    name: "Thu hoạch",
    icon: "basket",
    image: "season-harvest",
    imageAlt: "Minh họa nhà vườn phân loại sầu riêng trong ngày thu hoạch",
    headline: "Rõ chuyện bán, sát dòng tiền.",
    description:
      "Ghi giao dịch bán, tiền cọc và khoản đã nhận. Biết phần nào còn phải thu.",
    tools: ["Giao dịch bán", "Cọc & thanh toán", "Theo dõi phải thu"],
  },
  {
    name: "Nhìn lại mùa vụ",
    icon: "chart",
    image: "season-review",
    imageAlt: "Minh họa nhà vườn xem sổ ghi chép sau một mùa sầu riêng",
    headline: "Khép một vụ, hiểu vườn hơn.",
    description:
      "Xem tổng chi, giá trị bán và lãi theo số đã ghi. Giữ lại lịch sử cho mùa tiếp theo.",
    tools: ["Tổng quan mùa vụ", "Thu, chi & lãi đã ghi", "Lịch sử chăm sóc"],
  },
];

function SeasonJourney() {
  const [active, setActive] = useState(0);
  const panelId = useId();
  const selected = stages[active];
  return (
    <section
      className="lp-section lp-season"
      id="mua-vu"
      aria-labelledby="season-heading"
    >
      <div className="lp-section-head" data-reveal="heading">
        <p className="lp-eyebrow">TỪ ĐẦU VỤ ĐẾN CUỐI MÙA</p>
        <h2 id="season-heading">
          Một mùa vụ.
          <br />
          Một mạch đồng hành.
        </h2>
        <p>Chọn một chặng để xem app giúp gì.</p>
      </div>
      <div className="lp-journey" data-reveal="image">
        <div
          className="lp-stages"
          role="group"
          aria-label="Các giai đoạn của mùa vụ"
        >
          {stages.map((stage, index) => (
            <button
              key={stage.name}
              type="button"
              className={`lp-stage ${index === active ? "is-active" : ""}`}
              aria-pressed={index === active}
              aria-controls={panelId}
              onClick={() => setActive(index)}
            >
              <span className="lp-stage-marker">
                <Icon name={stage.icon} />
              </span>
              <span>
                <small>0{index + 1}</small>
                {stage.name}
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
        <div
          className="lp-stage-detail"
          id={panelId}
          aria-live="polite"
          aria-atomic="true"
        >
          <figure className="lp-season-art">
            <img
              key={selected.image}
              src={`/landing/${selected.image}.webp`}
              width="840"
              height="560"
              loading="lazy"
              alt={selected.imageAlt}
            />
            <span className="lp-season-number">
              0{active + 1}
              <span>/ 06</span>
            </span>
            <figcaption>Ảnh minh họa</figcaption>
          </figure>
          <div className="lp-stage-copy" key={active}>
            <span className="lp-detail-label">{selected.name}</span>
            <h3>{selected.headline}</h3>
            <p>{selected.description}</p>
            <ul>
              {selected.tools.map((tool) => (
                <li key={tool}>
                  <Icon name="check" />
                  {tool}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || motion.matches) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    page
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <a className="lp-skip" href="#noi-dung">
        Đến nội dung chính
      </a>
      <header className="lp-header">
        <div className="lp-header-inner">
          <a className="lp-brand" href="/" aria-label="Sầu Riêng AI, trang chủ">
            <img src="/landing/app-icon.webp" width="44" height="44" alt="" />
            <span>
              Sầu Riêng <b>AI</b>
            </span>
          </a>
          <button
            className="lp-menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="landing-nav"
            aria-label={menuOpen ? "Đóng điều hướng" : "Mở điều hướng"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
          <nav
            className={menuOpen ? "is-open" : ""}
            id="landing-nav"
            aria-label="Điều hướng chính"
            onClick={() => setMenuOpen(false)}
          >
            <a href="#mua-vu">Một mùa đồng hành</a>
            <a href="#khac-biet">Điểm khác biệt</a>
            <a href="#tinh-nang">AI trong ứng dụng</a>
            <a href="#lo-trinh">Lộ trình</a>
            <a href="#tai-ung-dung" className="lp-button lp-button-small">
              Tải ứng dụng
              <Icon name="arrow" />
            </a>
          </nav>
        </div>
      </header>

      <main id="noi-dung">
        <section
          className="lp-hero lp-container"
          aria-labelledby="hero-heading"
        >
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">TRỢ LÝ CỦA NHÀ VƯỜN</p>
            <h1 id="hero-heading">
              Đồng hành <br />
              trọn mùa <br />
              <span>sầu riêng.</span>
            </h1>
            <p className="lp-hero-description">
              Chăm cây, nắm thu chi, hỏi AI có nguồn. Ghi chép cùng vườn, lô và
              mùa vụ.
            </p>
            <div className="lp-actions">
              <a className="lp-button" href="#mua-vu">
                Khám phá mùa vụ
                <Icon name="arrow" />
              </a>
              <a className="lp-text-link" href="#tai-ung-dung">
                Thông tin tải app
                <Icon name="arrow" />
              </a>
            </div>
          </div>
          <figure className="lp-hero-visual">
            <img
              src="/landing/durian-orchard.webp"
              width="1000"
              height="1250"
              fetchPriority="high"
              alt="Minh họa nhà vườn quan sát cây sầu riêng trĩu trái trong nắng sớm"
            />
            <figcaption>
              Chăm từng chặng. Hiểu cả mùa.<small>Hình ảnh minh họa</small>
            </figcaption>
          </figure>
        </section>

        <div
          className="lp-tool-strip lp-container"
          aria-label="Công cụ đồng hành"
        >
          <span>
            <Icon name="leaf" />
            Vườn & mùa vụ
          </span>
          <span>
            <Icon name="book" />
            Nhật ký chăm sóc
          </span>
          <span>
            <Icon name="scan" />
            Sức khỏe cây
          </span>
          <span>
            <Icon name="wallet" />
            Thu chi theo vụ
          </span>
        </div>

        <div className="lp-container">
          <SeasonJourney />
        </div>

        <ProductDifference />
        <AiSpotlight />

        <section
          className="lp-roadmap-section"
          id="lo-trinh"
          aria-labelledby="roadmap-heading"
        >
          <div className="lp-container lp-section">
            <div className="lp-section-head">
              <p className="lp-eyebrow">LỚN LÊN CÙNG NHÀ VƯỜN</p>
              <h2 id="roadmap-heading">
                Bắt đầu từ một vụ.
                <br />
                Đi xa cùng nhiều vườn.
              </h2>
            </div>
            <ol className="lp-roadmap" data-reveal="list">
              <li className="lp-roadmap-current">
                <span className="lp-roadmap-point" />
                <span className="lp-roadmap-status">Đã có trong ứng dụng</span>
                <h3>Nắm được mùa vụ</h3>
                <p>Vườn, lô, nhật ký, thu chi, quét ảnh và hỏi đáp có nguồn.</p>
                <Icon name="leaf" />
              </li>
              <li>
                <span className="lp-roadmap-point" />
                <span className="lp-roadmap-status">Định hướng tiếp theo</span>
                <h3>Chủ động việc chăm cây</h3>
                <p>
                  Nhắc việc theo giai đoạn, giúp nhà vườn theo sát kế hoạch chăm
                  sóc.
                </p>
                <Icon name="flower" />
              </li>
              <li>
                <span className="lp-roadmap-point" />
                <span className="lp-roadmap-status">Định hướng mở rộng</span>
                <h3>Kết nối cả vùng trồng</h3>
                <p>
                  So sánh nhiều mùa, cộng tác cùng kỹ thuật viên và hợp tác xã.
                </p>
                <Icon name="layers" />
              </li>
            </ol>
            <p className="lp-roadmap-note">
              Các bước tiếp theo là định hướng phát triển, sẽ điều chỉnh qua thử
              nghiệm thực tế với nhà vườn.
            </p>
            <div className="lp-business" data-reveal="flow">
              <div>
                <span className="lp-detail-label">
                  Định hướng thương mại hóa
                </span>
                <h3>
                  Giá trị theo mùa.
                  <br />
                  Đồng hành theo quy mô.
                </h3>
              </div>
              <div className="lp-business-model">
                <span>
                  <Icon name="basket" />
                  <b>Theo mùa vụ</b>
                </span>
                <span className="lp-business-plus" aria-hidden="true">
                  +
                </span>
                <span>
                  <Icon name="layers" />
                  <b>Theo quy mô vườn</b>
                </span>
                <p>
                  Dự kiến thu phí dịch vụ theo mùa vụ và quy mô vườn, gắn với
                  nhu cầu quản lý thực tế.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="lp-container lp-section lp-download"
          id="tai-ung-dung"
          aria-labelledby="download-heading"
        >
          <div>
            <img
              className="lp-download-icon"
              src="/landing/app-icon.webp"
              width="76"
              height="76"
              alt="Biểu tượng Sầu Riêng AI"
            />
            <h2 id="download-heading">
              Hẹn gặp bạn
              <br />
              ngay tại vườn.
            </h2>
            <p>
              Sầu Riêng AI đang chuẩn bị phát hành.
              <br />
              Link tải sẽ được cập nhật tại đây.
            </p>
            <a className="lp-text-link" href="/support/">
              Liên hệ & hỗ trợ
              <Icon name="arrow" />
            </a>
          </div>
          <div
            className="lp-platforms"
            data-reveal="image"
            aria-label="Trạng thái phát hành"
          >
            <div>
              <Icon name="phone" />
              <span>
                <strong>Android</strong>
                <small>Đang chuẩn bị phát hành</small>
              </span>
              <Icon name="download" />
            </div>
            <div>
              <Icon name="phone" />
              <span>
                <strong>iOS</strong>
                <small>Đang chuẩn bị phát hành</small>
              </span>
              <Icon name="download" />
            </div>
            <p>Chưa có liên kết tải công khai.</p>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <a className="lp-brand" href="/">
            <img src="/landing/app-icon.webp" width="36" height="36" alt="" />
            <span>
              Sầu Riêng <b>AI</b>
            </span>
          </a>
          <p>Đồng hành trọn mùa sầu riêng.</p>
          <nav aria-label="Thông tin và hỗ trợ">
            <a href="/privacy/">Quyền riêng tư</a>
            <a href="/support/">Hỗ trợ</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
