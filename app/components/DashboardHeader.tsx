import SubmitButton from "@/app/components/Submitbutton";

/*
File: app/components/DashboardHeader.tsx

Purpose:
- Shows the dashboard title
- Shows the signed-in user's email
- Gives the user a button to refresh market prices
- Gives the user a logout button

Important:
- refreshPrices is a server action passed in from app/dashboard/page.tsx
- logout is also a server action passed in from app/dashboard/page.tsx
*/
type Props = {
  userEmail: string;
  lastRefreshLabel: string | null;
  refreshPrices: () => Promise<void>;
  logout: () => Promise<void>;
};

export default function DashboardHeader({
  userEmail,
  lastRefreshLabel,
  refreshPrices,
  logout,
}: Props) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      {/* =========================================
          LEFT SIDE
          Dashboard title + signed-in user
         ========================================= */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="mt-1 text-sm text-white/60">{userEmail}</div>
      </div>

      {/* =========================================
          RIGHT SIDE
          Price refresh + logout actions
         ========================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Price refresh area */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <form action={refreshPrices}>
            <SubmitButton className="rounded-xl border border-green-400/30 bg-green-400/10 px-4 py-2 hover:bg-green-400/20">
              Refresh Prices
            </SubmitButton>
          </form>

          {/* Show the last successful refresh time if available */}
          {lastRefreshLabel && (
            <div className="text-xs text-white/40">
              Last refresh: {lastRefreshLabel}
            </div>
          )}
        </div>

        {/* Logout button */}
        <form action={logout}>
          <SubmitButton className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
            Logout
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}