# Decision log

## 19/11/2026 — Mock-first, approval-gated

Chọn triển khai engine + UI + test với mock adapter trước vì chưa có bằng chứng về quyền Shopee và nguồn đối thủ. Giúp kiểm chứng luồng và các hàng rào giá mà không tạo external write.

## 19/11/2026 — Giá sàn là input

MVP không suy ra giá sàn từ giá vốn. Người dùng nhập sàn/trần và engine phải giải thích khi sàn làm mất mức chênh mục tiêu.

## 19/11/2026 — Không lấy thấp nhất của cả listing

Mỗi competitor offer mang `variantName`; chỉ so sánh offer đã gắn đúng phân loại và còn hàng.

## 19/11/2026 — Không bật Auto thật

Auto chỉ là một mode được hiển thị trong mock data. Chưa có đường ghi production cho đến khi quyền, CTKM, thử nghiệm SKU và đọc lại xác nhận hoàn tất.
