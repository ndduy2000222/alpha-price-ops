# Kiến trúc

## Hiện trạng MVP

Next.js + TypeScript cho web quản trị. `src/lib/pricing.ts` là domain engine thuần, UI dùng mock adapter và state trong phiên để minh họa luồng thao tác. Chưa có database, auth hoặc API production trong workspace này.

## Kiến trúc đích

- Web: Next.js Route Handlers/Server Components, Supabase Auth, chỉ đọc dữ liệu persisted.
- Database: PostgreSQL/Supabase với `shops`, `shop_connections`, `products`, `models`, `competitor_links`, `observations`, `pricing_rules`, `recommendations`, `write_jobs`, `audit_events`.
- Worker: Node.js/TypeScript độc lập; scheduler + queue; lock `(shop_id, sku_id)`; retry hữu hạn; timeout/reconcile khi timeout.
- Adapters: `CompetitorPriceSource`, `ShopeeCatalogReader`, `ShopeePromotionWriter`, thay được mà không sửa engine.

## Ranh giới bảo mật

Token/Partner Key chỉ ở server/worker secret store. Mọi bản ghi mang `shop_id`; không trộn Alpha Books Official và shop khác. UI hiển thị trạng thái đã redacted.

## Ghi chú triển khai

Không dùng LLM để quyết định giá từng lượt chạy. Quyết định phải do engine deterministic và lưu phiên bản rule cùng dữ liệu đầu vào.
