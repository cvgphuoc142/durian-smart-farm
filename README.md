# Durian Smart Farm

Hệ thống quản lý vườn sầu riêng gồm 3 phần:

| Thư mục | Là gì | Công nghệ |
|---|---|---|
| `durianBackend/` | API server, lưu dữ liệu, chatbot RAG, lưu ảnh | Python 3.12, FastAPI, MongoDB, Qdrant, MinIO |
| `durianMobile/` | App cho nông dân (nhật ký, chi phí, quét bệnh bằng AI, tra cứu, chatbot) | React Native, Expo, SQLite, ONNX |
| `admin-frontend/` | Web cho admin soạn bài viết, tiêu chuẩn, danh bạ và xem báo cáo chat | React, Vite, TypeScript |

Hướng dẫn này dành cho người mới hoàn toàn. Làm theo thứ tự: **0 → 1 → 2 → 3 → 4**. Mỗi phần có bước kiểm tra "chạy đúng chưa".

> Chỉ muốn xem app mobile mà không cần server? Làm bước 0 và bước 3, để `EXPO_PUBLIC_USE_MOCK=true`. App sẽ chạy với dữ liệu giả trong bộ nhớ.

---

## 0. Cài công cụ (một lần)

Hướng dẫn dùng macOS với Homebrew. Cài Homebrew tại https://brew.sh nếu chưa có.

| Công cụ | Dùng cho | Cài đặt |
|---|---|---|
| Git + Git LFS | Tải code và file model AI (~330MB) | `brew install git git-lfs && git lfs install` |
| Docker Desktop | Chạy MongoDB, Qdrant, MinIO | https://www.docker.com/products/docker-desktop (mở app lên sau khi cài) |
| uv | Quản lý Python cho backend | `brew install uv` |
| Node.js 20+ | Mobile và admin | `brew install node` |
| Xcode (chỉ để chạy iOS) | Build app iPhone | App Store, rồi mở một lần để chấp nhận license |
| Android Studio (chỉ để chạy Android) | Build app Android | https://developer.android.com/studio |

Kiểm tra:

```bash
git --version && git lfs version && docker --version && uv --version && node --version
```

Cả 5 lệnh phải in ra phiên bản, không báo `command not found`.

### Lấy code

```bash
git clone git@github.com:cvgphuoc142/durian-smart-farm.git
cd durian-smart-farm
git checkout develop
```

Phải có Git LFS **trước khi** clone. Nếu cài sau, chạy `git lfs pull` để tải 3 file model `.onnx` trong `durianMobile/assets/models/`. Nếu chúng chỉ nặng vài trăm byte thì chưa tải được.

---

## 1. Backend (`durianBackend`)

### 1.1 Cài thư viện và tạo file cấu hình

```bash
cd durianBackend
uv sync                    # cài Python 3.12 và thư viện
cp .env.example .env
```

Mở `.env` và điền:

| Biến | Cần làm gì |
|---|---|
| `APP_ENV=dev` | Giữ nguyên khi phát triển. Cho phép đăng nhập thử bằng token `dev:...`. **Không bao giờ đặt `dev` trên server thật.** |
| `GEMINI_API_KEY` | Lấy miễn phí tại https://aistudio.google.com/apikey. Chỉ cần cho chatbot và đánh chỉ mục RAG. Để trống thì các phần còn lại vẫn chạy. |
| `S3_PUBLIC_ENDPOINT_URL` | Chỉ cần nếu muốn điện thoại thật xem ảnh. Điền `http://<IP-LAN-của-máy>:9000`. Xem IP bằng `ipconfig getifaddr en0`. |
| Các biến còn lại | Giữ mặc định. |

### 1.2 Chạy database và API

```bash
make up        # MongoDB + Qdrant bằng Docker (lần đầu tải image, hơi lâu)
make storage   # MinIO, nơi lưu ảnh (bỏ qua nếu chưa cần ảnh)
make seed      # nạp dữ liệu demo
make dev       # chạy API tại http://localhost:8000
```

