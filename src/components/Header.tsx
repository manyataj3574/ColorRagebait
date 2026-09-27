import React from 'react';
import { Volume2, VolumeX, User, ArrowLeft } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  studentId?: string;
  onOpenLeaderboard?: () => void;
  onBackHome?: () => void;
  showBack?: boolean;
  onSwitchPlayer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  studentId,
  onOpenLeaderboard,
  onBackHome,
  showBack = false,
  onSwitchPlayer,
}) => {
  const [muted, setMuted] = React.useState(soundManager.isMuted());

  const handleToggleSound = () => {
    const next = soundManager.toggleMute();
    setMuted(next);
  };

  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3 flex items-center justify-between border-b border-slate-200">
      <div className="flex items-center gap-2">
        {showBack && onBackHome && (
          <button
            onClick={onBackHome}
            aria-label="Back to home"
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="cursor-pointer select-none" onClick={onBackHome}>
          <div className="flex items-center gap-1 font-black text-xl tracking-tight">
            <span className="text-red-500">C</span>
            <span className="text-blue-500">O</span>
            <span className="text-emerald-500">C</span>
            <span className="text-amber-500">O</span>
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 -mt-1">
            Colour Confusion
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {studentId && (
          <div className="flex items-center bg-slate-100 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
            <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            <span className="font-mono font-semibold">{studentId}</span>
            {onSwitchPlayer && (
              <button
                onClick={onSwitchPlayer}
                className="ml-2 text-[10px] text-blue-600 hover:text-blue-800 underline uppercase tracking-tight"
                title="Switch Player ID"
              >
                Switch
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleToggleSound}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          title={muted ? 'Unmute audio' : 'Mute audio'}
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-slate-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-600" />
          )}
        </button>
      </div>
    </header>
  );
};
