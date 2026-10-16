# Brief App Quản lý Vườn Sầu Riêng — Draft v0.2

Oct 14, 2026 

Cập nhật theo bộ requirement chốt ngày 14/10/2026 trong `docs/` (scope, user stories, kiến trúc, ERD). Phạm vi cũ của v0.1 (tách theo cây, lịch nhắc, thông báo, bản đồ, mock AI) không còn áp dụng. Một điều chỉnh so với `docs/`: **đồng bộ offline chỉ dùng cho AI Scan** (xem mục 1).

## 1. Tổng quan

App mobile giúp hộ trồng sầu riêng quản lý vườn → lô → vụ, ghi nhật ký chăm sóc, chi phí, bán hàng và tiền nhận, theo dõi ca bệnh, **quét bệnh bằng model chạy offline trên máy**, tra cứu bài và tiêu chuẩn, hỏi chatbot có nguồn khi online, tự tick checklist tiêu chuẩn và mở danh bạ liên hệ. Đi kèm backend production và web admin riêng. Phiên bản bàn giao gồm **27 màn hình mobile**, **5 nhóm chức năng**, một web admin.

| Hạng mục | Nội dung |
| --- | --- |
| Hạn giao | **28/10/2026**; chốt phạm vi 14/10/2026. Chỉ có **một dev**, viết app mới. Đây là hạn chủ sản phẩm đặt ra, chưa phải ước lượng được chứng minh bằng tích hợp thực tế |
| Người dùng | Hộ nông dân (chủ yếu dùng **một điện thoại**, không khóa máy thứ hai) và Admin nội dung (web, Google OAuth, quyền cấp sẵn ở backend) |
| Nền tảng | Android + iOS bằng React Native (Expo) + TypeScript, cần dev build / native runtime để chạy model; dùng một tay ngoài trời |
| Ngôn ngữ | Việt (mặc định) / Anh cho cả app và admin; nội dung cốt lõi có bản Việt/Anh được duyệt |
| Đăng nhập | Google (cả hai nền tảng), Apple thêm trên iOS. Cùng Google thì khôi phục dữ liệu đã đồng bộ; Apple không tự gộp với Google |
| Giao bản | Build release **đã ký** cho dịch vụ nộp store (kèm ID, phiên bản, checksum, cách cài thử), backend + web admin production, kết quả chạy AC trên thiết bị thật. Dịch vụ nộp store lo listing, khai báo, nộp và xét duyệt |
| Thiết kế tham chiếu | Prototype v0.1 (21 artboard) thuộc phạm vi cũ, **chưa khớp** danh sách màn hình mục 2; cần cập nhật thiết kế |

**Quy tắc offline (điều chỉnh so với `docs/`):**

- **Offline có đồng bộ chỉ dành cho AI Scan.** Kết quả scan và ảnh được lưu bền trên máy (SQLite + outbox) kể cả khi mất mạng, rồi tự đồng bộ khi mở app / có mạng lại, với trạng thái `đã lưu trên máy → đang gửi → đã đồng bộ` hoặc lỗi. Không xóa ảnh/kết quả trước khi backend ack.
- **Mọi nghiệp vụ khác cần mạng để ghi**: vườn/lô/vụ, nhật ký, chi phí, bán hàng/thanh toán, ca bệnh (đóng/sửa), tick checklist, cài đặt. Không có outbox cho các thao tác này. Khi mất mạng, app báo rõ, giữ nội dung đang nhập để hộ gửi lại bằng tay, không tự gửi.
- **Đọc offline (không phải đồng bộ ghi)**: gói nội dung đã duyệt (bài, tiêu chuẩn/checklist, danh bạ) tải về và đọc/tìm được khi offline; danh sách vườn/lô/vụ và ca bệnh đang mở được lưu bản đọc để chọn khi lưu scan.
- Backend là bản gốc của dữ liệu **đã được xác nhận**; máy mới chỉ khôi phục phần đã lên backend. Scan chưa đồng bộ chỉ nằm ở máy cũ.

**Nguyên tắc chung:**

- Chatbot chỉ chạy khi online và có consent AI; trả lời theo bài đã duyệt, vườn/vụ và ca bệnh của đúng hộ, có citation tới đúng version. Offline chuyển sang tra cứu bài, giữ nháp, không tự gửi lại.
- Scan không có chẩn đoán chắc chắn: bốn trạng thái khỏe / nghi bệnh / chưa đủ cơ sở / lỗi. Không bịa kết quả, không gợi ý mua thuốc hay cửa hàng.
- Tiêu chuẩn chỉ hỗ trợ **tự kiểm**, không kết luận "đạt xuất khẩu".
- Tiền: VND `numeric(18,2)`, kg `numeric(12,3)`, tính bằng decimal, làm tròn half-up đến 0,01 VND, không dùng float. `null` là chưa biết, khác 0.

**Ngoài phạm vi:** quản lý từng cây, tồn kho, lương, vay, khấu hao, tự phân bổ chi chung, đối soát ngân hàng; lịch nhắc / thông báo tự động; chẩn đoán chắc chắn, API quản lý / phân phối / OTA model (model mới đi theo build mới); duyệt web tự do, LLM offline, lịch sử chat trên server; tự chứng nhận đủ điều kiện xuất khẩu, kiểm nghiệm, tính điểm tuân thủ; booking, tư vấn trong app, đánh giá sao, mua bán; phân quyền nhiều vai trò trong một vườn; khóa thiết bị hoặc tự gộp thay đổi hai máy; bản đồ.

## 2. Số lượng màn hình

Tổng **27 màn hình mobile**: 5 tab gốc, 2 màn thiết lập, 16 màn stack, 4 modal / sheet. Web admin là sản phẩm riêng, không tính ở đây. Ngoài ra cần các component dùng chung (bottom sheet chọn vườn/lô/vụ, date picker, dialog xác nhận, empty/error state, huy hiệu trạng thái đồng bộ, toast) chưa tính là màn hình. Độ phức tạp: S = tĩnh/form ngắn, M = list + filter + state, L = nhiều trạng thái, camera/model, chatbot hoặc tính toán tiền.

