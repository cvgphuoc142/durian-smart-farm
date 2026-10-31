const references = [
  {
    name: "Plantix",
    focus: "Sức khỏe cây qua ảnh",
    href: "https://plantix.net/en/",
  },
  {
    name: "mobiAgri",
    focus: "Tư vấn nông nghiệp đa cây",
    href: "https://solutions.mobifone.vn/vi/nen-tang-nong-nghiep-mobiagri",
  },
  {
    name: "FarmQA",
    focus: "Nhật ký đồng ruộng",
    href: "https://support.farmqa.com/hc/en-us/articles/360057061452-Field-Journals",
  },
];

export function ProductDifference() {
  return (
    <section
      className="lp-container lp-section lp-difference"
      id="khac-biet"
      aria-labelledby="difference-heading"
    >
      <div className="lp-section-head" data-reveal="heading">
        <h2 id="difference-heading">
          Chuyên cây sầu riêng.
          <br />
          Kết nối cả mùa vụ.
        </h2>
        <p>
          Điểm tập trung của Sầu Riêng AI: công việc, sức khỏe cây và dòng tiền
          cùng một mạch dữ liệu.
        </p>
      </div>
      <div className="lp-positioning">
        <div className="lp-reference-apps" data-reveal="list">
          <p className="lp-detail-label">Các hướng tiếp cận trên thị trường</p>
          {references.map((app) => (
            <a href={app.href} key={app.name} target="_blank" rel="noreferrer">
              <span>{app.name}</span>
              <strong>{app.focus}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <article className="lp-product-focus" data-reveal="image">
          <div className="lp-focus-brand">
            <img src="/landing/app-icon.webp" alt="" width="44" height="44" />
            <span>Sầu Riêng AI</span>
          </div>
          <h3>
            Một cây trồng.
            <br />
            Một mùa có ngữ cảnh.
          </h3>
          <dl>
            <div>
              <dt>Chuyên sâu sầu riêng</dt>
              <dd>Kiến thức và công việc theo từng chặng mùa vụ.</dd>
            </div>
            <div>
              <dt>Dữ liệu theo vườn · lô · vụ</dt>
              <dd>Gắn nhật ký, lần quét và khoản thu chi vào đúng nơi.</dd>
            </div>
            <div>
              <dt>AI trong việc nhà vườn</dt>
              <dd>
                Quét ảnh khi cần quan sát. Hỏi có nguồn khi cần hiểu thêm.
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <p className="lp-source-note">
        Tham chiếu định vị công khai từ các trang sản phẩm ở trên; các tính năng
        có thể giao nhau.
      </p>
      <div
        className="lp-season-data"
        aria-label="Mạch dữ liệu theo mùa vụ"
        data-reveal="flow"
      >
        <span>Vườn · lô · vụ</span>
        <span aria-hidden="true">→</span>
        <span>Chăm sóc · ca quét</span>
        <span aria-hidden="true">→</span>
        <span>Thu chi · xem lại</span>
      </div>
    </section>
  );
}

export function AiSpotlight() {
  return (
    <section
      className="lp-feature-section"
      id="tinh-nang"
      aria-labelledby="features-heading"
    >
      <div className="lp-container lp-section">
        <div className="lp-section-head" data-reveal="heading">
          <p className="lp-eyebrow">AI CÙNG NHÀ VƯỜN</p>
          <h2 id="features-heading">
            Quan sát rõ hơn.
            <br />
            Tra cứu có căn cứ.
          </h2>
          <p>Hai cách AI hỗ trợ trong một mùa sầu riêng.</p>
        </div>
        <div className="lp-ai-layout">
          <figure className="lp-ai-photo" data-reveal="image">
            <img
              src="/landing/season-recovery.webp"
              width="840"
              height="560"
              loading="lazy"
              alt="Minh họa nhà vườn dùng điện thoại khi quan sát cây sầu riêng"
            />
            <div className="lp-ai-scan" aria-hidden="true">
              <span />
            </div>
            <figcaption>
              Quan sát tại vườn. Lưu lại theo vụ.
              <small>Ảnh minh họa, không phải màn hình ứng dụng</small>
            </figcaption>
          </figure>
          <div className="lp-ai-lanes" data-reveal="list">
            <article>
              <span className="lp-ai-label">Quét ảnh trên thiết bị</span>
              <h3>Thấy dấu hiệu lạ? Chụp ảnh.</h3>
              <ol className="lp-ai-flow">
                <li>Ảnh lá, thân, trái</li>
                <li>AI hỗ trợ nhận diện</li>
                <li>Lưu kết quả theo vụ</li>
              </ol>
              <p>Quét được khi mất mạng, sau khi tải mô hình về điện thoại.</p>
            </article>
            <article>
              <span className="lp-ai-label">Hỏi đáp từ thư viện kiến thức</span>
              <h3>Cần hiểu thêm? Hỏi có nguồn.</h3>
              <ol className="lp-ai-flow">
                <li>Đặt câu hỏi</li>
                <li>AI tra cứu kiến thức</li>
                <li>Trả lời kèm nguồn</li>
              </ol>
              <p>
                Cần mạng và sự đồng ý của bạn. Mở nguồn để đọc và đối chiếu.
              </p>
            </article>
          </div>
        </div>
        <p className="lp-feature-note">
          AI hỗ trợ tham khảo. Nhà vườn đối chiếu hiện trạng và hỏi chuyên gia
          trước quyết định xử lý.
        </p>
      </div>
    </section>
  );
}
