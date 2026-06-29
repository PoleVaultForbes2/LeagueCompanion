// Renders stored match history from the backend for lightweight OP.GG-style review.
import { useCallback, useEffect, useState } from "react";
import { getRecentGames } from "../services/userApi";

export default function RecentGamesView({ user, onBack }) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecentGames = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const payload = await getRecentGames(user.id);
      setMatches(payload.matches || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadRecentGames();
  }, [loadRecentGames]);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
            Match History
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-normal text-slate-50">
            Recent Games
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

      <div className="min-h-[520px] rounded-lg border border-cyan-300/20 bg-slate-900/80 p-4 shadow-xl shadow-cyan-950/20 sm:p-5">
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
            Loading games...
          </div>
        ) : error ? (
          <div className="rounded border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-center text-sm font-bold uppercase tracking-widest text-slate-500">
            No stored games yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {matches.map((match) => (
              <RecentGameRow key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RecentGameRow({ match }) {
  const tone = match.win
    ? "border-cyan-300/25 bg-cyan-950/25"
    : "border-rose-400/25 bg-rose-950/25";
  const resultTone = match.win ? "text-cyan-200" : "text-rose-200";

  return (
    <article
      className={`grid gap-4 rounded-lg border ${tone} p-4 shadow-lg shadow-slate-950/30 lg:grid-cols-[150px_1.2fr_1fr] lg:items-center`}
    >
      <div>
        <p className={`text-sm font-black ${resultTone}`}>{match.result}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
          {match.gameMode}
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-300">
          {match.duration.text}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-600 bg-slate-950">
          {match.champion.iconUrl && (
            <img
              alt=""
              className="h-full w-full object-cover"
              src={match.champion.iconUrl}
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-50">
            {match.champion.name}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-100">
            <span className="text-slate-50">{match.kda.kills}</span>
            <span className="text-slate-500"> / </span>
            <span className="text-rose-200">{match.kda.deaths}</span>
            <span className="text-slate-500"> / </span>
            <span className="text-slate-50">{match.kda.assists}</span>
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            {match.kda.ratio} KDA
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-emerald-200">
            {Number(match.creepScore) || 0} CS
          </p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 lg:justify-self-end">
        {buildItemSlots(match.items).map((item, index) => (
          <div
            className="aspect-square overflow-hidden rounded border border-slate-700 bg-slate-950"
            key={`${item?.id || "empty"}-${index}`}
            title={item?.name || "Empty item slot"}
          >
            {item && (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={item.iconUrl}
              />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function buildItemSlots(items) {
  const slots = [...(items || [])].slice(0, 6);

  while (slots.length < 6) {
    slots.push(null);
  }

  return slots;
}
