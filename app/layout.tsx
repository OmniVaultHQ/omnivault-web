import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Providers from "./providers";

export const metadata = {
  title: "OmniVault",
  description: "Collectible portfolio tracker (MVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <Providers>
          <Navbar />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
