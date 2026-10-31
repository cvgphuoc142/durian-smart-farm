# Sign in with Apple – Setup & Test

App: `com.durianfarm.mobile` · Backend env: `APPLE_CLIENT_IDS=["com.durianfarm.mobile"]`

## A. Bật capability trên Apple Developer

1. Vào https://developer.apple.com/account và đăng nhập tài khoản trả phí ($99/năm).
2. Chọn **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Tìm App ID có Bundle ID `com.durianfarm.mobile`.
   - Nếu chưa có thì bấm **+** → **App IDs** → **App** → Continue. Description đặt "Durian Farm", Bundle ID chọn **Explicit** và nhập `com.durianfarm.mobile`.
   - Nếu bạn dùng EAS và đã build lần nào rồi, EAS có thể đã tạo sẵn.
4. Trong danh sách **Capabilities**, tick **Sign In with Apple**. Bấm **Edit** bên cạnh và để mặc định **Enable as a primary App ID**.
5. **Save** (hoặc Continue → Register nếu tạo mới), rồi **Confirm**.

## B. Build lại app

Capability cần entitlement mới, nên phải build lại.

**Cách 1 – EAS** (khuyến nghị nếu đã dùng `eas.json`):

```bash
cd durianMobile
eas build --profile development --platform ios
```

Khi EAS hỏi đăng nhập Apple và tạo lại provisioning profile thì đồng ý. Để chạy trên máy thật, thiết bị cần được đăng ký (`eas device:create`) và bật Developer Mode.

**Cách 2 – local** (cần Xcode, cắm iPhone):

```bash
cd durianMobile
npx expo prebuild --platform ios --clean
npx expo run:ios --device
```

Trong Xcode, mục Signing & Capabilities của target phải có **Sign in with Apple** và Team đúng. `usesAppleSignIn: true` trong `app.json` sẽ tự thêm entitlement khi prebuild.

## C. Chuẩn bị máy test

1. Dùng **iPhone thật**. Simulator rất hay lỗi.
2. Vào Settings → đầu trang → đăng nhập **Apple ID** (có bật 2FA).
3. Bật Developer Mode: Settings → Privacy & Security → Developer Mode (nếu build dev).
4. Backend phải chạy và điện thoại truy cập được. Kiểm tra `EXPO_PUBLIC_API_URL` (hoặc config tương đương trong `src/config`) trỏ đúng IP LAN. Env backend đã có `APPLE_CLIENT_IDS`; nhớ **restart** backend.

## D. Các ca test

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở app ở màn Sign In | Hiện nút **Continue with Apple** màu đen (iOS thật) |
| 2 | Bấm nút, chọn **Share My Email** hoặc **Hide My Email** | Sheet Face ID, sau đó vào app và sang màn setup |
| 3 | Vào More/Settings | `display_name` là tên bạn (lần đầu Apple có trả tên) |
| 4 | Logout rồi login Apple lại | Vào lại cùng account, tên vẫn giữ |
| 5 | Bấm nút rồi Cancel | Không hiện lỗi |
| 6 | Tắt backend rồi login | Hiện banner `signIn.failed` |

Kiểm tra DB sau ca 2 (tên chỉ có ở lần đăng nhập đầu):

```js
db.users.find({provider: "apple"})
```

Sẽ thấy `subject` dạng `001234.abcd…` và `display_name`.

## E. Lỗi hay gặp

- **Không có nút Apple**: build chưa có entitlement. Build lại, hoặc đang chạy Expo Go / Simulator chưa đăng nhập Apple ID.
- **`AuthorizationError 1000` / `1001`**: capability chưa bật, bundle id không khớp, hoặc chưa đăng nhập Apple ID trên máy.
- **Backend trả `invalid_provider_token`**: `APPLE_CLIENT_IDS` sai hoặc chưa restart. Xem log backend: audience của token phải là `com.durianfarm.mobile`.
- **Tên rỗng sau khi đã đăng nhập Apple một lần**: Apple chỉ gửi tên ở lần đầu cho mỗi app. Để test lại, vào Settings → Apple ID → **Sign-In & Security → Sign in with Apple** → chọn Durian Farm → **Stop Using Apple ID**, rồi xoá user cũ trong DB và đăng nhập lại.

## F. Ghi chú App Store

- **Guideline 4.8**: app có Google login thì bắt buộc có Sign in with Apple.
- **5.1.1(v)**: app tạo tài khoản phải có chức năng xoá tài khoản. Revoke token Apple khi xoá cần Key `.p8` (chưa làm).
- Backend chưa check `nonce`; có thể bổ sung để tăng bảo mật.
