// Renders the login and account creation experience backed by Express auth routes.
import { useState } from "react";
import loginArt from "../assets/home.png";
import { createUserAccount, loginUser } from "../services/userApi";

const emptyForm = {
  summonerName: "",
  tagline: "",
  password: "",
};

export default function LoginView({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreateMode = mode === "create";

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    setStatus("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSubmitting(true);

    try {
      if (isCreateMode) {
        await createUserAccount(form);
        setMode("login");
        setStatus("Account created. Log in to continue.");
        setForm((current) => ({ ...current, password: "" }));
      } else {
        const payload = await loginUser(form);
        onAuthenticated(payload.user);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100 selection:bg-amber-400/30 selection:text-amber-100">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_0.9fr] lg:gap-10 lg:px-10">
        <div className="relative order-2 min-h-[240px] overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950 shadow-2xl shadow-cyan-950/30 sm:min-h-[360px] lg:order-1 lg:min-h-[640px]">
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            src={loginArt}
          />
          <div className="absolute inset-0 bg-linear-to-r from-slate-950 via-slate-950/50 to-transparent" />
          <div className="absolute inset-x-8 top-8 h-px bg-linear-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="relative flex h-full min-h-[240px] flex-col justify-end p-5 sm:min-h-[360px] sm:p-8 lg:min-h-[640px]">
            <div className="max-w-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-200">
                League Companion
              </p>
              <h1 className="text-3xl font-black tracking-normal text-slate-50 sm:text-5xl">
                Collector Login
              </h1>
            </div>
          </div>
        </div>

        <div className="order-1 rounded-lg border border-slate-700 bg-slate-900/85 p-5 shadow-2xl shadow-slate-950/50 sm:p-8 lg:order-2">
          <div className="mb-6 grid grid-cols-2 rounded border border-slate-700 bg-slate-950 p-1">
            <button
              className={`h-11 rounded text-sm font-black uppercase tracking-wide transition ${
                mode === "login"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-slate-100"
              }`}
              onClick={() => selectMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={`h-11 rounded text-sm font-black uppercase tracking-wide transition ${
                mode === "create"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-slate-100"
              }`}
              onClick={() => selectMode("create")}
              type="button"
            >
              Create
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Riot Username
                </span>
                <input
                  autoComplete="username"
                  className="h-12 w-full rounded border border-slate-700 bg-slate-950 px-4 text-base font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  name="summonerName"
                  onChange={updateField}
                  placeholder="Hide on bush"
                  required
                  type="text"
                  value={form.summonerName}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Tagline
                </span>
                <input
                  autoComplete="off"
                  className="h-12 w-full rounded border border-slate-700 bg-slate-950 px-4 text-base font-semibold uppercase text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  name="tagline"
                  onChange={updateField}
                  placeholder="NA1"
                  required
                  type="text"
                  value={form.tagline}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-300">
                  Password
                </span>
                <input
                  autoComplete={isCreateMode ? "new-password" : "current-password"}
                  className="h-12 w-full rounded border border-slate-700 bg-slate-950 px-4 text-base font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  name="password"
                  onChange={updateField}
                  placeholder="Enter password"
                  required
                  type="password"
                  value={form.password}
                />
              </label>
            </div>

            <button
              className="mt-5 h-12 w-full rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Working..."
                : isCreateMode
                  ? "Create Account"
                  : "Login"}
            </button>

            {(status || error) && (
              <p
                className={`mt-4 rounded border px-4 py-3 text-sm font-semibold ${
                  error
                    ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {error || status}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
