"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session, status } = useSession();
  const authed = !!session?.user;
  const pathname = usePathname();

  return (
    <header data-navbar="APP_COMPONENTS_NAVBAR_V1" className="fixed top-0 left-0 right-0 ...">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-white">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-wide">
            OmniVault
          </Link>
          
          <nav className="flex items-center gap-4 text-sm opacity-90">
        <Link href="/" className="hover:opacity-100">
    Home</Link>

          <Link href="/pricing" className="hover:opacity-100">
    Pricing</Link>
    
    <Link href="/signup">Sign Up</Link>

  <Link href="/catalog" className="hover:opacity-100">
  Catalog</Link>


  {authed && (
    <Link href="/dashboard" className="hover:opacity-100">
      Dashboard
    </Link>
    
  )}
  
</nav>
        </div>

        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <span className="text-sm opacity-70">…</span>
          ) : authed ? (
            <>
              <span className="hidden sm:inline text-sm opacity-70">
                {session.user?.email}
              </span>
              
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
              >
                Logout
              </button>
            </>
          ) : pathname === "/login" ? (
  <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm opacity-60 cursor-default">
    Login
  </span>
) : (
            
            <Link
    href="/login"
    className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
  >
    Login
  </Link>
          )}
        </div>
      </div>
    </header>
  );
}