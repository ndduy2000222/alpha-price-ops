"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateRecommendation } from "@/src/lib/pricing";
import { DecisionRecord, OperatingMode, TrackedSku } from "@/src/lib/types";

const vndFormatter = new Intl.NumberFormat("vi-VN");
const vnd = (value?: number) => value == null ? "—" : `${vndFormatter.format(value)}đ`;
const timeNow = () => new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date());

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3.4 13.4a2 2 0 0 1 0-2.8l7.2-7.2A2 2 0 0 1 12 2.8h6.2a2 2 0 0 1 2 2V11a2 2 0 0 1-.6 1.4Z"/><circle cx="16.5" cy="7.5" r="1"/></>,
    inbox: <><path d="M4 4h16l1 10a3 3 0 0 1-3 3h-3l-2 3-2-3H6a3 3 0 0 1-3-3L4 4Z"/><path d="M3.4 13h4.1l1.4 2h6.2l1.4-2h4.1"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.5v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.5h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>,
  };
  return <svg {...common} aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

const nav = [
  { id: "overview", label: "Tổng quan", icon: "grid" },
  { id: "competition", label: "Cạnh tranh giá", icon: "tag" },
  { id: "queue", label: "Hàng chờ duyệt", icon: "inbox" },
  { id: "journal", label: "Nhật ký", icon: "book" },
  { id: "settings", label: "Cài đặt", icon: "gear" },
];

