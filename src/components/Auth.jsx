import React, { useState } from "react";
import { Boxes as BoxesIcon, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        });
        if (error) throw error;
        setError(""); // Clear errors on success
        setEmail("");
        setPassword("");
        // Auto-switch to login after signup
        setIsSignUp(false);
        alert("Account created! Please sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="flex flex-col items-center border-b border-slate-100 px-6 py-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-white shadow-sm">
            <BoxesIcon size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">StockRoom</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">Ops · v1</p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="px-6 py-8">
          <h2 className="mb-6 text-center text-base font-semibold text-slate-900">
            {isSignUp ? "Create Account" : "Sign In"}
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-rose-50 p-3.5 ring-1 ring-rose-200">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* Email Field */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>

          {/* Password Field */}
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          {/* Toggle Sign Up / Sign In */}
          <p className="mt-4 text-center text-sm text-slate-600">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              disabled={loading}
              className="font-medium text-teal-700 hover:text-teal-800 underline disabled:text-slate-400"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
