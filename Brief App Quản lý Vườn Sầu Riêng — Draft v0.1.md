# Brief App Quản lý Vườn Sầu Riêng — Draft v0.1

Oct 12, 2026 · @dat

## 1. Tổng quan

App mobile giúp chủ vườn sầu riêng quản lý vườn, nhật ký chăm sóc, chi phí và nhận diện bệnh bằng AI ngay tại vườn. Phiên bản MVP gồm **22 màn hình**, **8 module**, dữ liệu lấy trực tiếp từ API (không có DB cục bộ).

| Hạng mục | Nội dung |
| --- | --- |
| Người dùng chính | Chủ vườn, nhân công ghi nhật ký (MVP: 1 vai trò chủ vườn) |
| Nền tảng | Android + iOS bằng React Native (Expo) + TypeScript; điện thoại, dùng một tay ngoài trời |
| Ngôn ngữ | Tiếng Việt (mặc định), Tiếng Anh |
| Thiết kế tham chiếu | Prototype Design "App quản lý vườn sầu riêng" (21 artboard 390×844) |
| Nguyên tắc | Dữ liệu lấy từ API; AI chạy trên máy và chỉ tham khảo, có trạng thái "Chưa đủ dữ liệu"; không tự khuyến nghị mua hàng |

**Ngoài phạm vi MVP:** nhiều vai trò / phân quyền nhóm, marketplace đặt hàng, thanh toán, IoT cảm biến, web admin đầy đủ (chỉ cần CMS tối thiểu cho Sổ tay, chuyên gia, cửa hàng).

## 2. Số lượng màn hình

Tổng **22 màn hình** (21 đã có trong prototype + 1 màn chi tiết bài viết): 5 màn tab gốc, 14 màn stack/modal, 3 màn onboarding. Ngoài ra cần khoảng 6–8 component dùng chung (bottom sheet chọn vườn/lô, date picker, dialog xác nhận, empty/error state, toast) chưa tính là màn hình. Độ phức tạp: S = tĩnh/form ngắn, M = list + filter + state, L = nhiều tab, chart, camera hoặc AI.

