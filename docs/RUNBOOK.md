# Runbook vận hành

## Dừng khẩn cấp

1. Bấm `Dừng toàn hệ thống` trong Cài đặt.
2. Dừng scheduler/worker ở hạ tầng triển khai.
3. Không retry request timeout trước khi đọc lại trạng thái promotion.
4. Giữ nguyên giá khi thiếu dữ liệu; không ghi 0.

## SKU lỗi hoặc bị ghi đè

Tạm dừng SKU, kiểm tra giá/CTKM hiện tại, audit log và hệ thống đồng bộ khác (đặc biệt Nhanh.vn). Chỉ mở lại sau khi xác nhận nguồn ghi và rule.

## Khôi phục

Đọc snapshot gần nhất thành công; chạy lại một SKU ở Review; đọc lại sau ghi; đối soát lịch sử. Không chạy hàng loạt cho tới khi thử nghiệm nhỏ ổn định.

## Bí mật

Không ghi token/Partner Key vào frontend, log, issue hoặc hội thoại. Rotate token khi có dấu hiệu lộ; kiểm tra callback state và ràng buộc đúng shop connection.