export default function Home() {
  const [page, setPage] = useState("overview");
  const [skus, setSkus] = useState<TrackedSku[]>([]);
  const [logs, setLogs] = useState<DecisionRecord[]>([]);
  const [dataMode, setDataMode] = useState<"demo" | "database">("demo");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrackedSku | null>(null);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Không thể tải dữ liệu dashboard.");
        return response.json() as Promise<{ mode: "demo" | "database"; skus: TrackedSku[]; decisions: DecisionRecord[] }>;
      })
      .then((snapshot) => {
        if (cancelled) return;
        setSkus(snapshot.skus);
        setLogs(snapshot.decisions);
        setDataMode(snapshot.mode);
      })
      .catch((error: unknown) => {
        if (!cancelled) setToast(error instanceof Error ? error.message : "Không thể tải dữ liệu dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const queue = skus.filter((item) => item.status === "needs_review" || item.status === "suggested");
  const filtered = useMemo(() => skus.filter((item) => {
    const text = `${item.sku} ${item.title} ${item.variant}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter);
  }), [skus, query, statusFilter]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const updateSku = (id: string, patch: Partial<TrackedSku>, log?: Omit<DecisionRecord, "createdAt">) => {
    setSkus((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    if (log) setLogs((items) => [{ ...log, createdAt: timeNow() }, ...items]);
  };
  const approve = (item: TrackedSku) => {
    if (globalPaused) return notify("Toàn hệ thống đang tạm dừng. Không thể duyệt.");
    updateSku(item.id, { status: "unchanged", reason: "Đã duyệt trên bản mock; chưa ghi giá lên Shopee thật." }, { id: crypto.randomUUID(), skuId: item.id, sku: item.sku, action: "approve", beforePrice: item.currentPrice, afterPrice: item.recommendation, reason: "Đã duyệt đề xuất (mock). Luồng ghi Shopee thật chưa được bật.", source: "mock" });
    notify(`${item.sku} đã được duyệt ở chế độ mô phỏng.`);
  };
  const reject = (item: TrackedSku) => {
    updateSku(item.id, { status: "unchanged", reason: "Người dùng từ chối đề xuất lần này." }, { id: crypto.randomUUID(), skuId: item.id, sku: item.sku, action: "reject", beforePrice: item.currentPrice, reason: "Đề xuất bị từ chối.", source: "mock" });
    notify(`${item.sku} đã được bỏ qua.`);
  };
  const togglePause = (id: string) => {
    const item = skus.find((entry) => entry.id === id);
    if (!item) return;
    updateSku(id, { paused: !item.paused, status: !item.paused ? "paused" : "suggested", reason: !item.paused ? "SKU đã được tạm dừng thủ công." : "SKU đã tiếp tục theo dõi." });
    notify(!item.paused ? `${item.sku} đã tạm dừng.` : `${item.sku} đã tiếp tục.`);
  };
  const refreshPreview = (item: TrackedSku) => {
    const result = calculateRecommendation({ ...item, offers: item.competitorOffers, now: new Date("2026-11-19T08:00:00.000Z") });
    updateSku(item.id, { status: result.status, recommendation: result.proposedPrice, reason: result.reason });
    notify(`Đã đọc lại dữ liệu mock cho ${item.sku}.`);
  };
  const syncProducts = async () => {
    if (syncing) return;
    setSyncing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch("/api/sync/shopee/products", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: controller.signal });
      const result = await response.json() as { ok?: boolean; error?: string; itemsSeen?: number; modelsUpserted?: number };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Không thể đồng bộ sản phẩm Shopee.");
      const snapshot = await fetch("/api/dashboard", { cache: "no-store" }).then((value) => value.json()) as { mode: "demo" | "database"; skus: TrackedSku[]; decisions: DecisionRecord[] };
      setSkus(snapshot.skus);
      setLogs(snapshot.decisions);
      setDataMode(snapshot.mode);
      notify(`Đã đồng bộ ${result.itemsSeen ?? 0} sản phẩm và ${result.modelsUpserted ?? 0} phân loại từ Shopee.`);
    } catch (error) {
      notify(error instanceof DOMException && error.name === "AbortError" ? "Đồng bộ quá thời gian chờ. Vui lòng kiểm tra lại quyền Shopee hoặc thử lại." : error instanceof Error ? error.message : "Không thể đồng bộ sản phẩm Shopee.");
    } finally {
      clearTimeout(timeout);
      setSyncing(false);
    }
  };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" /> <span>Alpha Price Ops</span></div>
      <div className="sidebar-label">VẬN HÀNH</div>
      <nav aria-label="Điều hướng chính">{nav.map((entry) => <button key={entry.id} aria-current={page === entry.id ? "page" : undefined} className={`nav-item ${page === entry.id ? "active" : ""}`} onClick={() => setPage(entry.id)}><Icon name={entry.icon} /><span>{entry.label}</span>{entry.id === "queue" && <span className="nav-count" aria-label={`${queue.length} mục chờ duyệt`}>{queue.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="worker-dot"><span /> {dataMode === "database" ? "Database adapter" : "Worker mock đang chạy"}</div><div className="sidebar-note">Nguồn dữ liệu hiện tại<br /><strong>{dataMode === "database" ? "PostgreSQL" : "Mock adapter"}</strong></div></div>
    </aside>
    <main className="main-shell" id="main-content" tabIndex={-1}>
      <header className="topbar"><div className="top-group"><span className="top-label">Sàn</span><button className="select-button"><span className="shopee-icon">S</span>Shopee <Icon name="chevron" /></button><span className="divider" /><button className="select-button shop-select">Nhà Sách Alpha Official <Icon name="chevron" /></button></div><div className="top-group"><button className="ghost-button sync-button" onClick={syncProducts} disabled={syncing}>{syncing ? "Đang đồng bộ…" : "Đồng bộ Shopee"}</button><span className={`live-status ${globalPaused ? "paused" : ""}`}><span /> {globalPaused ? "Đã tạm dừng" : "Theo dõi đang hoạt động"}</span><span className="updated">Cập nhật: 14:26, 19/11/2026</span></div></header>
      <div className="content">
        {loading && <div className="loading-banner" role="status">Đang tải dữ liệu vận hành…</div>}
        {page === "overview" && <Overview skus={skus} queue={queue} setPage={setPage} onSelect={setSelected} globalPaused={globalPaused} dataMode={dataMode} />}
        {page === "competition" && <Competition skus={filtered} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelected} onPause={togglePause} />}
        {page === "queue" && <Queue queue={queue} onApprove={approve} onReject={reject} onRefresh={refreshPreview} onSelect={setSelected} globalPaused={globalPaused} />}
        {page === "journal" && <Journal logs={logs} />}
        {page === "settings" && <Settings globalPaused={globalPaused} setGlobalPaused={(value) => { setGlobalPaused(value); notify(value ? "Đã tạm dừng toàn hệ thống." : "Đã tiếp tục worker mock."); }} />}
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Điều hướng di động">{nav.map((entry) => <button key={entry.id} aria-current={page === entry.id ? "page" : undefined} className={page === entry.id ? "active" : ""} onClick={() => setPage(entry.id)}><Icon name={entry.icon} /><span>{entry.label}</span>{entry.id === "queue" && queue.length > 0 && <b>{queue.length}</b>}</button>)}</nav>
    {selected && <SkuModal item={selected} onClose={() => setSelected(null)} onPause={togglePause} onRefresh={refreshPreview} />}
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
  </div>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Overview({ skus, queue, setPage, onSelect, globalPaused, dataMode }: { skus: TrackedSku[]; queue: TrackedSku[]; setPage: (p: string) => void; onSelect: (s: TrackedSku) => void; globalPaused: boolean; dataMode: "demo" | "database" }) {
  const below = skus.filter((item) => item.recommendation && item.currentPrice > (item.recommendation ?? item.currentPrice)).length;
  const unchanged = skus.filter((item) => item.status === "unchanged").length;
  return <><PageTitle title="Tổng quan" description="Theo dõi và điều chỉnh giá trong giới hạn bạn đã đặt." action={<select aria-label="Khoảng thời gian thống kê" className="date-select" defaultValue="7"><option value="7">7 ngày gần đây</option><option value="30">30 ngày gần đây</option></select>} />
    <div className="data-context"><span className="context-badge">{dataMode === "database" ? "Dữ liệu PostgreSQL" : "Dữ liệu mô phỏng"}</span><span>{dataMode === "database" ? `Các chỉ số được đọc từ snapshot vận hành của ${skus.length} SKU.` : `Các chỉ số bên dưới được tính trực tiếp từ ${skus.length} SKU mẫu hiện có.`}</span></div>
    <div className="metric-grid"><Metric label="SKU đang theo dõi" value={String(skus.length)} detail="trong phạm vi hiện tại" tone="neutral" /><Metric label="Đang cao hơn đối thủ" value={String(below)} detail={`trên ${skus.length} SKU`} tone="orange" /><Metric label="Đề xuất điều chỉnh" value={String(queue.length)} detail="đang chờ người duyệt" tone="amber" /><Metric label="Giữ nguyên an toàn" value={String(unchanged)} detail="không cần điều chỉnh" tone="green" /></div>
    <div className="dashboard-grid"><section className="surface competition-surface"><div className="section-heading"><div><h2>Cạnh tranh giá</h2><p>Giá đối thủ sau giảm trực tiếp của đúng phân loại.</p></div><button className="text-button" onClick={() => setPage("competition")}>Xem tất cả <Icon name="arrow" /></button></div><CompetitionTable items={skus.slice(0, 6)} onSelect={onSelect} compact /></section><aside className="right-rail"><QueueCard queue={queue.slice(0, 4)} onApprove={() => setPage("queue")} onSelect={onSelect} /><ActivityCard /></aside></div>
    <div className="notice-bar"><span className="notice-icon">i</span><span><strong>{globalPaused ? "Toàn hệ thống đang tạm dừng." : "Đang ở chế độ an toàn."}</strong> {dataMode === "database" ? "Dashboard đang đọc snapshot từ PostgreSQL;" : "Worker hiện chỉ tạo đề xuất từ mock adapter;"} chưa có quyền ghi giá thật lên Shopee.</span><button onClick={() => setPage("settings")}>Xem cài đặt</button></div>
  </>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`metric-card metric-${tone}`}><div className="metric-label">{label}</div><div className={`metric-value ${tone}`}>{value}</div><div className="metric-detail">{detail}</div></div>; }

function Competition({ skus, query, setQuery, statusFilter, setStatusFilter, onSelect, onPause }: { skus: TrackedSku[]; query: string; setQuery: (s: string) => void; statusFilter: string; setStatusFilter: (s: string) => void; onSelect: (s: TrackedSku) => void; onPause: (id: string) => void }) {
  return <><PageTitle eyebrow="DANH SÁCH VẬN HÀNH" title="Cạnh tranh giá" description="Mỗi dòng là một SKU và phân loại cụ thể, không lấy giá thấp nhất của cả listing." action={<button className="primary-button" onClick={() => alert("MVP: thêm SKU sẽ mở sau khi kết nối Shopee được xác minh.")}>+ Thêm SKU theo dõi</button>} /><div className="surface table-surface"><div className="toolbar"><label className="search-box"><span className="sr-only">Tìm SKU hoặc sản phẩm</span><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo SKU, tên sách, phân loại..." /></label><select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Trạng thái: Tất cả</option><option value="needs_review">Chờ duyệt</option><option value="suggested">Đề xuất</option><option value="unchanged">Không đổi</option><option value="paused">Tạm dừng</option></select><select aria-label="Lọc theo mức cạnh tranh" defaultValue="all"><option value="all">Mức cạnh tranh: Tất cả</option><option>Đang đắt hơn</option><option>Đang ngang giá</option></select><select aria-label="Lọc theo đối thủ" defaultValue="all"><option value="all">Đối thủ: Tất cả</option><option>BBooks</option><option>BookShop VN</option></select></div><CompetitionTable items={skus} onSelect={onSelect} onPause={onPause} /><div className="pagination"><span>Hiển thị {skus.length} SKU</span><div><button className="page-btn active" aria-current="page">1</button></div></div></div></>;
}

function CompetitionTable({ items, onSelect, onPause, compact = false }: { items: TrackedSku[]; onSelect: (s: TrackedSku) => void; onPause?: (id: string) => void; compact?: boolean }) {
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>SKU / Sản phẩm</th><th>Giá shop</th><th>Thấp nhất đối thủ</th><th>Chênh lệch</th><th>Đối thủ</th><th>Đề xuất</th><th>Trạng thái</th>{!compact && <th>Thao tác</th>}</tr></thead><tbody>{items.map((item) => { const offer = item.competitorOffers.find((o) => o.valid && o.inStock); const delta = offer ? ((item.currentPrice - offer.price) / offer.price) * 100 : 0; return <tr key={item.id}><td data-label="Sản phẩm"><button className="sku-button" onClick={() => onSelect(item)} aria-label={`Mở chi tiết ${item.sku} ${item.title}`}><span className="book-thumb">{item.title.slice(0, 1)}</span><span className="sku-cell-copy"><strong>{item.sku}</strong><span>{item.title}</span><small>{item.variant}</small></span></button></td><td data-label="Giá shop" className="price-cell">{vnd(item.currentPrice)}</td><td data-label="Giá đối thủ" className="price-cell">{vnd(offer?.price)}</td><td data-label="Chênh lệch"><span className={delta > 0 ? "delta up" : "delta flat"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</span></td><td data-label="Đối thủ">{offer?.shopName ?? "—"}<small className="muted-line">{offer ? `Cập nhật ${new Date(offer.observedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Chưa có dữ liệu"}</small></td><td data-label="Đề xuất" className="proposal-cell">{item.recommendation ? <><strong>{vnd(item.recommendation)}</strong><small>{item.reason.slice(0, 28)}…</small></> : "—"}</td><td data-label="Trạng thái"><Status status={item.status} mode={item.mode} /></td>{!compact && <td data-label="Thao tác"><button className="row-more" onClick={() => onPause?.(item.id)}>{item.paused ? "Tiếp tục" : "Dừng"}</button></td>}</tr>; })}</tbody></table></div>;
}

function Status({ status, mode }: { status: string; mode: OperatingMode }) { const text = status === "needs_review" ? "Chờ duyệt" : status === "suggested" ? "Đề xuất" : status === "paused" ? "Tạm dừng" : status === "blocked" ? "Bị chặn" : "Không đổi"; return <div><span className={`status status-${status}`}>{text}</span><small className="mode-line">{mode}</small></div>; }

function Queue({ queue, onApprove, onReject, onRefresh, onSelect, globalPaused }: { queue: TrackedSku[]; onApprove: (s: TrackedSku) => void; onReject: (s: TrackedSku) => void; onRefresh: (s: TrackedSku) => void; onSelect: (s: TrackedSku) => void; globalPaused: boolean }) { return <><PageTitle eyebrow="REVIEW GATE" title="Hàng chờ duyệt" description="Đọc lại dữ liệu trước khi thực thi. Mọi thao tác dưới đây vẫn đang ở mock adapter." action={<span className="safe-chip"><span /> Chưa có ghi thật</span>} /><div className="queue-layout"><section className="surface queue-list"><div className="list-toolbar"><strong>{queue.length} đề xuất cần xử lý</strong><span>Sắp xếp: mới nhất</span></div>{queue.length ? queue.map((item) => <div className="queue-row" key={item.id}><div className="queue-main"><span className="book-thumb large">{item.title.slice(0, 1)}</span><div><div className="queue-title"><strong>{item.sku} — {item.title}</strong><span className={`status status-${item.status}`}>{item.status === "needs_review" ? "Cần đọc lại" : "Đề xuất"}</span></div><p>{vnd(item.currentPrice)} <span>→</span> <b>{vnd(item.recommendation)}</b> <em>{item.reason}</em></p><small>Đối thủ: {item.competitorOffers[0]?.shopName ?? "—"} · Dữ liệu mock · Cập nhật hôm nay</small></div></div><div className="queue-actions"><button className="ghost-button" onClick={() => onRefresh(item)}>Đọc lại</button><button className="ghost-button danger" onClick={() => onReject(item)}>Từ chối</button><button className="primary-button small" disabled={globalPaused} onClick={() => onApprove(item)}>Duyệt</button><button className="icon-button" aria-label={`Mở chi tiết ${item.sku}`} onClick={() => onSelect(item)}>›</button></div></div>) : <EmptyState text="Không còn đề xuất chờ duyệt." />}</section><aside className="surface queue-guide"><h2>Nguyên tắc duyệt</h2><GuideRow n="01" title="Đọc lại dữ liệu" text="Đề xuất hết hạn phải tính lại trước khi duyệt." /><GuideRow n="02" title="Kiểm tra phạm vi" text="Đúng shop, SKU, phân loại và CTKM tương thích." /><GuideRow n="03" title="Xác nhận kết quả" text="Request thành công không đồng nghĩa giá đã áp dụng." /></aside></div></>; }
function GuideRow({ n, title, text }: { n: string; title: string; text: string }) { return <div className="guide-row"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-symbol">✓</div><strong>{text}</strong><p>Hệ thống giữ nguyên giá khi chưa có dữ liệu hợp lệ.</p></div>; }

function QueueCard({ queue, onApprove, onSelect }: { queue: TrackedSku[]; onApprove: () => void; onSelect: (s: TrackedSku) => void }) { return <section className="surface side-card"><div className="section-heading"><div><h2>Hàng chờ duyệt <span className="count-badge">{queue.length}</span></h2></div><button className="primary-button small" onClick={onApprove}>Xem hàng chờ</button></div>{queue.map((item) => <button className="mini-queue" key={item.id} onClick={() => onSelect(item)}><div><strong>{item.sku} — {item.title}</strong><span>{vnd(item.currentPrice)} → {vnd(item.recommendation)}</span><small>Đối thủ: {item.competitorOffers[0]?.shopName}</small></div><span className="status status-suggested">Đề xuất</span></button>)}<button className="link-row" onClick={onApprove}>Xem tất cả đề xuất <Icon name="arrow" /></button></section>; }
function ActivityCard() { const rows = [{ dot: "green", text: "Tạo đề xuất điều chỉnh (5 SKU)", time: "13:56" }, { dot: "green", text: "Cập nhật giá từ Shopee (mock)", time: "13:42" }, { dot: "amber", text: "Có 6 đề xuất chờ duyệt", time: "13:40" }, { dot: "green", text: "Bắt đầu theo dõi cạnh tranh giá", time: "08:55" }]; return <section className="surface side-card activity-card"><h2>Nhật ký gần đây</h2>{rows.map((row) => <div className="activity-row" key={row.text}><span className={`activity-dot ${row.dot}`} /><span>{row.text}</span><time>{row.time}</time></div>)}<button className="link-row">Mở nhật ký <Icon name="arrow" /></button></section>; }

function Journal({ logs }: { logs: DecisionRecord[] }) { return <><PageTitle eyebrow="AUDIT TRAIL" title="Nhật ký quyết định" description="Mọi đề xuất, duyệt, từ chối và bỏ qua đều có nguyên nhân và nguồn dữ liệu." action={<button className="ghost-button">Xuất nhật ký</button>} /><section className="surface journal-table"><div className="journal-filters"><span className="safe-chip"><span /> Nguồn: mock adapter</span><span>{logs.length} sự kiện gần nhất</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Thời gian</th><th>SKU</th><th>Hành động</th><th>Giá trước / sau</th><th>Lý do</th><th>Nguồn</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td data-label="Thời gian">{log.createdAt}</td><td data-label="SKU"><strong>{log.sku}</strong></td><td data-label="Hành động"><span className={`action-tag action-${log.action}`}>{log.action === "approve" ? "Đã duyệt" : log.action === "reject" ? "Từ chối" : log.action === "suggest" ? "Đề xuất" : "Bỏ qua"}</span></td><td data-label="Giá trước / sau">{vnd(log.beforePrice)} {log.afterPrice ? <><span className="arrow-muted">→</span> {vnd(log.afterPrice)}</> : ""}</td><td data-label="Lý do">{log.reason}</td><td data-label="Nguồn"><span className="source-dot" /> {log.source}</td></tr>)}</tbody></table></div></section></>; }

function Settings({ globalPaused, setGlobalPaused }: { globalPaused: boolean; setGlobalPaused: (v: boolean) => void }) { return <><PageTitle eyebrow="CONTROL PLANE" title="Cài đặt vận hành" description="Cấu hình kết nối, lịch chạy và các hàng rào trước khi bật tác vụ tự động." action={<button className={`pause-button ${globalPaused ? "active" : ""}`} onClick={() => setGlobalPaused(!globalPaused)}><Icon name="pause" /> {globalPaused ? "Tiếp tục worker" : "Dừng toàn hệ thống"}</button>} /><div className="settings-grid"><section className="surface settings-card"><div className="settings-heading"><div className="settings-icon shopee-bg">S</div><div><h2>Kết nối Shopee</h2><p>Nhà Sách Alpha Official</p></div><span className="status status-blocked">Chưa xác minh</span></div><div className="settings-line"><span>Trạng thái app Open Platform</span><strong>Chưa kiểm tra quyền production</strong></div><div className="settings-line"><span>Token / Partner Key</span><strong className="muted">Không hiển thị trên frontend</strong></div><div className="settings-line"><span>Quyền đọc sản phẩm & CTKM</span><strong className="muted">Chưa xác minh</strong></div><button className="ghost-button full" onClick={() => alert("Cần cấu hình secret an toàn ở worker/server trước khi kiểm tra.")}>Kiểm tra kết nối an toàn</button></section><section className="surface settings-card"><div className="settings-heading"><div className="settings-icon blue-bg">◷</div><div><h2>Worker & nguồn dữ liệu</h2><p>Lịch chạy độc lập với trình duyệt</p></div><span className={`status ${globalPaused ? "status-paused" : "status-unchanged"}`}>{globalPaused ? "Đã dừng" : "Đang chạy mock"}</span></div><div className="settings-line"><span>Adapter giá đối thủ</span><strong>Mock adapter <span className="muted">(chưa phải production)</span></strong></div><div className="settings-line"><span>Chu kỳ kiểm tra</span><strong>Chưa chốt — chờ đo độ ổn định nguồn</strong></div><div className="settings-line"><span>Chống chạy trùng</span><strong>Đã bật trong engine</strong></div><button className="ghost-button full">Xem runbook vận hành</button></section></div><section className="surface checklist"><h2>Điều kiện trước khi ghi dữ liệu thật</h2><div className="check-grid"><Check label="Có quyền Shopee API production" done={false} /><Check label="Đã chọn SKU thử nghiệm cụ thể" done={false} /><Check label="Đã xác nhận CTKM tương thích" done={false} /><Check label="Đã đọc lại và đối soát sau ghi" done={false} /></div></section></>; }
function Check({ label, done }: { label: string; done: boolean }) { return <div className={`check-row ${done ? "done" : ""}`}><span>{done ? "✓" : "—"}</span>{label}</div>; }

function SkuModal({ item, onClose, onPause, onRefresh }: { item: TrackedSku; onClose: () => void; onPause: (id: string) => void; onRefresh: (s: TrackedSku) => void }) { const offer = item.competitorOffers[0]; useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [onClose]); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="sku-modal-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">CHI TIẾT SKU</span><h2 id="sku-modal-title">{item.title}</h2><p>{item.sku} · {item.variant}</p></div><button className="close-button" aria-label="Đóng chi tiết SKU" onClick={onClose}>×</button></div><div className="modal-stats"><div><span>Giá hiện tại</span><strong>{vnd(item.currentPrice)}</strong></div><div><span>Đối thủ thấp nhất</span><strong>{vnd(offer?.price)}</strong><small>{offer?.shopName}</small></div><div><span>Giá đề xuất</span><strong className="orange-text">{vnd(item.recommendation)}</strong><small>{item.mode} · {item.rule.kind === "amount" ? `-${vnd(item.rule.value)}` : `-${item.rule.value}%`}</small></div></div><div className="modal-section"><h3>Quyết định gần nhất</h3><div className="decision-box"><Status status={item.status} mode={item.mode} /><p>{item.reason}</p></div></div><div className="modal-section"><h3>Đối thủ được gắn</h3><div className="competitor-link"><span className="book-thumb">{offer?.itemName?.slice(0, 1) ?? "?"}</span><div><strong>{offer?.shopName ?? "Chưa gắn"}</strong><span>{offer?.itemName} · {offer?.variantName}</span><small>Nguồn {offer?.source} · cập nhật {offer ? new Date(offer.observedAt).toLocaleString("vi-VN") : "—"}</small></div><span className={offer?.inStock ? "stock-ok" : "stock-out"}>{offer?.inStock ? "Còn hàng" : "Hết hàng"}</span></div></div><div className="modal-footer"><button className="ghost-button danger" onClick={() => { onPause(item.id); onClose(); }}> {item.paused ? "Tiếp tục SKU" : "Tạm dừng SKU"}</button><div><button className="ghost-button" onClick={() => onRefresh(item)}>Đọc lại dữ liệu</button><button className="primary-button" onClick={onClose}>Đóng</button></div></div></div></div>; }