| Mã | Màn hình | Module | Loại | Độ phức tạp | Thành phần chính |
| --- | --- | --- | --- | --- | --- |
| SC-01 | Onboarding | Thiết lập | Stack | S | Giới thiệu, chọn ngôn ngữ, xin quyền camera |
| SC-02 | Tạo vườn lần đầu | Thiết lập | Stack | M | Tên, vị trí (GPS), diện tích, giống (chọn nhiều), số cây, số lô |
| SC-03 | Chọn vụ mùa | Thiết lập | Stack | S | Tên vụ, ngày bắt đầu, giai đoạn hiện tại (6 giai đoạn) |
| SC-04 | Tổng quan (Dashboard) | A | Tab 1 | L | Thẻ vụ + tiến độ giai đoạn, 3 nút nhanh, cảnh báo, 4 KPI, lịch hôm nay, nút chatbot nổi |
| SC-05 | Danh sách vườn & lô | B | Tab 2 | M | Tìm kiếm, lọc trạng thái, thẻ vườn, thẻ lô |
| SC-06 | Chi tiết lô | B | Stack | L | 5 tab: Cây trồng, Chăm sóc & bệnh, Vật tư, Chi phí, Thu hoạch |
| SC-07 | Quét bệnh | C | Tab 3 (full screen) | L | Camera, chọn ảnh, chọn vườn/lô/cây, chọn bộ phận, hướng dẫn chụp, trạng thái offline |
| SC-08 | Kết quả AI | C | Stack | M | Bệnh nghi ngờ + độ tin cậy, triệu chứng, nguyên nhân, kiểm tra tiếp, biện pháp, lưu, tạo lịch tái kiểm |
| SC-09 | Chưa đủ dữ liệu | C | Stack | S | Lý do, chụp lại, gửi chuyên gia, lưu ảnh |
| SC-10 | Chi tiết bệnh | C | Stack | M | Ảnh theo dõi, triệu chứng, hướng dẫn, timeline xử lý |
| SC-11 | Sổ tay canh tác | D | Tab 4 | M | Tìm kiếm, 6 danh mục, bài gợi ý theo giai đoạn, yêu thích |
| SC-12 | Chi tiết bài viết | D | Stack | S | Nội dung rich text, nguồn, yêu thích (chưa vẽ trong prototype) |
| SC-13 | Cá nhân & Cài đặt | Chung | Tab 5 | M | Hồ sơ, menu module, toggle cài đặt, ngôn ngữ |
| SC-14 | Chatbot AI | G | Stack | L | Chat, gợi ý theo giai đoạn, trích nguồn, lịch sử, banner offline, thẻ kết quả Scan |
| SC-15 | Lịch chăm sóc | H | Stack | L | Xem ngày/tuần/tháng, lọc lô, cần làm / đã xong, tick hoàn thành |
| SC-16 | Thêm nhật ký | H | Modal | M | Loại hoạt động, vườn/lô/cây, ngày, người làm, vật tư, chi phí, nhắc lại, ghi chú, ảnh |
| SC-17 | Thông báo | H | Stack | S | Lọc theo loại, nhóm theo ngày, đánh dấu đã đọc, deep link |
| SC-18 | Dashboard tài chính | E | Stack | L | Vốn, chi phí, ngân sách còn lại, doanh thu, lợi nhuận, chart tháng/vụ, cơ cấu, giao dịch gần đây |
| SC-19 | Thêm giao dịch | E | Modal | M | Thu/chi, số tiền, danh mục, ngày, lô, ghi chú, ảnh hóa đơn |
| SC-20 | Báo cáo mùa vụ | E | Stack | M | KPI vụ, bảng theo lô, cơ cấu chi phí, xuất PDF, chia sẻ |
| SC-21 | Chuyên gia | F | Stack | M | Tìm, lọc chuyên môn, nhãn xác minh, gọi điện, gửi yêu cầu |
| SC-22 | Cửa hàng vật tư | F | Stack | M | Bản đồ, danh sách theo khoảng cách, giờ mở cửa, gọi, chỉ đường |

Tổng hợp: **22 màn** gồm 5 S · 11 M · 6 L.

## 3. Navigation

App dùng **bottom tab 5 mục**, AI Scan nằm giữa và mở toàn màn hình (ẩn tab bar). Mỗi tab có stack riêng; hai form nhập liệu là modal toàn cục.

&#91;embedded content: cấu trúc điều hướng · 5 tab, 18 màn con\]

Một số màn nằm trong chuỗi: Vườn cây → Chi tiết lô → Chi tiết bệnh; AI Scan → Kết quả → Chi tiết bệnh, hoặc Chưa đủ dữ liệu → Chuyên gia. Các màn xuất hiện ở nhiều tab (Chi tiết bệnh, Tài chính, Lịch) là cùng một màn, đẩy vào stack của tab đang mở.

**Cấu trúc navigator đề xuất**

1. `RootStack`
   - `OnboardingStack`: SC-01 → SC-02 → SC-03 (chỉ khi chưa có vườn)
   - `MainTabs`: 5 tab, mỗi tab một stack
   - `Modals`: SC-16 Thêm nhật ký, SC-19 Thêm giao dịch, bottom sheet chọn vườn / lô / cây
   - `ScanFlow` (full screen): SC-07 → SC-08 / SC-09
2. Deep link từ thông báo: tái kiểm tra → SC-10, việc quá hạn → SC-15, vượt ngân sách → SC-18.
3. Back cứng (Android) ở form chưa lưu: hỏi xác nhận trước khi thoát.

## 4. Danh sách chức năng

Tổng **70 chức năng** chia 9 nhóm. Ưu tiên: **P1** = bắt buộc cho MVP, **P2** = nên có trong MVP, **P3** = sau MVP. Cột Màn hình trỏ về mã ở mục 2.

