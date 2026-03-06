"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 1) Create user
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLoading(false)
      setError(data?.error || "Signup failed.")
      return
    }

    // 2) Auto sign-in
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (!login?.ok) {
      setError("Account created, but login failed. Try signing in.")
      router.push("/login")
      return
    }

    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Sign up</h1>
        <p className="mt-2 text-sm text-white/70">Create your OmniVault account.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-white/80">Name (optional)</label>
            <input
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Matthew"
            />
          </div>

          <div>
            <label className="text-sm text-white/80">Email</label>
            <input
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/80">Password</label>
            <input
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-white/50">Must be at least 8 characters.</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            className="w-full rounded-lg bg-white text-black font-medium py-2 hover:bg-white/90 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-white/70">
          Already have an account?{" "}
          <a className="underline" href="/login">
            Login
          </a>
        </p>
      </div>
    </main>
  )
}