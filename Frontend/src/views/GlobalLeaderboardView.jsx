// Renders the backend-ranked global leaderboard for account progression.
import { useCallback, useEffect, useState } from "react";
import { getGlobalLeaderboard } from "../services/userApi";

export default function GlobalLeaderboardView({ user, onBack }) {
  const [leaders, setLeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const payload = await getGlobalLeaderboard();
      setLeaders(payload.leaders || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
            Global Leaderboard
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-normal text-slate-50">
            Account Rankings
          </h2>
        </div>

        <button
          className="h-11 rounded border border-slate-700 px-4 text-sm font-black uppercase tracking-wide text-slate-300 transition hover:border-amber-300/60 hover:text-amber-200"
          onClick={onBack}
          type="button"
        >
          Back to Collection
        </button>
      </div>

      <div className="min-h-[520px] rounded-lg border border-amber-300/20 bg-slate-900/80 p-4 shadow-xl shadow-amber-950/20 sm:p-5">
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="rounded border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </div>
        ) : leaders.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-center text-sm font-bold uppercase tracking-widest text-slate-500">
            No accounts ranked yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {leaders.map((leader) => (
              <LeaderboardRow
                isCurrentUser={leader.userId === user.id}
                key={leader.userId}
                leader={leader}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LeaderboardRow({ isCurrentUser, leader }) {
  const rankTone =
    leader.rank === 1
      ? "border-amber-300/50 bg-amber-400/15 text-amber-100"
      : leader.rank === 2
        ? "border-slate-300/40 bg-slate-300/10 text-slate-100"
        : leader.rank === 3
          ? "border-orange-300/40 bg-orange-400/10 text-orange-100"
          : "border-slate-700 bg-slate-900 text-slate-300";

  return (
    <article
      className={`grid gap-4 rounded-lg border p-4 shadow-lg shadow-slate-950/30 transition sm:grid-cols-[76px_1fr_120px_150px_120px] sm:items-center ${
        isCurrentUser
          ? "border-cyan-300/45 bg-cyan-950/25"
          : "border-slate-700 bg-slate-950/70"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded border text-xl font-black ${rankTone}`}
      >
        #{leader.rank}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xl font-black text-slate-50">
          {leader.displayName}
        </p>
        {isCurrentUser && (
          <p className="mt-1 text-xs font-black uppercase tracking-widest text-cyan-200">
            You
          </p>
        )}
      </div>

      <StatBlock label="Level" value={leader.appLevel} />
      <StatBlock label="Champions Unlocked" value={leader.championsUnlocked} />
      <StatBlock label="Items Built" value={leader.itemsBuilt} />
    </article>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/80 px-3 py-2 sm:text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-100">
        {Number(value) || 0}
      </p>
    </div>
  );
}
