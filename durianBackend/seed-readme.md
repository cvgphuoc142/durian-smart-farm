# Chạy seed lên production

Seed đưa lên backend những thứ app cần ngay lần đầu mở, để người dùng mới (kể cả reviewer của Apple) không thấy màn hình trống. Nó **không** tạo farm, lô hay mùa vụ: reviewer đăng nhập bằng tài khoản Google của họ và tự nhập.

## Seed làm gì

| Phần | Nội dung | Ghi chú |
|---|---|---|
| Bài viết | 14 bài đã publish (8 bệnh/sâu hại gắn mã bệnh của model, 5 bài theo giai đoạn mùa vụ, 1 bài dùng thuốc an toàn) | Dữ liệu ở `scripts/seed_content_data.py` |
| Tiêu chuẩn | Checklist CN và EU (mỗi cái 5 mục, có link nguồn) | |
| Liên hệ | 6 đơn vị công khai (SOFRI, Cục Trồng trọt và BVTV, Khuyến nông, ĐH Cần Thơ, VAAS, Bình Điền) | Chỉ có website, không có số điện thoại |
| Content release | Tự cắt release mới nếu nội dung thay đổi | |
| Model quét | Upload 3 model (leaf, stem, fruit) lên S3 và publish để app tải về | Lấy từ `../durianMobile/assets/models` |
| Admin | Chỉ tạo khi bạn đặt `SEED_ADMIN_USERNAME` và `SEED_ADMIN_PASSWORD` | Xem bước 3 |

Chạy lại bao nhiêu lần cũng được: dữ liệu có id cố định, model đã đăng thì bị bỏ qua, và release chỉ được cắt khi nội dung đổi.

## Seed không làm gì khi `APP_ENV` khác `dev`

Các phần dưới đây chỉ chạy ở môi trường dev và bị tắt trên production:

- User demo `dev:demo` và tài khoản `admin / 123456`.
- Báo cáo chat mẫu.
- `--household` (farm demo). Cờ này bị từ chối trên production.

Vì vậy `.env` production **phải** có `APP_ENV=prod` (đây là giá trị mặc định). Đừng đặt `APP_ENV=dev` trên production, vì `dev:<tên>` sẽ đăng nhập được mà không cần Google.

## Trước khi chạy

1. **Model còn trên đĩa.** Thư mục `durianMobile/assets/models/` phải có `manifest.json` và 3 file `.onnx` (khoảng 330 MB). Hiện chúng đang bị đánh dấu xoá trong git nhưng vẫn còn trên máy. Nếu đã mất, khôi phục bằng `git checkout HEAD -- durianMobile/assets/models`. Nếu để ở chỗ khác, dùng `--models-dir <thư mục>`.
2. **Mongo là replica set** (cần transaction). Dùng chuỗi kết nối production, ví dụ MongoDB Atlas.
3. **S3 hoặc MinIO có sẵn**, bucket được tạo tự động nếu chưa có.
4. Có `uv` và đã chạy `uv sync` trong `durianBackend/`.

## Các bước

Chạy trong thư mục `durianBackend/`. Không sửa `.env` dev: truyền biến cho riêng lệnh này, hoặc dùng một file env riêng.

### 1. Trỏ vào hạ tầng production

```bash
export APP_ENV=prod
export MONGO_URI='mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority'
export MONGO_DB=durian
export S3_ENDPOINT_URL='https://<s3-endpoint>'
export S3_PUBLIC_ENDPOINT_URL='https://<host-điện-thoại-truy-cập-được>'   # để trống nếu giống endpoint trên
export S3_BUCKET=<bucket>
export S3_ACCESS_KEY=<key>
export S3_SECRET_KEY=<secret>
export S3_REGION=<region>
```

`S3_PUBLIC_ENDPOINT_URL` rất quan trọng: link tải model được ký bằng host này, nên điện thoại phải truy cập được. Nếu để `localhost` thì app không tải được model.

Kiểm tra lại trước khi chạy:

```bash
uv run python -c "from app.config import get_settings as g; s=g(); print(s.app_env, s.mongo_db, s.s3_endpoint_url, s.s3_bucket)"
```