Danh sách màn hình được suy ra từ user stories US-01…US-12 để estimate; cần chốt lại khi có thiết kế.

| Mã | Màn hình | Nhóm | Loại | Độ phức tạp | Thành phần chính |
| --- | --- | --- | --- | --- | --- |
| SC-01 | Ngôn ngữ & đăng nhập | X | Stack (thiết lập) | S | Chọn Việt/Anh, Google, Apple (iOS), xử lý lỗi Auth không mất dữ liệu đang nhập |
| SC-02 | Tạo vườn → lô → vụ | X, A | Stack (thiết lập) | M | Chỉ bắt tên vườn, tên lô, tên vụ, ngày bắt đầu, giai đoạn; chi tiết khác bổ sung sau; hoặc tải lại dữ liệu đã đồng bộ |
| SC-03 | Tổng quan vụ | A | Tab 1 | L | Chọn vườn/lô/vụ, giai đoạn, ngày thu hoạch dự kiến, chi đã ghi, bán đã chốt, tiền nhận ròng, phải thu / cần hoàn, lãi theo số đã ghi, 3 số dự kiến cả vụ, lối vào bán hàng / sổ chi / Scan |
| SC-04 | Quản lý vườn, lô, vụ | A | Stack | M | Danh sách + sửa vườn / lô / vụ, đổi giai đoạn thủ công, đóng vụ |
| SC-05 | Sổ chi | A | Stack | M | Danh sách khoản chi, lọc theo ngày / nhóm / nguồn, tổng; khoản chi liên kết nhật ký có dấu hiệu |
| SC-06 | Thêm / sửa khoản chi | A | Modal | S | Ngày, nhóm (6), số tiền, ghi chú; sửa khoản chi từ nhật ký cập nhật cùng bản ghi |
| SC-07 | Bán hàng & công nợ | A | Stack | M | Danh sách lần bán, trạng thái provisional / confirmed / cancelled, phải thu, cần hoàn, lọc |
| SC-08 | Chi tiết lần bán | A | Stack | L | Người mua, tổng, kg tùy chọn, lịch sử cọc / nhận / hoàn, số dư, hủy / chốt |
| SC-09 | Thêm / sửa lần bán & thanh toán | A | Modal | M | Người mua, ngày, trạng thái, tổng (có thể chưa biết), cọc / nhận / hoàn, hiện tác động lên số dư |
| SC-10 | Nhật ký chăm sóc | A | Tab 2 | M | Danh sách theo ngày / loại, lọc theo lô / vụ, ca bệnh liên quan |
| SC-11 | Thêm / sửa nhật ký | A | Modal | M | Loại (7), ngày, vật tư + lượng, ghi chú, ảnh, tùy chọn một khoản chi, gắn ca bệnh; xóa có cảnh báo chi đi kèm |
| SC-12 | Quét ảnh | B | Tab 3 (full screen) | L | Camera / thư viện (một ảnh), chọn bộ phận theo manifest, đổi ảnh / bộ phận trước khi chạy, chạy model local, lối vào lịch sử |
| SC-13 | Kết quả Scan | B | Stack | M | Khỏe / nghi bệnh / chưa đủ cơ sở / lỗi, nhãn + điểm mô hình, bài liên quan hoặc "chưa có bài liên quan", cảnh báo chỉ tham khảo |
| SC-14 | Lưu scan | B | Stack | M | Chọn vụ khi lưu (tạo nhanh nếu chưa có), lưu lịch sử hoặc tạo / gắn ca, trạng thái đồng bộ |
| SC-15 | Ca bệnh & lịch sử scan | B | Stack | M | Danh sách ca mở / đã đóng, scan theo thời gian, lọc theo vụ |
| SC-16 | Chi tiết ca bệnh | B | Stack | M | Timeline scan (ảnh, bộ phận, model / version), nhật ký xử lý, chi xử lý, hộ tự đóng ca |
| SC-17 | Tra cứu (Kiến thức) | C | Tab 4 | M | Tìm Việt / Anh có / không dấu, lọc bệnh / bộ phận / giai đoạn, trạng thái trống, lối vào Chatbot và Tiêu chuẩn |
| SC-18 | Chi tiết bài | C | Stack | S | Nội dung, nguồn, ngày phiên bản, nhãn ngôn ngữ / bản gốc, "chưa có trên thiết bị" khi chưa tải |
| SC-19 | Chatbot | C | Stack | L | Chat, citation mở đúng bản, `context_as_of`, cảnh báo dữ liệu local chưa lên server, banner offline / chưa consent, nháp, thử lại thủ công |
| SC-20 | Báo cáo câu trả lời | C | Sheet | S | Xem trước phần sẽ gửi (câu hỏi / trả lời / citation), lý do, xác nhận gửi |
| SC-21 | Tiêu chuẩn & checklist | D | Stack | L | Hồ sơ Trung Quốc / EU (sầu riêng tươi), nguồn + ngày hiệu lực, tick theo vụ + phiên bản, "đã tự đánh dấu N/M", xem bản cũ |
| SC-22 | Khác | X | Tab 5 | S | Menu: Danh bạ, Cài đặt, Đồng bộ, Tài khoản |
| SC-23 | Danh bạ | E | Stack | M | Nhà thuốc / vật tư và chuyên gia, tìm, lọc loại / khu vực |
| SC-24 | Chi tiết liên hệ | E | Stack | S | Mô tả / chuyên môn, địa bàn, gọi hoặc mở link, nguồn / ngày xác minh |
| SC-25 | Cài đặt | X | Stack | M | Ngôn ngữ, consent AI (cấp / rút), policy, hỗ trợ, làm mới gói nội dung |
| SC-26 | Trạng thái đồng bộ Scan | X, B | Stack | S | Scan chờ gửi / đang gửi / đã đồng bộ / lỗi, thử lại, xem ảnh local |
| SC-27 | Tài khoản & xóa tài khoản | X | Stack | M | Đăng xuất / đổi tài khoản (cảnh báo scan chưa sync), xóa tài khoản trong app, đường yêu cầu xóa ngoài app |

