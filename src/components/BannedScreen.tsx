import React from 'react';
import { ShieldAlert, AlertTriangle, Lock } from 'lucide-react';
import { BanInfo } from '../types';

interface BannedScreenProps {
  banInfo: BanInfo;
}

export const BannedScreen: React.FC<BannedScreenProps> = ({ banInfo }) => {
  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center select-none">
      <div className="w-full bg-red-950 text-white rounded-3xl p-6 shadow-2xl border-2 border-red-600 text-center relative overflow-hidden">
        {/* Background warning pattern */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

        {/* Big Alert Icon */}
        <div className="w-16 h-16 bg-red-600/20 border-2 border-red-500 rounded-full mx-auto flex items-center justify-center mb-4 text-red-500 animate-pulse">
          <ShieldAlert className="w-9 h-9" />
        </div>

        {/* Title */}
        <span className="inline-block px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-2">
          Anti-Cheat Violation
        </span>
        <h1 className="text-2xl font-black tracking-tight text-white mb-1 uppercase">
          Device Permanently Banned
        </h1>
        <p className="text-xs text-red-300 mb-4">
          Automated bots, scripts, forged API requests, or unnatural click speeds are strictly prohibited.
        </p>

        {/* Reason Box */}
        <div className="bg-black/50 border border-red-800 rounded-2xl p-4 text-left mb-4">
          <div className="text-[10px] uppercase font-bold text-red-400 mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Violation Reason
          </div>
          <div className="text-sm font-semibold text-red-100 break-words">
            {banInfo.reason || 'Unnatural cognitive speed or unauthorized bot script detected'}
          </div>

          <div className="mt-3 pt-3 border-t border-red-900/60 flex items-center justify-between text-[11px] text-red-400 font-mono">
            <span>Device ID:</span>
            <span className="text-white truncate max-w-[170px]">
              {banInfo.deviceId || 'DEV-VERIFIED'}
            </span>
          </div>

          {banInfo.bannedAt && (
            <div className="mt-1 flex items-center justify-between text-[11px] text-red-400 font-mono">
              <span>Banned At:</span>
              <span className="text-slate-300">
                {new Date(banInfo.bannedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Enforcement notice */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 bg-red-900/40 py-2.5 px-3 rounded-xl border border-red-800/80">
          <Lock className="w-3.5 h-3.5 text-red-400" />
          <span>Access revoked permanently across all college rounds</span>
        </div>
      </div>
    </div>
  );
};