### X. Chung (tài khoản, thiết lập, hệ thống)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-X01 | Đăng nhập / đăng ký | SĐT + OTP (cần chốt, xem mục 7) | SC-01 | P1 |
| FR-X02 | Onboarding | Giới thiệu, chọn ngôn ngữ, xin quyền camera / thông báo | SC-01 | P1 |
| FR-X03 | Thiết lập vườn đầu tiên | Wizard 3 bước: tạo vườn → chọn vụ → vào Dashboard | SC-02, SC-03 | P1 |
| FR-X04 | Hồ sơ người dùng | Xem / sửa tên, SĐT, ảnh | SC-13 | P2 |
| FR-X05 | Xử lý mất mạng | Banner mất mạng, retry request, giữ nháp form chưa gửi, refetch khi có mạng lại | SC-13 | P1 |
| FR-X06 | Đăng nhập trên máy mới | Dữ liệu nằm trên server, đăng nhập lại là có đủ dữ liệu; không cần sao lưu riêng | SC-13 | P2 |
| FR-X07 | Quản lý model AI | Sau MVP (AI đang mock): xem phiên bản, dung lượng; tải / cập nhật model AI | SC-13 | P3 |
| FR-X08 | Đa ngôn ngữ | i18n VI / EN, đổi trong Cài đặt | SC-01, SC-13 | P2 |
| FR-X09 | Thông báo | Push + local notification, danh sách, lọc, đánh dấu đã đọc, deep link tới màn liên quan | SC-17 | P1 |
| FR-X10 | Đăng xuất | Cảnh báo nếu còn dữ liệu chưa đồng bộ | SC-13 | P1 |

### A. Tổng quan (Dashboard)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-A01 | Thẻ vụ mùa | Tên vụ, giai đoạn hiện tại, thanh tiến độ 5 giai đoạn, ngày dự kiến thu hoạch | SC-04 | P1 |
| FR-A02 | KPI vườn | Diện tích, số cây, chi phí đã phát sinh, lợi nhuận dự kiến (tính từ dữ liệu E) | SC-04 | P1 |
| FR-A03 | Cảnh báo | Bệnh đang xử lý, việc quá hạn; chạm → màn liên quan | SC-04 | P1 |
| FR-A04 | Lịch hôm nay | Danh sách việc trong ngày, trạng thái xong / chưa | SC-04 | P1 |
| FR-A05 | Nút thao tác nhanh | Quét bệnh, Thêm chi phí, Ghi nhật ký | SC-04 | P1 |
| FR-A06 | Chọn vườn đang xem | Chuyển giữa các vườn khi có >1 vườn | SC-04 | P2 |

### B. Vườn cây (Farm Management)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-B01 | CRUD vườn | Tên, vị trí (GPS), diện tích, giống, số cây | SC-02, SC-05 | P1 |
| FR-B02 | CRUD lô | Mã lô, giống, diện tích, tuổi cây, số cây, giai đoạn | SC-05, SC-06 | P1 |
| FR-B03 | CRUD cây | Mã cây (VD B-14), trạng thái sức khỏe | SC-06 | P1 |
| FR-B04 | Tìm kiếm & lọc | Theo tên lô, mã cây, giống; lọc Tốt / Cần theo dõi / Có vấn đề | SC-05 | P1 |
| FR-B05 | Trạng thái lô tự động | Suy ra từ bệnh đang mở và việc quá hạn (quy tắc cần chốt) | SC-05 | P2 |
| FR-B06 | Chi tiết lô — 5 tab | Cây trồng, Lịch sử chăm sóc & bệnh, Nhật ký vật tư, Chi phí lô, Lịch sử thu hoạch | SC-06 | P1 |
| FR-B07 | Ghi nhận thu hoạch | Sản lượng, giá bán, doanh thu theo lô / vụ | SC-06 | P2 |