Tổng hợp: **27 màn** gồm 7 S · 15 M · 5 L.

## 3. Navigation

App dùng **bottom tab 5 mục**: Tổng quan, Nhật ký, Scan, Tra cứu, Khác. Scan nằm giữa và mở toàn màn hình. Mỗi tab có stack riêng; các form nhập liệu là modal. Giữ vườn / lô / vụ đang chọn khi chuyển màn; hỏi xác nhận nếu đổi vụ khi form có nội dung chưa lưu.

```text
RootStack
├── SetupStack (chưa đăng nhập hoặc chưa có vườn)
│   └── SC-01 Đăng nhập → SC-02 Tạo vườn / lô / vụ
├── MainTabs
│   ├── Tổng quan : SC-03 → SC-04 Quản lý vườn/lô/vụ
│   │                      → SC-05 Sổ chi
│   │                      → SC-07 Bán hàng → SC-08 Chi tiết lần bán
│   ├── Nhật ký   : SC-10
│   ├── Scan      : SC-12 → SC-13 → SC-14 → SC-15 → SC-16   (full screen)
│   ├── Tra cứu   : SC-17 → SC-18 Bài
│   │                      → SC-19 Chatbot
│   │                      → SC-21 Tiêu chuẩn & checklist
│   └── Khác      : SC-22 → SC-23 Danh bạ → SC-24
│                          → SC-25 Cài đặt, SC-26 Đồng bộ Scan, SC-27 Tài khoản
└── Modals
    ├── SC-06 Thêm / sửa chi, SC-09 Bán hàng / thanh toán, SC-11 Nhật ký
    ├── SC-20 Báo cáo câu trả lời (sheet)
    └── Bottom sheet chọn vườn / lô / vụ
```

Chuỗi chính: Scan → Kết quả → Lưu (vụ / ca) → Chi tiết ca; Kết quả → Chi tiết bài; Chatbot → citation → Chi tiết bài; Tra cứu → Tiêu chuẩn → tick. Back cứng (Android) ở form chưa lưu: hỏi xác nhận trước khi thoát. Không có deep link từ push vì phạm vi không có thông báo.

## 4. Danh sách chức năng

Tổng **58 chức năng mobile** chia 6 nhóm, cộng **7 chức năng web admin**. Phạm vi mới không chia P1/P2/P3: mọi chức năng dưới đây đều phải chạy trong build bàn giao 28/10. Cột AC trỏ tới ma trận nghiệm thu ở mục 5; cột Màn hình trỏ về mã ở mục 2. Mục "(chỉ online)" là điều chỉnh offline ở mục 1.

### X. Chung (tài khoản, thiết lập, đồng bộ, nội dung)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-X01 | Đăng nhập | Google (cả hai nền tảng), Apple trên iOS; lần đầu cần mạng; Auth lỗi không mất nội dung đang nhập | SC-01 | 17 |
| FR-X02 | Đa ngôn ngữ | Việt / Anh toàn UI, form, lỗi, trạng thái sync; đổi được khi offline; đổi locale không đổi ID, tiền, ghi chú, tick | SC-01, SC-25 | 21, 22 |
| FR-X03 | Thiết lập ban đầu | Tạo vườn → lô → vụ với trường tối thiểu; cho mở vụ giữa mùa | SC-02 | 1 |
| FR-X04 | Khôi phục máy mới | Đăng nhập lại cùng Google, tải snapshot dữ liệu đã đồng bộ (gồm tombstone); Apple không tự gộp với Google | SC-01, SC-02 | 17 |
| FR-X05 | Xử lý mất mạng (chỉ online) | Banner mất mạng; thao tác cần mạng báo rõ; giữ nội dung đang nhập trong app để hộ gửi lại bằng tay; không tự gửi lại | tất cả form | 14 |
| FR-X06 | Đồng bộ offline cho Scan | SQLite + outbox chỉ cho scan: copy ảnh vào thư mục bền trước khi báo đã lưu, `mutation_id` + payload, gửi theo phụ thuộc cha / con, bỏ outbox khi có ack; hiển thị 4 trạng thái | SC-14, SC-26 | 8, 9, 10 |
| FR-X07 | Idempotency và xung đột | Mutation retry cùng ID + payload trả ack cũ; cùng ID khác payload bị từ chối; ghi online có `expected_revision`, hai máy sửa cùng bản ghi từ một revision thì mutation đến sau nhận `409`, app tải lại bản server để hộ nhập lại; không khóa máy thứ hai | tất cả form | 9 |
| FR-X08 | Consent AI | Cấp / rút đồng ý dùng dịch vụ AI ngoài hệ thống; backend kiểm trước khi gọi LLM | SC-25, SC-19 | 14 |
| FR-X09 | Chính sách, hỗ trợ, xóa tài khoản | Mở policy / support URL; xóa tài khoản trong app (hiện số scan chờ sync, thu hồi session, xóa dữ liệu / ảnh, hủy outbox) và đường yêu cầu xóa ngoài app | SC-25, SC-27 | 18, 19 |
| FR-X10 | Đăng xuất / đổi tài khoản | Cảnh báo nếu còn scan chưa sync: thử sync hoặc xác nhận bỏ; cache và namespace tách theo tài khoản | SC-27 | 18 |
| FR-X11 | Gói nội dung offline | Kiểm manifest khi mở app / có mạng / quay foreground nếu quá 24 giờ hoặc khi làm mới; tải text Việt + Anh + FTS vào staging, kiểm hash rồi chuyển nguyên gói; tải lỗi giữ gói cũ; không tải nền khi app đã tắt | SC-17, SC-25 | 7, 15, 25 |

