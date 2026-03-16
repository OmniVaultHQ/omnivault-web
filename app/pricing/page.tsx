"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Plan = {
  name: string;
  badge?: string;
  description: string;
  monthly: number;
  yearly: number; // yearly total price (not per month)
  cta: string;
  href: string;
  featured?: boolean;
  features: string[];
};

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const plans: Plan[] = useMemo(
    () => [
      {
        name: "Free",
        description: "Start tracking with the essentials.",
        monthly: 0,
        yearly: 0,
        cta: "Start Free",
        href: "/signup",
        features: [
          "Unlimited items (manual entry)",
          "Categories (TCG, minis, games)",
          "Portfolio total value",
          "Basic profit/loss (purchase vs current)",
          "Private by default",
        ],
      },
      {
        name: "Pro",
        badge: "Most Popular",
        description: "For serious collectors who want clean insights.",
        monthly: 9,
        yearly: 90,
        cta: "Go Pro",
        href: "/signup?plan=pro",
        featured: true,
        features: [
          "Everything in Free",
          "Advanced profit/loss tracking",
          "Filters + quick search",
          "Export to CSV",
          "Priority support",
        ],
      },
      {
        name: "Vault+",
        badge: "Best Value",
        description: "For power users managing large collections.",
        monthly: 19,
        yearly: 180,
        cta: "Get Vault+",
        href: "/signup?plan=vault",
        features: [
          "Everything in Pro",
          "Bulk import (CSV)",
          "Multiple collections / folders",
          "Audit log (changes over time)",
          "Early access to new features",
        ],
      },
    ],
    []
  );

  const priceLabel = (plan: Plan) => {
    if (billing === "monthly") return plan.monthly;
    // show per-month equivalent for yearly
    return Math.round((plan.yearly / 12) * 10) / 10;
  };

  const billedText = (plan: Plan) => {
    if (billing === "monthly") return "Billed monthly";
    if (plan.yearly === 0) return "Free forever";
    return `Billed yearly (${plan.yearly.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })}/yr)`;
  };

  return (
    <main className="relative min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-200px] h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-slate-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
      </div>

      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold">
              OV
            </span>
            <div className="leading-tight">
              <div className="font-semibold">OmniVault</div>
              <div className="text-xs text-slate-400">Black & Silver Edition</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              ← Back
            </Link>
            <Link
              href="/signin"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Header */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Simple pricing. No surprises.
        </div>

        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Pricing that scales with your collection.
        </h1>

        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-slate-400">
          Start free. Upgrade when you want deeper insights and faster workflows.
        </p>

        {/* Billing Toggle */}
        <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              billing === "monthly" ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              billing === "yearly" ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            Yearly
            <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">
              Save ~2 months
            </span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "relative rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 ...",
                plan.featured
                  ? "border-emerald-400/30 bg-emerald-400/5 shadow-lg shadow-emerald-400/10"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              {plan.badge && (
                <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">
                  {plan.badge}
                </div>
              )}

              <div className="text-base font-semibold tracking-tight">{plan.name}</div>
              <div className="mt-2 text-sm text-slate-400">{plan.description}</div>

              <div className="mt-6 flex items-end gap-2">
                <div className="text-5xl font-semibold tracking-tight">
                  {plan.monthly === 0 && plan.yearly === 0 ? (
                    "Free"
                  ) : (
                    <>
                      ${priceLabel(plan)}
                     <span className="text-sm font-medium text-slate-500">/mo</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-400">{billedText(plan)}</div>

              <Link
                href={plan.href}
                className={[
                  "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition",
                  plan.featured
                    ? "bg-white text-slate-900 hover:bg-slate-200"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
                ].join(" ")}
              >
                {plan.cta}
              </Link>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="text-xs font-semibold text-slate-300">What’s included</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Trust row */}
        <div className="mt-10 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold">Private by default</div>
            <div className="mt-1 text-sm text-slate-400">
              Your inventory and values stay yours. No selling, no marketplace noise.
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">Cancel anytime</div>
            <div className="mt-1 text-sm text-slate-400">
              Upgrade for a month, export anytime, and downgrade whenever you want.
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">Simple setup</div>
            <div className="mt-1 text-sm text-slate-400">
              Start with manual entry. Add import + power features when you’re ready.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold">Do I need a credit item for Free?</div>
              <div className="mt-2 text-sm text-slate-400">Nope. Create an account and start tracking.</div>
            </div>

            <div>
              <div className="text-sm font-semibold">Can I switch monthly ↔ yearly?</div>
              <div className="mt-2 text-sm text-slate-400">
                Yes. You can change billing anytime (we’ll keep it simple).
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">Does OmniVault sell my data?</div>
              <div className="mt-2 text-sm text-slate-400">
                No. The entire point is privacy + clean analytics.
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">What counts as “an item”?</div>
              <div className="mt-2 text-sm text-slate-400">
                Any collectible entry: a item, mini, sealed product, game, etc.
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <div className="text-sm text-slate-400">
              Want a custom plan later (teams / shops)? We can add it after MVP.
            </div>
            <Link
              href="/signup"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Start Free
            </Link>
          </div>
        </div>
      </section>

      <footer className="pb-10 text-center text-sm text-slate-500">© 2026 OmniVault</footer>
    </main>
  );
}