Kết quả phải là `prod` và đúng DB, bucket production.

### 2. Chạy seed

```bash
uv run python -m scripts.seed
```

Output mong đợi:

```
cut a new content release (POST /v1/admin/releases/retry reindexes RAG)
durianos_leaf 4186d615: published
durianos_stem 4186d615: published
durianos_fruit 4186d615: published
```

Lần chạy thứ hai sẽ in `already registered, skipped` cho model và không in dòng "cut a new content release". Upload model lần đầu có thể mất vài phút.

### 3. (Tuỳ chọn) Tạo tài khoản admin để dùng admin site

```bash
SEED_ADMIN_USERNAME=<tên> SEED_ADMIN_PASSWORD='<mật khẩu mạnh>' uv run python -m scripts.seed
```

Chạy lại với mật khẩu khác sẽ đổi mật khẩu của admin này. Không commit mật khẩu và không để nó trong lịch sử shell dùng chung.

### 4. Lập chỉ mục RAG cho chatbot

Chatbot chỉ trích dẫn được các bài sau khi chúng được nhúng vào Qdrant. Seed không có embedder, nên bước này làm trên API đang chạy production (cần `GEMINI_API_KEY` và `QDRANT_URL` đúng):

```bash
TOKEN=$(curl -s -X POST https://<api>/v1/auth/admin-login \
  -H 'content-type: application/json' \
  -d '{"username":"<tên>","password":"<mật khẩu>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s -X POST https://<api>/v1/admin/releases/retry -H "authorization: Bearer $TOKEN"
```

## Kiểm tra sau khi chạy

Lấy token bằng một tài khoản đăng nhập thật (hoặc token admin ở trên), rồi:

```bash
curl -s https://<api>/v1/content/manifest -H "authorization: Bearer $TOKEN"
curl -s https://<api>/v1/models/manifest  -H "authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["entries"]),"models")'
```

- Manifest nội dung có `release_no` ≥ 1 và release có 14 bài.
- Manifest model có đúng 3 entry (leaf, stem, fruit).
- Lấy link từ `GET /v1/models/{model_id}/{version}/download` rồi tải thử một file, link phải trả về file.
- Trên máy sạch, cài app, đăng nhập Google, mở tab tra cứu và kiểm tra bài viết, tiêu chuẩn, liên hệ; bấm từng link nguồn; thử scan một ảnh.
- Vào admin site và kiểm tra bài viết, tiêu chuẩn, liên hệ hiện ra đúng.

## Sửa nội dung sau này

- Sửa `scripts/seed_content_data.py` rồi chạy lại seed: các hàng cùng id sẽ được cập nhật tại chỗ và release mới được cắt.
- Hoặc sửa trực tiếp trong admin site (không cần seed). Seed chạy lại sẽ ghi đè các bài do seed tạo, nên chọn một trong hai cách cho mỗi bài.
- Muốn gỡ một bài do seed tạo: gỡ publish trong admin site và xoá bài đó khỏi `ARTICLES`, nếu không lần seed sau sẽ đăng lại.

## Thay model

Thêm model mới vào `manifest.json` và thư mục model (version khác), chạy lại seed. Model cùng `model_id` và version khác sẽ thay model đang chạy; đăng lại version cũ là rollback. Chi tiết xem `scripts/publish_models.py`.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `missing file .../*.onnx` | Thư mục model thiếu file, hãy dùng `--models-dir` hoặc khôi phục bằng git |
| `sha256 differs from the manifest` | File `.onnx` không khớp `manifest.json`, hãy lấy lại cặp file đúng |
| Treo hoặc lỗi kết nối S3 | Sai `S3_ENDPOINT_URL` hoặc khoá truy cập |
| App báo không tải được model | `S3_PUBLIC_ENDPOINT_URL` sai hoặc là `localhost` |
| Lỗi transaction ở Mongo | Mongo không phải replica set |
| Chat không trích dẫn bài mới | Chưa làm bước 4 (reindex), hoặc thiếu `GEMINI_API_KEY` |
| `--household is for APP_ENV=dev only` | Đúng thiết kế: không seed farm lên production |