### A. Vườn, lô, vụ và tài chính (chỉ online)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-A01 | CRUD vườn, lô | Vườn: tên (bắt buộc), tỉnh, địa danh; lô: tên duy nhất trong vườn, giống, diện tích, số cây, năm trồng (tùy chọn); không bắt GPS, không quản lý từng cây | SC-02, SC-04 | 1 |
| FR-A02 | Vụ | Tạo / sửa / đóng vụ; tối đa một vụ mở mỗi lô; giai đoạn đổi thủ công: phục hồi, xử lý ra hoa, ra hoa / đậu quả, nuôi quả, thu hoạch; ngày thu hoạch dự kiến | SC-02, SC-04 | 1 |
| FR-A03 | Ngữ cảnh đang chọn | Chọn vườn / lô / vụ qua bottom sheet, giữ khi chuyển màn, tổng chỉ tính trong tập vụ chọn | SC-03 | 1 |
| FR-A04 | Tổng quan vụ | Chi đã ghi, giá trị bán đã chốt, tiền nhận ròng, phải thu / cần hoàn, lãi theo số đã ghi; nhãn "chưa có dự kiến / chưa chốt" khi thiếu dữ liệu; không phần trăm sinh trưởng giả | SC-03 | 1, 3–6 |
| FR-A05 | Dự kiến cả vụ | Nhập / sửa 3 số: sản lượng, giá, tổng chi dự kiến; đứng riêng với số thực tế; thiếu đầu vào thì kết quả là chưa biết | SC-03 | 5 |
| FR-A06 | CRUD nhật ký chăm sóc | Loại: tưới, bón, phun, tỉa, thăm vườn, xử lý, khác; ngày, ghi chú; ngày và vụ lấy từ ngữ cảnh nhưng cho sửa | SC-10, SC-11 | 2 |
| FR-A07 | Vật tư đã dùng | Bón / phun cần ít nhất tên vật tư; số lượng + đơn vị đi cùng nhau khi có; hoạt chất tùy chọn | SC-11 | 2 |
| FR-A08 | Chi gắn nhật ký | Tùy chọn đúng một khoản chi; sửa ở sổ chi hay nhật ký đều cập nhật cùng bản ghi, chỉ tính một lần | SC-11, SC-05 | 2 |
| FR-A09 | Ảnh nhật ký | Đính kèm ảnh, nén rồi upload (private) | SC-11 | 10 |
| FR-A10 | Xóa nhật ký có chi | Xác nhận nêu rõ khoản chi đi kèm cũng bị xóa; xóa cả hai trong một mutation | SC-11 | 2 |
| FR-A11 | Khoản chi độc lập | CRUD; nhóm: phân bón, thuốc BVTV, nhân công, điện / nước tưới, thu hoạch / vận chuyển, khác; số tiền > 0 | SC-05, SC-06 | 2 |
| FR-A12 | Bán hàng | Lần bán với người mua, ngày, kg tùy chọn; trạng thái provisional / confirmed / cancelled; chốt tổng thấp hơn cọc, hủy; chỉ sale confirmed tạo giá trị bán | SC-07, SC-08, SC-09 | 3, 4 |
| FR-A13 | Thanh toán | Cọc / nhận thêm / hoàn thủ công; hoàn không vượt cọc + nhận của cùng lần bán; sửa hoặc xóa khoản nhập nhầm; sale đã có thanh toán không xóa lặng lẽ | SC-08, SC-09 | 3, 4 |
| FR-A14 | Công nợ và tính tiền | Phải thu / cần hoàn theo từng sale, không cấn trừ khác người mua; decimal half-up, JSON dùng chuỗi decimal; cùng quy tắc ở app và backend | SC-03, SC-07, SC-08 | 3, 5 |
| FR-A15 | Vụ đóng | Vẫn sửa sai và nhận tiền nợ cũ; vụ mới không kế thừa nợ | SC-04, SC-08 | 6 |
| FR-A16 | Lọc lịch sử | Lọc chi / nhật ký / bán hàng theo vụ, ngày, nhóm | SC-05, SC-07, SC-10 | 1 |

### B. AI Scan và tiến trình bệnh

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-B01 | Chụp / chọn ảnh | **Một ảnh mỗi lần**; camera in-app hoặc thư viện; cho đổi ảnh / bộ phận trước khi chạy | SC-12 | 7 |
| FR-B02 | Chọn bộ phận | Chỉ liệt kê bộ phận có pipeline hoàn chỉnh trong manifest | SC-12 | 11 |
| FR-B03 | Suy luận offline thật | Manifest nhiều entry (model, version, bộ phận, runtime, tiền xử lý, class map, ngưỡng); model router + adapter chọn pipeline theo bộ phận; chạy local, không cần mạng; đề xuất ONNX Runtime React Native | SC-12 | 7, 11 |
| FR-B04 | Kết quả | Bốn trạng thái: khỏe / nghi bệnh / chưa đủ cơ sở / lỗi; nhãn "nghi ngờ" + điểm mô hình khi hợp lệ, không gọi là xác suất chẩn đoán chắc chắn; nhãn không map hoặc lỗi runtime không bịa bệnh | SC-13 | 11 |
| FR-B05 | Bài liên quan | Hiện bài đã duyệt khớp bệnh / bộ phận; chưa có thì báo "chưa có bài liên quan"; không gợi ý mua thuốc hay cửa hàng | SC-13 | 7 |
| FR-B06 | Lưu scan vào vụ | Chọn vụ khi lưu; chưa có vụ thì tạo nhanh rồi quay lại với ảnh / kết quả còn nguyên (khi offline: giữ nháp scan, chọn vụ khi có mạng); kết quả khỏe không ép mở ca | SC-14 | 12 |
| FR-B07 | Tạo / gắn ca bệnh | Tạo ca mới hoặc gắn ca đang mở cùng vụ | SC-14 | 12 |
| FR-B08 | Timeline ca | Scan theo thời gian (ảnh, bộ phận, model / version, ghi chú), nhật ký xử lý, chi xử lý chỉ ở sổ chi vụ một lần; hộ tự đóng ca, AI không tự đóng | SC-16 | 12 |
| FR-B09 | Lịch sử scan | Danh sách ca và scan theo vụ | SC-15 | 12 |
| FR-B10 | Lưu scan offline | Scan + ảnh lưu bền, đồng bộ về sau (FR-X06); ảnh upload gián đoạn thì mở lại gửi tiếp cùng asset; "đã đồng bộ" khi metadata **và ảnh** được xác nhận | SC-14, SC-26 | 8, 10 |
| FR-B11 | Snapshot bất biến | Lưu model / pipeline / threshold version, điểm 0–1, nhãn + locale lúc quét; đổi model về sau không chạy lại lịch sử; lỗi runtime chỉ là trạng thái UI để thử lại, không tạo scan đã đồng bộ | SC-13, SC-14 | 11 |

