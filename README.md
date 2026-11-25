# Alpha Price Ops

MVP nội bộ cho Alpha Books theo dõi và review quyết định cạnh tranh giá Shopee.

## Trạng thái hiện tại

- Đã code: dashboard, danh sách cạnh tranh, hàng chờ duyệt, nhật ký, cài đặt và engine tính giá.
- Đã kiểm thử bằng mock: quy tắc theo tiền/%; sàn/trần; dữ liệu hết hạn/hết hàng; tăng giá; cooldown; tạm dừng.
- Chưa thử tích hợp thật: Shopee Open Platform, lấy giá đối thủ, cập nhật CTKM, worker production.
- Mặc định an toàn: Monitor/Review; không có đường ghi giá thật và không lưu secret ở frontend.

## Chạy local

```bash
pnpm install
pnpm dev
```

Mở `http://localhost:3000`.

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Nền tảng production an toàn

- `demo` là chế độ mặc định, dùng dữ liệu mẫu để trình diễn và không cần dịch vụ bên ngoài.
- `database` đọc PostgreSQL ở server-side khi đã cấu hình `DATABASE_URL` và `ALPHA_DATA_MODE=database`.
- Chạy migration `db/migrations/001_initial_schema.sql` bằng công cụ migration của nhà cung cấp PostgreSQL trước khi bật database mode.
- Sao chép `.env.example` thành `.env.local`; không đưa `.env.local`, token hay Partner Key vào Git.
- `/api/health` kiểm tra trạng thái ứng dụng và database; `/api/dashboard` trả snapshot cho giao diện.
- `POST /api/sync/shopee/products` đọc danh sách sản phẩm Shopee theo từng trang nhỏ và theo các trạng thái `NORMAL`, `UNLIST`, `BANNED`, `DELETED`, sau đó lấy model/giá/tồn kho và lưu vào `products`, `product_models`, `price_snapshots`, `sync_runs`. Nút `Đồng bộ Shopee` tự chạy tiếp bằng cursor cho tới khi hết toàn bộ trang, phù hợp với shop có hàng nghìn sản phẩm.

Database mode hiện đọc dữ liệu thật sau khi chạy sync. Luồng approval, worker định kỳ, dữ liệu đối thủ và ghi giá thật vẫn bị khóa cho tới khi hoàn tất kiểm chứng và pilot một SKU.

## Callback Shopee Open Platform

Callback OAuth production là `https://alpha-price-ops.vercel.app/api/integrations/shopee/callback`. App chỉ lưu token đã mã hóa ở server khi đủ `DATABASE_URL`, `ALPHA_DATA_MODE=database`, `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` và khóa mã hóa 32-byte `SHOPEE_TOKEN_ENCRYPTION_KEY`. Không đưa Partner Key hoặc token vào frontend, log, commit hay hội thoại.

## Cấu trúc chính

- `app/page.tsx`: giao diện vận hành và trạng thái mock có thể tương tác.
- `src/lib/pricing.ts`: engine quyết định giá thuần, không phụ thuộc UI.
- `src/lib/mock-data.ts`: dữ liệu mẫu được gắn nhãn mock, không giả vờ là dữ liệu Shopee.
- `tests/pricing.runtime.test.ts`: kiểm thử runtime logic giá bằng Node test runner.
- `worker/README.md`: ranh giới worker độc lập cần triển khai tiếp.
- `docs/`: PRD, kiến trúc, kiểm chứng tích hợp, quyết định và runbook.

## Dữ liệu và an toàn

Không dán Partner Key, token hay secret vào hội thoại, frontend, log hoặc Git. Khi triển khai thật, inject secret ở worker/server và tách token theo `shop_id`. Không bật Auto hoặc ghi dữ liệu hàng loạt khi chưa hoàn thành kiểm chứng quyền API, nguồn giá đối thủ và một lần thử được chủ dự án phê duyệt.

