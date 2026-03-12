export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-8">Welcome to ARMA. Connect a repo to get started.</p>

      {/* Phase 0 placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Connected Repos", value: "—", desc: "coming in Phase 1" },
          { label: "Open Issues", value: "—", desc: "coming in Phase 2" },
          { label: "Auto PRs Raised", value: "—", desc: "coming in Phase 3" },
        ].map(({ label, value, desc }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold text-white mt-2">{value}</p>
            <p className="text-xs text-gray-600 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg">
        <h2 className="text-base font-semibold text-white mb-3">What ARMA will do</h2>
        <ol className="space-y-3 text-sm text-gray-400 list-decimal list-inside">
          <li><span className="text-gray-200">Push → Detect → Fix → PR</span> — auto-fix bugs on every push</li>
          <li><span className="text-gray-200">Feature Request → Plan → Code → PR</span> — describe a feature, get a PR</li>
        </ol>
      </div>
    </div>
  );
}