### C. Kiến thức và chatbot

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-C01 | Tìm bài | Full-text Việt / Anh (tiếng Việt có / không dấu) trên gói đã tải; lọc bệnh, bộ phận, giai đoạn | SC-17 | 7 |
| FR-C02 | Đọc bài | Nội dung, nguồn, ngày phiên bản, nhãn ngôn ngữ; thiếu bản dịch thì hiện bản gốc của **đúng version** kèm báo ngôn ngữ | SC-18 | 23 |
| FR-C03 | Đọc offline | Bài đã tải đọc và tìm được khi offline; chưa tải thì hiện "chưa có trên thiết bị", chưa có bài duyệt thì hiện trạng thái trống | SC-17, SC-18 | 7 |
| FR-C04 | Chatbot RAG | Online, trả lời theo bài đã publish, snapshot vườn / vụ và ca bệnh đúng owner, `POST /v1/chat`; chỉ dùng dữ liệu đã đồng bộ, nêu `context_as_of` do server tính; không ghi dữ liệu hộ qua chat | SC-19 | 13 |
| FR-C05 | Citation | Mỗi câu trả lời kèm nguồn: source, version, translation revision; mở đúng text đã dùng; ghi rõ ngôn ngữ nguồn khác ngôn ngữ hỏi | SC-19 | 13, 24 |
| FR-C06 | Khi thiếu căn cứ | Nói thiếu thông tin, dẫn bài thích hợp; báo rõ khi snapshot cũ | SC-19 | 13 |
| FR-C07 | Offline / chưa consent | Chuyển ô hỏi sang tìm bài đã tải; câu hỏi chưa gửi là nháp, không tự gửi lại; không gửi ra LLM ngoài khi chưa / rút consent | SC-19 | 14 |
| FR-C08 | Lỗi và giới hạn | 429 / 503 có mã retryable; thử lại do người dùng bấm, không tự tạo thêm request LLM | SC-19 | 14 |
| FR-C09 | Báo cáo câu trả lời | Xem trước phần sẽ gửi, xác nhận mới gửi; một lần báo cáo tạo một report; không gửi toàn bộ chat hay hồ sơ vườn | SC-20 | 20 |
| FR-C10 | Bảo vệ ngữ cảnh | Text bài, câu hỏi, ghi chú của hộ là dữ liệu nguồn, không đổi chỉ dẫn hệ thống hay phạm vi quyền; không gửi token, email, ảnh gốc | SC-19 | 13, 14 |

### D. Tiêu chuẩn và checklist

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-D01 | Hồ sơ thị trường | Hai hồ sơ bắt buộc: `CN/fresh` và `EU/fresh` cho sầu riêng **tươi**; nguồn chính thức và ngày hiệu lực nếu có | SC-21 | 15 |
| FR-D02 | Checklist tự tick (chỉ online) | Tick theo `vụ + phiên bản tiêu chuẩn`, locale không nằm trong khóa tick; ghi tick cần mạng | SC-21 | 16, 22 |
| FR-D03 | Hiển thị tiến độ | "Đã tự đánh dấu N/M"; không có "đạt xuất khẩu" hay điểm tuân thủ | SC-21 | 16 |
| FR-D04 | Phiên bản | Bản mới mở bảng chưa tick; tick v1 giữ ở v1, bản cũ vẫn xem được; sửa riêng bản dịch giữ item ID và tick | SC-21 | 16, 25 |
| FR-D05 | Nội dung và trạng thái trống | Mỗi mục có nguồn áp dụng đúng thị trường / dạng hàng và ngày kiểm tra nguồn; không dùng điều kiện hàng đông lạnh; EU không đưa giấy chứng nhận kiểm dịch thực vật thành điều kiện chung; danh mục chưa có mục được duyệt hiện trạng thái trống, không dữ liệu giả | SC-21 | 15 |
| FR-D06 | Xem offline | Hồ sơ và checklist đã tải xem được khi offline (chỉ đọc) | SC-21 | 7 |

### E. Danh bạ

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | AC |
| --- | --- | --- | --- | --- |
| FR-E01 | Danh sách | Nhà thuốc / vật tư và chuyên gia; tên, địa bàn, mô tả / chuyên môn; tìm, lọc loại / khu vực | SC-23 | 15 |
| FR-E02 | Liên hệ | Mở gọi (`tel:`) hoặc link; mỗi liên hệ có ít nhất một kênh; nguồn / ngày xác minh nếu có | SC-24 | 15 |
| FR-E03 | Xem offline | Bản đã tải xem được khi offline; hành động gọi / link phụ thuộc kết nối và app ngoài; chưa có liên hệ duyệt thì hiện trạng thái trống | SC-23, SC-24 | 7 |
| FR-E04 | Ranh giới | Không booking, tư vấn trong app, đánh giá sao, mua bán; không liên kết kết quả Scan với cửa hàng | SC-13, SC-23 | 7 |

### F. Web admin (sản phẩm riêng, Việt / Anh)