`make dev` giữ terminal, nên mở terminal mới cho các phần sau.

### 1.3 Kiểm tra

- Mở http://localhost:8000/healthz, thấy trạng thái OK.
- Mở http://localhost:8000/docs (Swagger):
  1. Gọi `POST /v1/auth/session` với `{"provider": "google", "id_token": "dev:demo"}`.
  2. Copy `token` trong kết quả, bấm **Authorize** và dán vào.
  3. Gọi `GET /v1/me`, thấy thông tin user demo.

### 1.4 Tài khoản có sẵn sau `make seed`

| Dùng cho | Thông tin |
|---|---|
| App mobile (hộ demo có dữ liệu) | token `dev:demo` |
| App mobile (hộ trống) | token `dev:<tên-bất-kỳ>` |
| Web admin | username `admin`, mật khẩu `123456` (chỉ dùng khi phát triển) |

### 1.5 Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `make reseed` | Xoá và nạp lại dữ liệu demo |
| `make test` | Chạy test (tự bật một MongoDB riêng) |
| `make check` | Lint, kiểm tra kiểu và test |
| `make openapi` | Sinh lại `openapi.json` |
| `make down` | Tắt các container |

Chi tiết hơn: [`durianBackend/guideline.md`](durianBackend/guideline.md).

---

## 2. Web admin (`admin-frontend`)

Cần backend (bước 1) đang chạy.

```bash
cd admin-frontend
cp .env.example .env       # VITE_API_URL=http://localhost:8000 là đúng khi chạy local
npm install
npm run dev                # http://localhost:5174
```

Mở http://localhost:5174 và đăng nhập `admin` / `123456`.

Trang web có 4 mục: Articles, Standards, Contacts, Chat reports. Bài viết đi qua quy trình `draft → in_review → approved → published`. Khi publish, backend tự cập nhật chỉ mục RAG cho chatbot (cần `GEMINI_API_KEY`).

Lệnh khác: `npm run typecheck`, `npm run build` (ra thư mục `dist/`). Khi build cho server thật, đặt `VITE_API_BASE` là địa chỉ API tuyệt đối (xem `.env.example`).

---

## 3. App mobile (`durianMobile`)

App dùng module native (ONNX chạy AI, đăng nhập Google), nên **không chạy được bằng Expo Go**. Bạn cần build một "development build" bằng lệnh `expo run:ios` hoặc `expo run:android`.

### 3.1 Cài thư viện và cấu hình

```bash
cd durianMobile
npm install
cp .env.example .env
```

Sửa `.env` theo chế độ muốn chạy:

**Chế độ A: dữ liệu giả, không cần backend** (dễ nhất để bắt đầu)

```
EXPO_PUBLIC_USE_MOCK=true
```

**Chế độ B: nối với backend thật**

```
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=http://<IP-LAN-của-máy>:8000
EXPO_PUBLIC_DEV_ID_TOKEN=dev:demo
```

- Với iOS Simulator, `API_URL` có thể là `http://localhost:8000`. Với Android Emulator dùng `http://10.0.2.2:8000`. Với điện thoại thật, dùng IP LAN của máy và để máy tính và điện thoại chung Wi-Fi.
- `EXPO_PUBLIC_DEV_ID_TOKEN=dev:demo` cho đăng nhập thẳng bằng hộ demo, không cần Google (backend phải có `APP_ENV=dev`).
- Đăng nhập Google thật: điền `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` và `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` lấy từ Google Cloud Console. ID web cũng phải nằm trong `GOOGLE_CLIENT_IDS` của backend.

Sau khi sửa `.env`, tắt Metro và chạy lại với `npx expo start -c` để xoá cache.

### 3.2 Chạy app

```bash
npm run ios        # iOS Simulator (cần Xcode)
# hoặc
npm run android    # Android Emulator đang mở, hoặc điện thoại cắm USB bật USB debugging
```

