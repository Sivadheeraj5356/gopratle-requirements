import "./globals.css";
export const metadata = {
  title: "GoPratle | Post a requirement",
  description: "Plan the details. Find the right event professionals.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
