import React from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-white">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-6">ATHE</h1>
        <p className="mb-6 text-gray-400">Connect with strangers, instantly.</p>

        <button
          onClick={() => navigate("/auth")}
          className="bg-violet-600 px-6 py-3 rounded-lg"
        >
          Start Chat
        </button>
      </div>

      <footer className="py-6 text-center text-xs text-slate-500 space-x-4">
        <Link to="/privacy" className="hover:text-slate-300 hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-slate-300 hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}
