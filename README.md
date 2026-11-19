# Alpha Price Ops

MVP nội bộ cho Alpha Books theo dõi và review quyết định cạnh tranh giá Shopee.

## Trạng thái hiện tại

- Đã code: dashboard, danh sách cạnh tranh, hàng chờ duyệt, nhật ký, cài đặt và engine tính giá.
- Đã kiểm thử bằng mock: quy tắc theo tiền/%; sàn/trần; dữ liệu hết hạn/hết hàng; tăng giá; cooldown; tạm dừng.
- Chưa thử tích hợp thật: Shopee Open Platform, lấy giá đối thủ, cập nhật CTKM, worker production.
- Mặc định an toàn: Monitor/Review; không có đường ghi giá thật và không lưu secret ở frontend.

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

```bash
npm run test
npm run typecheck
npm run build
```

## Cấu trúc chính

- `app/page.tsx`: giao diện vận hành và trạng thái mock có thể tương tác.
- `src/lib/pricing.ts`: engine quyết định giá thuần, không phụ thuộc UI.
- `src/lib/mock-data.ts`: dữ liệu mẫu được gắn nhãn mock, không giả vờ là dữ liệu Shopee.
- `tests/pricing.runtime.test.ts`: kiểm thử runtime logic giá bằng Node test runner.
- `worker/README.md`: ranh giới worker độc lập cần triển khai tiếp.
- `docs/`: PRD, kiến trúc, kiểm chứng tích hợp, quyết định và runbook.

## Dữ liệu và an toàn

Không dán Partner Key, token hay secret vào hội thoại, frontend, log hoặc Git. Khi triển khai thật, inject secret ở worker/server và tách token theo `shop_id`. Không bật Auto hoặc ghi dữ liệu hàng loạt khi chưa hoàn thành kiểm chứng quyền API, nguồn giá đối thủ và một lần thử được chủ dự án phê duyệt.