### C. AI Scan (nhận diện bệnh)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-C01 | Chụp / chọn ảnh | Camera in-app, chọn từ thư viện, nhiều ảnh / lần quét | SC-07 | P1 |
| FR-C02 | Ngữ cảnh quét | Chọn vườn / lô / cây và bộ phận (lá, thân, rễ, hoa, trái) | SC-07 | P1 |
| FR-C03 | Hướng dẫn chụp | Overlay mẹo chụp rõ nét | SC-07 | P2 |
| FR-C04 | Suy luận offline | MVP: mock, trả kết quả mẫu theo bộ phận (kể cả ca "Chưa đủ dữ liệu"); giai đoạn sau thay model on-device | SC-07 | P1 |
| FR-C05 | Kết quả | Bệnh nghi ngờ, % tin cậy, khả năng khác, triệu chứng, nguyên nhân, kiểm tra tiếp, biện pháp tham khảo + cảnh báo "chỉ tham khảo" | SC-08 | P1 |
| FR-C06 | Trạng thái "Chưa đủ dữ liệu" | Khi ảnh kém hoặc độ tin cậy dưới ngưỡng: không chẩn đoán, nêu lý do | SC-09 | P1 |
| FR-C07 | Lưu vào lịch sử bệnh | Tạo ca bệnh gắn cây / lô, lưu ảnh | SC-08 | P1 |
| FR-C08 | Tạo lịch tái kiểm tra | Tự tạo task + nhắc trong module H | SC-08 | P1 |
| FR-C09 | Chi tiết ca bệnh | Ảnh theo thời gian, timeline xử lý, cập nhật trạng thái (đang xử lý / đã khỏi) | SC-10 | P1 |
| FR-C10 | Gửi chuyên gia | Đính kèm ảnh + kết quả vào yêu cầu tư vấn | SC-09, SC-21 | P2 |

### D. Sổ tay canh tác (Knowledge Base)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-D01 | Danh mục kiến thức | 6 nhóm: bệnh & sâu hại, quy trình theo giai đoạn, tưới / phân / tỉa, ra hoa / đậu / nuôi trái, thu hoạch & bảo quản, an toàn BVTV | SC-11 | P1 |
| FR-D02 | Tìm kiếm | Full-text qua API | SC-11 | P1 |
| FR-D03 | Đọc bài | Rich text + ảnh, nguồn tham khảo | SC-12 | P1 |
| FR-D04 | Gợi ý theo giai đoạn | Bài phù hợp với giai đoạn vụ hiện tại | SC-11 | P2 |
| FR-D05 | Yêu thích | Đánh dấu / bỏ đánh dấu, danh sách đã lưu | SC-11, SC-12 | P2 |
| FR-D06 | Đọc khi mất sóng | Lưu nội dung bài yêu thích vào bộ nhớ máy (file cache, không phải DB); cần chốt | SC-11 | P3 |

### E. Quản lý vốn (Finance)

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-E01 | Vốn đầu tư / ngân sách vụ | Nhập vốn ban đầu, ngân sách theo vụ | SC-18 | P1 |
| FR-E02 | CRUD giao dịch thu / chi | Số tiền, ngày, danh mục, vườn / lô, ghi chú | SC-19 | P1 |
| FR-E03 | Ảnh hóa đơn | Chụp / chọn ảnh, nén rồi upload kèm giao dịch | SC-19 | P2 |
| FR-E04 | Dashboard tài chính | Tổng chi, % ngân sách, còn lại, doanh thu thực tế / dự kiến, lợi nhuận ước tính | SC-18 | P1 |
| FR-E05 | Biểu đồ chi phí | Theo tháng và theo vụ; cơ cấu theo danh mục | SC-18 | P2 |
| FR-E06 | Chi phí từ nhật ký | Hoạt động có chi phí tự sinh giao dịch chi (tùy chọn) | SC-16 | P2 |
| FR-E07 | Báo cáo mùa vụ | Tổng chi phí, sản lượng, doanh thu, lợi nhuận, bảng theo lô, so với vụ trước | SC-20 | P2 |
| FR-E08 | Xuất / chia sẻ báo cáo | PDF, share sheet hệ điều hành | SC-20 | P3 |

