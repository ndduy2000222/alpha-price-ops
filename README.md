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

Database mode hiện chỉ đọc dữ liệu. Luồng approval, worker Shopee và ghi giá thật vẫn bị khóa cho tới khi hoàn tất xác thực quyền, audit và pilot một SKU.

## Cấu trúc chính

- `app/page.tsx`: giao diện vận hành và trạng thái mock có thể tương tác.
- `src/lib/pricing.ts`: engine quyết định giá thuần, không phụ thuộc UI.
- `src/lib/mock-data.ts`: dữ liệu mẫu được gắn nhãn mock, không giả vờ là dữ liệu Shopee.
- `tests/pricing.runtime.test.ts`: kiểm thử runtime logic giá bằng Node test runner.
- `worker/README.md`: ranh giới worker độc lập cần triển khai tiếp.
- `docs/`: PRD, kiến trúc, kiểm chứng tích hợp, quyết định và runbook.

## Dữ liệu và an toàn

Không dán Partner Key, token hay secret vào hội thoại, frontend, log hoặc Git. Khi triển khai thật, inject secret ở worker/server và tách token theo `shop_id`. Không bật Auto hoặc ghi dữ liệu hàng loạt khi chưa hoàn thành kiểm chứng quyền API, nguồn giá đối thủ và một lần thử được chủ dự án phê duyệt.
