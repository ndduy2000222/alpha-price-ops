import "./globals.css";
import "./refinements.css";

export const metadata = {
  title: "Alpha Price Ops",
  description: "Công cụ vận hành cạnh tranh giá cho Alpha Books",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
