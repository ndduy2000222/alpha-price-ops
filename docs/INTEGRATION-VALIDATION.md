# Kiểm chứng tích hợp

Ngày ghi nhận: 19/11/2026.

## Đã xác minh

- UI có trạng thái phân biệt rõ `mock adapter`; không tuyên bố kết nối Shopee hoàn tất.
- Engine tính giá có kiểm thử cho tiền, %, sàn, dữ liệu cũ/hết hàng, tăng giá, cooldown và pause.
- Hàng chờ có nút đọc lại, duyệt, từ chối; tất cả chỉ thay đổi trạng thái mock và audit log local trong phiên.
- Có cảnh báo rằng request thành công chưa đủ; production phải đọc lại để xác nhận.

## Chưa xác minh

- Trạng thái phê duyệt app Shopee Open Platform và quyền production.
- Quyền đọc catalog/model/CTKM và khả năng tạo/cập nhật promotion của tài khoản.
- Nguồn giá đối thủ được phép và độ ổn định qua khoảng 10 link Shopee Việt Nam.
- Hạn mức API, lỗi cụ thể, chính sách/chống truy cập tự động, CAPTCHA.
- Hệ thống khác (ví dụ Nhanh.vn) có đang đồng bộ giá hay không.

## Bằng chứng hiện tại

Chưa có link Shopee do chủ dự án cung cấp, chưa có credential an toàn trong worker, nên chưa thực hiện request thật. Đây là trạng thái có chủ đích, không phải tích hợp thất bại.

## Điều kiện để tiếp tục

1. Chủ dự án cung cấp khoảng 10 link sản phẩm đối thủ và 1 SKU/phân loại test của shop Alpha Books.
2. Xác nhận nơi cấu hình secret an toàn và quyền truy cập Shopee production.
3. Xác nhận có/không có Nhanh.vn hoặc hệ thống khác ghi giá.
4. Duyệt một lần thử ghi cụ thể sau khi màn hình hiển thị đúng shop, SKU, CTKM, giá trước/sau.