### F. Chuyên gia & cửa hàng vật tư

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-F01 | Danh sách chuyên gia | Tìm, lọc chuyên môn / địa bàn, hồ sơ, kinh nghiệm, đánh giá | SC-21 | P2 |
| FR-F02 | Liên hệ chuyên gia | Gọi điện (tel:), gửi yêu cầu tư vấn kèm ảnh | SC-21 | P2 |
| FR-F03 | Danh sách cửa hàng | Theo khoảng cách từ vườn, nhóm sản phẩm, giờ mở cửa | SC-22 | P2 |
| FR-F04 | Bản đồ & chỉ đường | MVP: bản đồ mock (khung tĩnh); chỉ đường bằng cách mở app bản đồ ngoài | SC-22 | P3 |
| FR-F05 | Nhãn xác minh | Đã xác minh / Chưa xác minh, quản lý từ CMS | SC-21, SC-22 | P2 |
| FR-F06 | Không liên kết AI → cửa hàng | Kết quả Scan không được tự gợi ý sản phẩm / cửa hàng cụ thể | SC-08, SC-22 | P1 |

### G. Chatbot AI

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-G01 | Hỏi đáp | Giao diện chat, trả lời dựa trên Sổ tay (RAG) | SC-14 | P1 |
| FR-G02 | Trích nguồn | Mỗi câu trả lời kèm link tới bài Sổ tay | SC-14 | P1 |
| FR-G03 | Câu hỏi gợi ý | Theo giai đoạn vụ hiện tại | SC-14 | P2 |
| FR-G04 | Lịch sử hội thoại | Danh sách, mở lại, xóa | SC-14 | P2 |
| FR-G05 | Khi mất mạng | Chatbot cần mạng; mất mạng thì báo rõ và giữ câu hỏi để gửi lại | SC-14 | P2 |
| FR-G06 | Liên kết kết quả Scan | Mở nhanh / hỏi tiếp về kết quả quét gần nhất | SC-14 | P2 |
| FR-G07 | Tạo việc từ câu trả lời | VD "+ Tạo lịch tái kiểm" | SC-14 | P3 |

### H. Nhật ký & lịch chăm sóc

| Mã | Chức năng | Mô tả / tiêu chí | Màn hình | Ưu tiên |
| --- | --- | --- | --- | --- |
| FR-H01 | Lịch ngày / tuần / tháng | Chuyển chế độ xem, đánh dấu ngày có việc | SC-15 | P1 |
| FR-H02 | CRUD hoạt động / công việc | Loại (tưới, bón phân, phun thuốc, cắt tỉa, kiểm tra bệnh, khác), ngày giờ, người làm, vườn / lô / cây | SC-16 | P1 |
| FR-H03 | Vật tư & chi phí trong nhật ký | Gắn vật tư + số lượng, chi phí; liên kết FR-E06 | SC-16 | P1 |
| FR-H04 | Hoàn thành công việc | Tick xong / bỏ tick, tách Cần làm và Đã xong | SC-15 | P1 |
| FR-H05 | Nhắc lịch | Local notification trước giờ làm; việc lặp lại (sau N ngày) | SC-15, SC-16 | P1 |
| FR-H06 | Cảnh báo quá hạn | Việc quá ngày dự kiến đẩy lên Dashboard và Thông báo | SC-04, SC-17 | P1 |
| FR-H07 | Xem lịch sử theo cây / lô / vụ | Lọc nhật ký | SC-06, SC-15 | P2 |
| FR-H08 | Ghi chú an toàn BVTV | Khi chọn phun thuốc: bắt buộc tên thuốc, hoạt chất, thời gian cách ly; nhắc ngày được thu hoạch | SC-16 | P2 |
| FR-H09 | Ảnh hiện trường | Đính kèm ảnh vào nhật ký | SC-16 | P2 |
| FR-H10 | Vụ mùa | Tạo / đóng vụ, đổi giai đoạn | SC-03, SC-13 | P1 |

Tổng hợp ưu tiên: **40 P1 · 25 P2 · 5 P3**.

## 5. Yêu cầu phi chức năng

App không có DB cục bộ: mọi dữ liệu đọc / ghi qua API, nên phần lớn thao tác cần mạng. Cache và xử lý mất mạng là yêu cầu ảnh hưởng nhiều nhất đến trải nghiệm ngoài vườn.

