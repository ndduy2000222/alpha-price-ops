# PRD — Alpha Price Ops MVP

## Mục tiêu

Theo dõi giá sau giảm trực tiếp của đúng phân loại tại các shop đối thủ được gắn thủ công; tính đề xuất theo quy tắc xác định; giới hạn trong giá sàn/trần; hỗ trợ Monitor, Review, Auto sau khi kiểm chứng tích hợp.

## Phạm vi MVP

Một shop Alpha Books, 20 SKU thử nghiệm, tối đa ba đối thủ/SKU, ghép thủ công, chưa tính voucher cá nhân/xu/phí vận chuyển/livestream, chưa bật ghi giá thật.

## Luồng chính

1. Worker đọc dữ liệu shop/đối thủ theo lịch và lưu snapshot.
2. Engine lọc dữ liệu hợp lệ, chọn giá thấp nhất, tính giá theo quy tắc và áp sàn/trần.
3. Monitor chỉ ghi nhận; Review tạo hàng chờ; Auto chỉ thực thi khi bật rõ ràng và đủ điều kiện.
4. Review đọc lại trước khi ghi; ghi xong phải đọc lại xác nhận; mọi quyết định lưu audit log.

## Điều kiện chặn

Không có đối thủ hợp lệ, dữ liệu cũ, sai phân loại, hết hàng/không xác định được trạng thái, CTKM không tương thích, SKU/toàn hệ thống tạm dừng, cooldown, vượt biến động hoặc vượt giới hạn ngày.

## Nghiệm thu

Engine không vượt sàn/trần; Monitor không ghi; Review chỉ ghi đề xuất còn hợp lệ đã duyệt; Auto chỉ ghi khi bật; lịch sử giải thích được; worker production chạy độc lập với trình duyệt.