Lần đầu build mất vài phút. Về sau chỉ cần `npm start` rồi mở app đã cài.

### 3.3 Kiểm tra

- App mở ra màn hình đăng nhập, bấm đăng nhập thử và vào được màn hình tổng quan.
- Vào mục Quét: chọn bộ phận (lá, thân, quả), chụp hoặc chọn ảnh và nhận kết quả. Model chạy ngay trên máy.

### 3.4 Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `npm test` | Chạy test |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run lint` | Kiểm tra lint |
| `npm run format` | Format code |

### 3.5 Thay model AI (chỉ khi nhận được model mới)

Model nằm ở `durianMobile/assets/models/` (đã có sẵn, quản lý bằng Git LFS). Khi nhà cung cấp gửi gói model mới:

```bash
node scripts/build-model-manifest.mjs ../mobile-model-sdk-handoff
```

Lệnh này sinh `assets/models/manifest.json` và chép file `.onnx` vào đúng chỗ. Sau đó cập nhật các dòng `require(...)` trong `src/ai/bundled.ts` cho khớp tên file mới.

---

## 4. Chạy cả hệ thống cùng lúc

Mở 3 terminal:

| Terminal | Lệnh | Địa chỉ |
|---|---|---|
| 1 | `cd durianBackend && make up && make seed && make dev` | http://localhost:8000/docs |
| 2 | `cd admin-frontend && npm run dev` | http://localhost:5174 |
| 3 | `cd durianMobile && npm run ios` (hoặc `android`) | app trên máy ảo |

Thử luồng đầy đủ: trong web admin tạo và publish một bài viết, rồi mở app mobile ở mục Tra cứu và hỏi chatbot về nội dung đó.

---

## 5. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `make up` báo không kết nối được Docker | Mở Docker Desktop và đợi nó chạy xong. |
| Cổng 8000, 27017 hoặc 6333 đã bị chiếm | Tắt chương trình đang dùng cổng đó, hoặc `make down` nếu là container cũ. |
| API báo lỗi kết nối MongoDB | Chạy `docker ps`, phải thấy container mongo ở trạng thái healthy. Lần đầu có thể mất vài chục giây. |
| Chatbot báo lỗi hoặc không trả lời | Kiểm tra `GEMINI_API_KEY` trong `durianBackend/.env`, rồi khởi động lại `make dev`. |
| App mobile không gọi được API trên điện thoại thật | Không dùng `localhost`. Dùng IP LAN của máy, cùng Wi-Fi, và `make dev` phải chạy được từ máy khác (thử mở `http://<IP>:8000/healthz` trên điện thoại). |
| Ảnh không hiện trên điện thoại | Đặt `S3_PUBLIC_ENDPOINT_URL` bằng IP LAN rồi khởi động lại backend, và chắc chắn đã chạy `make storage`. |
| Đổi `.env` của mobile mà không có tác dụng | Chạy `npx expo start -c`. |
| App crash hoặc báo thiếu model, file `.onnx` chỉ vài trăm byte | Chạy `git lfs pull` trong thư mục gốc. |
| `expo run:ios` lỗi pod hoặc native | Chạy `cd ios && pod install`, hoặc xoá thư mục `ios`/`android` rồi `npx expo prebuild --clean`. |
| Web admin đăng nhập báo lỗi | Backend phải đang chạy và đã `make seed`. Kiểm tra `VITE_API_URL` trong `admin-frontend/.env`. |

## 6. Quy ước làm việc

- Nhánh chính để phát triển: `develop`.
- Commit message viết tiếng Anh, theo dạng `feat(backend): ...`, `fix(mobile): ...`, `chore(admin): ...`.
- Không commit file `.env`, `node_modules/`, `dist/`.
- File `.onnx` luôn đi qua Git LFS (đã cấu hình trong `.gitattributes`).