| Nhóm | Yêu cầu |
| --- | --- |
| Dữ liệu & mất mạng | Server là nguồn dữ liệu duy nhất; gọi API qua React Query (cache trong bộ nhớ, retry, refetch khi có mạng lại); banner báo mất mạng; form chưa gửi được giữ lại dạng nháp để gửi lại |
| AI on-device | MVP: mock kết quả. Giai đoạn sau: model phân loại bệnh dạng TFLite / Core ML, kích thước mục tiêu ≤ 40 MB, suy luận ≤ 3 giây trên máy tầm trung; ngưỡng tin cậy cấu hình được từ server; model cập nhật không cần phát hành lại app |
| Ảnh | Nén trước khi lưu / upload (cạnh dài \~1280 px); upload nền, retry khi mất mạng |
| Thông báo | Local notification cho lịch (hoạt động khi offline); push (FCM / APNs) cho cảnh báo từ server |
| Hiệu năng | Mở app ≤ 2 giây; list 500+ cây cuộn mượt (virtualized list) |
| UX ngoài trời | Touch target ≥ 44 px, chữ thân ≥ 15 px, tương phản cao, thao tác chính dùng được một tay |
| Bảo mật | Token lưu secure storage; HTTPS; dữ liệu tài chính chỉ chủ vườn xem |
| Hỗ trợ thiết bị | Android 8+ và iOS 15+ (cần chốt) |
| Theo dõi | Crash reporting, analytics sự kiện chính (quét, lưu nhật ký, đồng bộ lỗi) |

Các con số trên là mục tiêu đề xuất để estimate, chưa được chốt.

## 6. Mô hình dữ liệu chính

Có 21 thực thể, trục chính là **Farm → Lot → Tree**, mọi dữ liệu nghiệp vụ đều gắn với Season. Đây là mô hình phía server, API trả về; app không lưu DB cục bộ, chỉ khai báo type tương ứng trong `types/`. Mọi thực thể có `id`, `created_at`, `updated_at`.

| Thực thể | Trường chính | Quan hệ | Module |
| --- | --- | --- | --- |
| User | name, phone, avatar, locale | 1–n Farm | X |
| Farm | name, location (lat/lng, address), area\_ha, varieties\[\] | thuộc User; 1–n Lot, Season | B |
| Lot | code, variety, area\_ha, planted\_year, tree\_count, status | thuộc Farm; 1–n Tree | B |
| Tree | code, health\_status, note | thuộc Lot | B |
| Season | name, start\_date, end\_date, stage, budget, initial\_capital | thuộc Farm | H, E |
| Activity | type, scheduled\_at, done\_at, assignee, cost, repeat\_rule, note | gắn Farm / Lot / Tree, Season | H |
| ActivitySupply | quantity, unit | Activity n–n Supply | H |
| Supply | name, unit, active\_ingredient, phi\_days | danh mục vật tư của User | H, E |
| Transaction | type (thu/chi), amount, category, date, note | gắn Farm / Lot, Season; 0–1 Activity | E |
| Harvest | date, weight\_kg, unit\_price, revenue | gắn Lot, Season | B, E |
| DiseaseCase | disease\_code, status, opened\_at, closed\_at | gắn Tree / Lot; 1–n ScanResult, Activity | C |
| ScanResult | part, top\_label, confidence, alternatives\[\], model\_version, is\_inconclusive | thuộc DiseaseCase (hoặc đứng riêng) | C |
| Attachment | local\_path, remote\_url, kind | đa hình: Scan, Activity, Transaction, DiseaseCase | Chung |
| Notification | type, title, body, deep\_link, read\_at | thuộc User | X |
| Article | title, category, stages\[\], body, sources\[\], version | nội dung từ CMS | D |
| Favorite | — | User n–n Article | D |
| ChatSession / ChatMessage | role, content, citations\[\] | thuộc User | G |
| Expert | name, specialties\[\], region, years, rating, verified, phone | nội dung từ CMS | F |
| Store | name, address, lat/lng, product\_groups\[\], hours, verified, phone | nội dung từ CMS | F |
| Disease (danh mục) | code, name, symptoms, causes, checks, treatments | nội dung từ CMS, ánh xạ với nhãn model | C, D |