| Mã | Chức năng | Mô tả / tiêu chí | AC |
| --- | --- | --- | --- |
| FR-F01 | Đăng nhập admin | Google OAuth; quyền kiểm ở server qua `admin_member`; user thường bị từ chối API admin | 17 |
| FR-F02 | Bài kiến thức | Soạn nháp bài sầu riêng / bệnh, nguồn, nhãn bộ phận / giai đoạn; bản Việt / Anh; xem trước, duyệt, publish / unpublish; sửa nguồn tạo version, sửa dịch tạo translation revision | 15, 25 |
| FR-F03 | Tiêu chuẩn | Hồ sơ CN / EU, nguồn, ngày hiệu lực, mục checklist; chỉ publish bản dịch đủ mọi item | 15, 23 |
| FR-F04 | Danh bạ | Quản lý liên hệ, bản dịch mô tả, xác minh trước phát hành | 15 |
| FR-F05 | Release và index | Publish dựng index + gói release rồi chuyển pointer; index lỗi giữ bản cũ và cho retry; unpublish gỡ khỏi RAG mới ngay | 15 |
| FR-F06 | Báo cáo chatbot | Chỉ thấy đoạn hộ đã xác nhận gửi; cập nhật trạng thái; không đọc toàn bộ chat hay dữ liệu hộ | 20 |
| FR-F07 | Job hằng ngày | Đối soát / retry bản đã duyệt; không tự crawl quy định mới | 15 |

## 5. Yêu cầu phi chức năng và nghiệm thu

**Nghiệm thu:** 25 tình huống AC-01…AC-25 trong `docs/durianos-scope.md` phải qua trên bản tích hợp, chạy trên **thiết bị thật** Android và iOS. Ưu tiên chặn phát hành: mất / trùng tiền hoặc bản ghi khi retry, lộ dữ liệu chéo hộ, Scan giả / lỗi, checklist trộn version, citation sai nguồn.

Các AC chịu ảnh hưởng của quy tắc "offline chỉ cho Scan":

- **AC-08** (offline ghi / sửa chi, ca bệnh, sale / payment, tick) thu hẹp thành: offline lưu scan (kèm ca mới nếu tạo cùng lúc), tắt / mở app còn đủ, reconnect tự sync không mất / trùng. Các thao tác còn lại phải báo cần mạng và không mất nội dung đang nhập.
- **AC-09** (mất ack rồi retry, xung đột): áp dụng cho sync scan và các ghi online; hai máy sửa cùng bản ghi từ một revision nhận `409`. Scan là snapshot bất biến nên không có xung đột sửa.
- **AC-07** giữ nguyên ý: airplane mode vẫn Scan bằng model thật, mở / tìm bài, xem hồ sơ / checklist và liên hệ đã tải (chỉ đọc).

| Nhóm | Yêu cầu |
| --- | --- |
| Dữ liệu & mất mạng | Server là nguồn gốc dữ liệu đã xác nhận; ghi nghiệp vụ qua API (React Query: retry, refetch khi có mạng); SQLite chỉ gồm outbox Scan, ảnh scan local, bản đọc vườn / lô / vụ / ca đang mở và gói nội dung + FTS |
| AI on-device | Model **thật**, chạy offline cho mọi bộ phận công bố hỗ trợ, khớp bộ ảnh / output đối chiếu trên cả hai nền tảng; model đóng gói trong build, cập nhật bằng build mới; ngưỡng, class map, tiền xử lý lấy từ manifest. Bên cung cấp model bàn giao file nhiều model, checksum, kích thước, quyền phân phối, input / output tensor, ảnh và output tham chiếu; dev có thể code router / adapter trước nhưng **chỉ nghiệm thu Scan bằng model thật** |
| Ảnh | Nén trước khi lưu / upload; copy vào thư mục bền trước khi báo đã lưu; upload prepare / complete theo ID + hash cố định, retry cùng asset; ảnh private theo owner |
| Tiền | `numeric(18,2)` VND và đơn giá, `numeric(12,3)` kg, decimal half-up 0,01 VND; ví dụ 1,005 kg × 1,00 VND/kg = 1,01 VND ở cả app và backend |
| Bảo mật & riêng tư | Mọi API và RLS kiểm owner qua chuỗi FK, không tin `owner_id` từ client; ảnh private; token lưu secure storage, không ghi vào SQLite hay log; khóa LLM chỉ ở server; consent kiểm ở backend; đổi tài khoản không lộ cache; admin không mặc định đọc tài chính / ảnh hộ |
| Nội dung | Dev biên soạn tập đầu từ nguồn chính thức; chủ sản phẩm / admin duyệt Việt / Anh trước phát hành; **không đặt chỉ tiêu số bài, liên hệ, mục checklist**; gói nội dung có version / hash, chuyển nguyên vẹn |
| UX ngoài trời | Touch target ≥ 44 px, chữ thân ≥ 15 px, tương phản cao, thao tác chính dùng được một tay; vùng chạm và nhãn rõ |
| Lỗi API | Trả `request_id`, `code`, `retryable`, field path; phân biệt 401, 403, 409, 422, 429, 503; UI tự dịch; không đưa stack / secret ra client |
| Hỗ trợ thiết bị | Android 8+ và iOS 15+ (đề xuất, cần chốt); đo model trên một máy thật mỗi nền tảng |
| Theo dõi | Crash reporting, analytics sự kiện chính (scan, lưu scan, sync lỗi) |

Các con số hiệu năng và phiên bản OS là mục tiêu đề xuất để estimate, chưa được chốt.

## 6. Mô hình dữ liệu chính

Phía server có **32 bảng** (11 bảng dữ liệu hộ, 21 bảng nội dung / vận hành) cộng `AUTH_USER` (subject từ Auth, không dùng email làm khóa). Đây là thiết kế trước migration, chưa phải schema đã chạy; chi tiết khóa và ràng buộc xem `docs/durianos-erd.md`. Bảng nghiệp vụ hộ có `id uuid` tạo trên máy, `created_at`, `updated_at`, `revision`, `deleted_at` (tombstone). Không có bảng `tree`, `model`, `notification`, `inventory`.

