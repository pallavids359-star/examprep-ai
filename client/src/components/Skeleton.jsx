import { SplashLoader } from "./Loading";
// Grey shapes that pulse while content loads
export function Bone({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

// Placeholder in the shape of the dashboard (4 cards, a chart and a side card)
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your progress">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <Bone className="h-4 w-24" />
            <Bone className="h-8 w-16 mt-3" />
            <Bone className="h-3 w-20 mt-3" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <Bone className="h-4 w-28" />
          <Bone className="h-40 w-full mt-4" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <Bone className="h-4 w-28" />
          <Bone className="h-12 w-full mt-4" />
          <Bone className="h-12 w-full mt-2" />
        </div>
      </div>
    </div>
  );
}

// Shown for a moment when the app first opens
export function AppLoading() {
  return <SplashLoader />;
}