Các số trên Dashboard và Tài chính (tổng chi, % ngân sách, lợi nhuận dự kiến, trạng thái lô) là giá trị tính toán, không lưu.

## 7. Đề xuất src base và câu hỏi mở

Framework đã chốt: **React Native (Expo) + TypeScript**, React Navigation, Zustand. Cấu trúc theo mẫu chuẩn của team, thêm 4 thư mục (`ai`, `services`, `i18n`, `theme`). **Không có DB cục bộ**: mọi dữ liệu lấy qua `api/`, cache bằng React Query. `screens/` chia theo module, khớp với mã SC ở mục 2.

```text
durianMobile/
├── src/
│   ├── components/       # Component tái sử dụng
│   │   ├── ui/           # Button, Card, Chip, Tabs, BottomSheet, EmptyState, Toast
│   │   └── domain/       # LotCard, TaskItem, ScanResultCard, TransactionRow…
│   ├── screens/          # Màn hình, chia theo module (khớp mã SC)
│   │   ├── onboarding/   # SC-01 Onboarding, SC-02 CreateFarm, SC-03 SelectSeason
│   │   ├── dashboard/    # SC-04 Dashboard
│   │   ├── farm/         # SC-05 FarmList, SC-06 LotDetail
│   │   ├── scan/         # SC-07 Scan, SC-08 ScanResult, SC-09 ScanInconclusive, SC-10 DiseaseDetail
│   │   ├── knowledge/    # SC-11 Knowledge, SC-12 ArticleDetail
│   │   ├── profile/      # SC-13 Profile & Settings
│   │   ├── chatbot/      # SC-14 Chatbot
│   │   ├── journal/      # SC-15 Calendar, SC-16 AddActivity, SC-17 Notifications
│   │   ├── finance/      # SC-18 Finance, SC-19 AddTransaction, SC-20 SeasonReport
│   │   └── directory/    # SC-21 Experts, SC-22 Stores
│   ├── navigation/       # React Navigation: RootStack, MainTabs, stack từng tab, linking (deep link)
│   ├── hooks/            # Custom hooks: query/mutation theo module (useFarms, useLot, useActivities…), useNetworkStatus
│   ├── stores/           # Zustand: authStore, farmContextStore (vườn / vụ đang chọn), settingsStore
│   ├── api/              # API client (axios), endpoint theo module, interceptor token, upload ảnh
│   ├── ai/               # (thêm) Interface nhận diện bệnh — MVP dùng mock, sau thay model on-device
│   ├── services/         # (thêm) Notifications (local + push), xử lý ảnh, location
│   ├── i18n/             # (thêm) vi.json, en.json
│   ├── theme/            # (thêm) Màu, font, spacing — token lấy từ prototype
│   ├── types/            # TypeScript: entity theo API (mục 6), navigation params, request / response
│   └── utils/            # Format tiền VND, ngày, đơn vị
├── assets/               # Ảnh, font (Be Vietnam Pro), icon, dữ liệu mock AI
├── app.json              # Expo config (quyền camera, location, notifications)
├── tsconfig.json         # TypeScript config
├── .eslintrc.js          # ESLint config
├── .prettierrc           # Prettier config
└── package.json          # Dependencies
```

**Thư viện đề xuất**