| Nhóm | Bảng | Trường / ghi chú chính | Màn hình |
| --- | --- | --- | --- |
| Vườn | `farm`, `plot`, `season` | farm: name, province, locality\_text; plot: name, variety, area\_ha, tree\_count, planted\_year; season: name, started\_on, stage, expected\_harvest\_on, closed\_on, 3 trường forecast\_* | SC-02–04 |
| Chăm sóc | `care_log`, `care_input` | kind, occurred\_on, note, case\_id, photo\_id; vật tư: product\_name, amount, unit, active\_ingredient | SC-10, SC-11 |
| Tiền | `expense`, `sale`, `sale_payment` | expense: category, amount\_vnd, care\_log\_id (unique, null nếu độc lập); sale: status, total\_vnd, weight\_kg; payment: kind (deposit / receipt / refund), amount\_vnd | SC-03, SC-05–09 |
| Bệnh & Scan | `disease_case`, `scan`, `media_asset` | case: opened\_at, closed\_at; scan: plant\_part, outcome, disease\_code, score 0–1, label\_snapshot, predictions, inference\_metadata (model / pipeline version); media: object\_key, sha256, status | SC-12–16 |
| Danh mục bệnh | `disease`, `disease_translation` | code ổn định, ánh xạ nhãn model; tên theo locale | SC-13 |
| Kiến thức | `knowledge_article`, `article_version`, `article_translation`, `knowledge_chunk` | version bất biến sau publish, bản dịch theo revision, chunk + embedding (pgvector) cho RAG | SC-17–19 |
| Tiêu chuẩn | `standard_profile`, `standard_profile_translation`, `standard_version`, `standard_item`, `standard_translation`, `standard_item_translation` | market\_code + product\_form\_code (`CN/fresh`, `EU/fresh`), item có source\_link và source\_checked\_at | SC-21 |
| Tự kiểm | `self_check`, `self_check_answer` | unique (season, standard\_version); answer: checked, checked\_at | SC-21 |
| Danh bạ | `directory_contact`, `directory_contact_translation` | kind store / expert, phone / zalo / contact\_url, verified\_at | SC-23, SC-24 |
| Vận hành | `content_release`, `admin_member`, `user_preferences`, `chat_report`, `mutation_receipt` | release manifest + checksum; locale, ai\_consent\_version; report chỉ phần hộ xác nhận; receipt `(user_id, mutation_id)` + payload\_hash cho idempotency | SC-25, SC-19 |

**Chỉ số tính, không lưu:** chi đã ghi = tổng expense; giá trị bán = tổng `total_vnd` của sale confirmed; tiền nhận ròng = cọc + nhận − hoàn; lãi theo số đã ghi = giá trị bán − chi; phải thu = `max(total − tiền nhận ròng, 0)`; cần hoàn = `max(tiền nhận ròng − total, 0)` (sale cancelled: `max(tiền nhận ròng, 0)`). Cọc / tiền nhận không tăng doanh thu.

**SQLite trên máy** (thiết bị, không phải bảng backend): `outbox` chỉ cho mutation Scan (`mutation_id`, owner, payload, expected\_revision, state), ảnh scan local, bản đọc farm / plot / season / ca đang mở, gói nội dung + FTS Việt / Anh. Tài khoản mới dùng namespace / cache riêng.

## 7. Kiến trúc, src base và câu hỏi mở

**Kiến trúc đề xuất** (chưa phải bằng chứng hạ tầng đã chạy):

| Thành phần | Lựa chọn |
| --- | --- |
| App | React Native (Expo) + TypeScript, dev build; SQLite cục bộ cho Scan + cache đọc; model router + model theo bộ phận |
| Backend | Supabase Postgres / Auth / Storage + một lớp API server / RPC nhất quán (owner, FK, revision, idempotency, tính tiền); UI không ghi thẳng bảng |
| Web admin | React / TypeScript riêng, cùng Auth, API admin có role phía server |
| RAG | `pgvector` trong Postgres, LLM / embedding API phía server, không thêm vector DB riêng; không embedding dữ liệu hộ vào index chung |
| Content release | Publish bằng transaction đổi pointer; manifest + hash; job ngày chỉ đối soát / retry |

**Biên API:** Identity (`GET /v1/me`, `PUT /v1/me/ai-consent`, `DELETE /v1/me`); dữ liệu hộ (`GET /v1/snapshot`, mutation ghi có ack, revision / 409, tombstone; `POST /v1/sync` dùng cho mutation Scan); ảnh (`POST /v1/media/prepare`, `/complete`); nội dung (`GET /v1/content/manifest`, `GET /v1/content/releases/{release}`); AI (`POST /v1/chat`, `POST /v1/chat/reports`); admin (`/v1/admin/...`).

**Cấu trúc src đề xuất** (mẫu chuẩn của team + `ai`, `services`, `i18n`, `theme`, `db`, `sync`, `content`):

