import FadeIn from "./components/FadeIn";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-slate-950 text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-200px] h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-slate-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
      </div>

      {/* HERO SECTION */}
      <FadeIn>
        <section id="home" className="mx-auto max-w-5xl px-6 pt-28 pb-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Collectible Portfolio Tracker (MVP)
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-5xl font-semibold tracking-tight leading-[1.05] bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Secure. Organized.
            <span className="block">Built like a vault.</span>
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
            Track what you bought, what it&apos;s worth now, and your total portfolio value.
            <span className="mt-2 block text-slate-400">
              No selling. No storage. Just clean analytics.
            </span>
          </p>

          {/* Buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/signup"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-slate-200"
            >
              Start Free
            </a>

            <a
              href="/pricing"
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">
            
              View Pricing
            </a>

            <a href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
              Sign in →
            </a>
          </div>

          {/* Feature Bullets */}
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
            <div>• Track profit / loss</div>
            <div>• Categories (TCG, minis, games)</div>
            <div>• Private by default</div>
          </div>
        </section>
      </FadeIn>

      {/* PROBLEM SECTION */}
      <FadeIn>
        <section id="problem" className="border-y border-white/10 bg-slate-900/40 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                Managing your collection shouldn’t feel like accounting homework.
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                Most collectors use spreadsheets, notes apps, or nothing at all. Tracking value, profit, and
                organization becomes messy fast.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <FadeIn delayMs={0}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                  <h3 className="text-lg font-semibold text-white">Spreadsheets Get Messy</h3>
                  <p className="mt-2 text-slate-400">
                    Manual updates. No real insights. Easy to break formulas.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delayMs={100}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                  <h3 className="text-lg font-semibold text-white">No Clear Portfolio Value</h3>
                  <p className="mt-2 text-slate-400">
                    You don’t actually know what your collection is worth today.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delayMs={200}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                  <h3 className="text-lg font-semibold text-white">Tracking Profit Is Hard</h3>
                  <p className="mt-2 text-slate-400">
                    Purchase price vs current value isn’t easy to monitor over time.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* SOLUTION SECTION */}
      <FadeIn>
        <section id="solution" className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Everything you need to track your collection — in one place.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              OmniVault keeps your inventory organized and your portfolio value always visible.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <FadeIn delayMs={0}>
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                <h3 className="text-lg font-semibold text-white">Add Items Fast</h3>
                <p className="mt-2 text-slate-400">
                  Add collectibles in seconds with category, value, quantity, and notes.
                </p>
              </div>
            </FadeIn>

            <FadeIn delayMs={100}>
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                <h3 className="text-lg font-semibold text-white">Total Portfolio Value</h3>
                <p className="mt-2 text-slate-400">
                  See your collection’s total value instantly — no spreadsheets required.
                </p>
              </div>
            </FadeIn>

            <FadeIn delayMs={200}>
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                <h3 className="text-lg font-semibold text-white">Track Profit / Loss</h3>
                <p className="mt-2 text-slate-400">
                  Compare purchase price vs current value and monitor gains over time.
                </p>
              </div>
            </FadeIn>

            <FadeIn delayMs={300}>
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
                <h3 className="text-lg font-semibold text-white">Filter by Category</h3>
                <p className="mt-2 text-slate-400">
                  Split views for TCG, minis, games, and other collectibles.
                </p>
              </div>
            </FadeIn>
          </div>

          {/* Mock Preview Card */}
          <FadeIn delayMs={150}>
            <div className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Portfolio Value</p>
                  <p className="text-3xl font-semibold text-white">$12,480.00</p>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs text-slate-400">Invested</p>
                    <p className="text-lg font-semibold text-white">$9,250</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-xs text-slate-400">Profit</p>
                    <p className="text-lg font-semibold text-emerald-400">+$3,230</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-sm text-white">Gundam TCG — Starter Deck</p>
                  <p className="text-sm text-slate-300">$120</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-sm text-white">Warhammer Mini — Painted Character</p>
                  <p className="text-sm text-slate-300">$85</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-sm text-white">Retro Game — Complete in Box</p>
                  <p className="text-sm text-slate-300">$240</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>
      </FadeIn>

      {/* FINAL CTA SECTION */}
      <FadeIn>
        <section id="cta" className="border-t border-white/10 bg-slate-950 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Start tracking your collection today.
            </h2>

            <p className="mt-4 text-lg text-slate-400">
              No spreadsheets. No guesswork. Just clean, organized value tracking.
            </p>

            <div className="mt-10 flex justify-center gap-4">
              <a
                href="/signup"
                className="rounded-xl bg-white px-8 py-4 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-slate-200"
              >
                Create Free Account
              </a>

              <a
                href="/pricing"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-white transition hover:bg-white/10"
              >
                View Pricing
              </a>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Footer */}
      <footer className="pb-10 text-center text-sm text-slate-500">
        © 2026 OmniVault
      </footer>
    </main>
  );
}