| Nhu cầu | Thư viện | Ghi chú |
| --- | --- | --- |
| Navigation | @react-navigation/native, bottom-tabs, native-stack | Theo cấu trúc mục 3 |
| Gọi API & cache | axios + @tanstack/react-query | Cache trong bộ nhớ, retry, refetch khi có mạng lại; không có DB cục bộ |
| State | zustand | State phía client: auth, vườn / vụ đang chọn, cài đặt |
| Camera | expo-camera, expo-image-picker | Đủ cho chụp / chọn ảnh khi AI còn mock |
| AI on-device | **Mock trong MVP** | `ai/` trả kết quả mẫu qua một interface cố định; sau thay bằng model thật (VD react-native-fast-tflite) mà không đổi màn hình |
| Xử lý ảnh | expo-image-manipulator | Nén trước khi upload |
| Thông báo | expo-notifications | Local + push |
| Form | react-hook-form + zod | Validate form nhật ký, giao dịch, tạo vườn |
| i18n | i18next + react-i18next | VI / EN |
| Biểu đồ | victory-native | Nhiều lượt tải nhất trong nhóm (bảng dưới); render bằng Skia, cần thêm @shopify/react-native-skia, reanimated, gesture-handler |
| Bản đồ | **Mock trong MVP** | Ảnh / khung bản đồ tĩnh + nút mở Google Maps / Apple Maps qua `Linking`; giai đoạn sau cân nhắc react-native-maps |

**Chọn thư viện biểu đồ:** giữ victory-native, vì có lượt tải cao nhất và đáp ứng đủ nhu cầu (cột theo tháng / vụ, thanh cơ cấu chi phí).

| Thư viện | Lượt tải npm / tuần | Render |
| --- | --- | --- |
| [victory-native](https://www.npmjs.com/package/victory-native) | \~365.000 | Skia |
| [react-native-gifted-charts](https://www.npmjs.com/package/react-native-gifted-charts) | \~189.000 | SVG |
| [react-native-chart-kit](https://www.npmjs.com/package/react-native-chart-kit) | \~97.000 | SVG |
| [@wuba/react-native-echarts](https://www.npmjs.com/package/@wuba/react-native-echarts) | \~29.000 | ECharts (SVG / Skia) |

Số lượt tải lấy từ [npm downloads API](https://api.npmjs.org/downloads/point/last-week/victory-native), tuần 5–11/9/2026 (echarts: tuần 28/7–3/8/2026). Lưu ý: victory-native bản mới (v40+) dựa trên Skia và New Architecture, cần kiểm tra chạy được trên Expo Go hay phải dùng dev build khi setup project.

Backend tối thiểu cho MVP: REST API + auth OTP, CRUD cho mọi thực thể ở mục 6 (phân trang, lọc, tính KPI phía server), lưu trữ ảnh (object storage), push, CMS cho Article / Disease / Expert / Store, dịch vụ RAG cho chatbot, phân phối model AI theo phiên bản.

### Câu hỏi cần chốt trước khi estimate

- [x] Framework mobile: đã chốt React Native (Expo) + TypeScript.
- [ ] Không có DB cục bộ: ở vườn sóng yếu, có chấp nhận không xem / ghi được dữ liệu khi mất mạng không? Nếu cần, phải thêm cache bền (MMKV / AsyncStorage) và hàng đợi gửi lại.
- [ ] Đăng nhập: SĐT + OTP (nhà cung cấp SMS nào) hay Zalo / Google?
- [ ] Model AI Scan (MVP đang mock): đã có sẵn hay phải train? Bao nhiêu lớp bệnh, ai cung cấp dữ liệu ảnh?
- [ ] AI chạy on-device hoàn toàn hay kết hợp server khi có mạng?
- [ ] Chatbot: LLM nào, chi phí mỗi câu hỏi, và "offline" nghĩa là tìm kiếm trên Sổ tay hay model chạy trên máy?
- [ ] Nguồn nội dung Sổ tay, chuyên gia, cửa hàng: ai biên soạn và xác minh? Cần CMS mức nào?
- [ ] MVP có cần nhiều người dùng chung một vườn (chủ vườn + nhân công) không? Ảnh hưởng lớn đến API và phân quyền.
- [ ] Quy tắc tính trạng thái lô (Tốt / Cần theo dõi / Có vấn đề) và công thức doanh thu / lợi nhuận dự kiến.
- [ ] Bản đồ cửa hàng: MVP mock; giai đoạn sau dùng Google Maps SDK hay chỉ mở app bản đồ ngoài?
- [ ] Phiên bản OS tối thiểu và dòng máy tham chiếu để test hiệu năng AI.