```text
durianMobile/
├── src/
│   ├── components/       # Component tái sử dụng
│   │   ├── ui/           # Button, Card, Chip, Tabs, BottomSheet, EmptyState, Toast, SyncBadge
│   │   └── domain/       # ExpenseRow, SaleCard, ScanResultCard, CaseTimelineItem, ChecklistItem…
│   ├── screens/          # Màn hình, chia theo nhóm (khớp mã SC)
│   │   ├── setup/        # SC-01 SignIn, SC-02 CreateFarm
│   │   ├── overview/     # SC-03 SeasonOverview, SC-04 FarmManage, SC-05 Expenses, SC-06 AddExpense,
│   │   │                 # SC-07 Sales, SC-08 SaleDetail, SC-09 AddSale
│   │   ├── journal/      # SC-10 CareLogs, SC-11 AddCareLog
│   │   ├── scan/         # SC-12 Scan, SC-13 ScanResult, SC-14 SaveScan, SC-15 Cases, SC-16 CaseDetail
│   │   ├── lookup/       # SC-17 Knowledge, SC-18 Article, SC-19 Chatbot, SC-20 ReportAnswer, SC-21 Standards
│   │   └── more/         # SC-22 More, SC-23 Directory, SC-24 ContactDetail, SC-25 Settings,
│   │                     # SC-26 ScanSync, SC-27 Account
│   ├── navigation/       # RootStack, MainTabs, stack từng tab, modals
│   ├── hooks/            # Query / mutation theo nhóm, useNetworkStatus, useSyncStatus
│   ├── stores/           # Zustand: authStore, contextStore (vườn / lô / vụ đang chọn), settingsStore
│   ├── api/              # API client, endpoint theo nhóm, interceptor token, xử lý 401/409/422/429/503
│   ├── db/               # (thêm) SQLite: schema, outbox, repository Scan, cache đọc, FTS
│   ├── sync/             # (thêm) Chạy outbox Scan, upload ảnh prepare / complete, trạng thái đồng bộ
│   ├── content/          # (thêm) Tải gói nội dung, kiểm hash, chuyển release atomically
│   ├── ai/               # (thêm) Model router, adapter chuẩn hóa kết quả, đọc manifest model
│   ├── services/         # (thêm) Auth (Google / Apple), xử lý ảnh, secure storage
│   ├── i18n/             # (thêm) vi.json, en.json
│   ├── theme/            # (thêm) Màu, font, spacing
│   ├── types/            # Entity theo API (mục 6), navigation params, request / response
│   └── utils/            # Decimal tiền / kg, định dạng VND, ngày (Asia/Ho_Chi_Minh)
├── assets/               # Ảnh, font, icon, manifest + file model (do bên cung cấp bàn giao)
├── app.json              # Expo config (quyền camera, ảnh, đăng nhập)
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
└── package.json
```

**Thư viện đề xuất**

| Nhu cầu | Thư viện | Ghi chú |
| --- | --- | --- |
| Navigation | @react-navigation/native, bottom-tabs, native-stack | Theo cấu trúc mục 3 |
| Gọi API & cache | axios + @tanstack/react-query | Cache trong bộ nhớ, retry, refetch khi có mạng lại |
| State | zustand | Auth, vườn / lô / vụ đang chọn, cài đặt |
| DB cục bộ | expo-sqlite | Outbox Scan, cache đọc, FTS; không dùng cho nghiệp vụ khác |
| Camera / ảnh | expo-camera, expo-image-picker, expo-image-manipulator | Một ảnh mỗi lần quét, nén trước khi lưu / upload |
| AI on-device | onnxruntime-react-native (đề xuất) | **Format / runtime phải được xác nhận với bên bàn giao model** và thử trên hai thiết bị trong 48 giờ đầu; cần dev build |
| Đăng nhập | Google Sign-In, expo-apple-authentication | Cấu hình OAuth do chủ sản phẩm / dịch vụ nộp store bàn giao |
| Lưu bảo mật | expo-secure-store | Session token, không ghi vào SQLite hay log |
| Tiền | decimal.js (hoặc tương đương) | Cùng quy tắc làm tròn với backend |
| Form | react-hook-form + zod | Validate form đã định trong ERD |
| i18n | i18next + react-i18next | VI / EN |

Bản v0.1 có victory-native (biểu đồ), react-native-maps / bản đồ mock, expo-notifications; ba mục này đã bị loại vì phạm vi mới không có biểu đồ, bản đồ hay thông báo.

### Điểm kiểm rủi ro theo mốc

| Khi nào | Việc cần khóa |
| --- | --- |
| 48 giờ đầu | Build native Android / iOS trên máy thật; OAuth; lưu scan offline → sync → retry không trùng; khóa runtime / format manifest model; app ID, signing, domain, quyền backend |
| Ngay khi nhận model | File nhiều model, checksum, kích thước, quyền phân phối, mapping bộ phận → model, input / output, tiền xử lý, class map, ngưỡng, ảnh và output đối chiếu; đo trên hai nền tảng |
| Trước build cuối | Các mục bài / checklist / liên hệ được duyệt Việt / Anh có nguồn; khóa bản nội dung, chạy AC, ký build, bàn giao artifact cho dịch vụ nộp store |

Nếu đầu vào hoặc phép thử chặn phát hành không hoàn tất trước 28/10, dev báo ngay cùng bằng chứng và phần việc còn thiếu; không đánh dấu xong bằng giả định.

### Câu hỏi cần chốt

- [x] Framework mobile: React Native (Expo) + TypeScript, dùng dev build / native runtime.
- [x] Phạm vi: theo `docs/` ngày 14/10/2026, offline đồng bộ chỉ cho AI Scan.
- [ ] Offline chỉ cho Scan: có xác nhận tạo **ca bệnh mới cùng scan** khi offline được phép (sync chung mutation Scan), còn đóng / sửa ca phải online?
- [ ] Offline và chưa có vụ: giữ nháp scan và chọn vụ khi có mạng — có chấp nhận không, hay cho tạo vụ offline?
- [ ] Gói nội dung đọc offline (bài, tiêu chuẩn, danh bạ, vườn / lô / vụ bản đọc) là cache chỉ đọc, không tính là đồng bộ offline — đúng ý?
- [ ] Giữ nội dung đang nhập khi mất mạng ở các form online: giữ trong app để gửi lại bằng tay có đủ, hay không cần giữ?
- [ ] Model AI: bên cung cấp, định dạng / runtime, các bộ phận được hỗ trợ, quyền đóng gói phân phối, thời điểm bàn giao file và bộ ảnh đối chiếu.
- [ ] App ID, signing / provisioning, cấu hình Google / Apple OAuth, policy / support URL, domain: ai bàn giao và khi nào.
- [ ] Nguồn nội dung: ai duyệt bản Việt / Anh trước 28/10; nguồn chính thức cho sầu riêng tươi Trung Quốc / EU.
- [ ] Nhà cung cấp LLM / embedding và chi phí mỗi câu hỏi; cơ chế rate limit.
- [ ] Phiên bản OS tối thiểu và dòng máy tham chiếu để đo hiệu năng model.
- [ ] Thiết kế: prototype v0.1 không khớp 27 màn mới; ai thiết kế bổ sung và khi nào.
