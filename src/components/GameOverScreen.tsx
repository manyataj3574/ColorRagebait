import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Trophy, Home, Sparkles, AlertCircle, Clock } from 'lucide-react';
import { GameOverData } from '../types';
import { soundManager } from '../utils/audio';

interface GameOverScreenProps {
  data: GameOverData;
  studentId: string;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
  onGoHome: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  data,
  studentId,
  onPlayAgain,
  onOpenLeaderboard,
  onGoHome,
}) => {
  useEffect(() => {
    if (data.isNewHighScore && data.score > 0) {
      soundManager.playHighscore();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
        });
      } catch {
        // Confetti fallback
      }
    }
  }, [data.isNewHighScore, data.score]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center select-none">
      {/* Game Over Container */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
        {/* Cause of Game Over Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-red-50 text-red-700 border border-red-200">
          {data.reason === 'timeout' ? (
            <>
              <Clock className="w-3.5 h-3.5 text-red-500" />
              <span>Time ran out!</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span>Wrong colour chosen!</span>
            </>
          )}
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          Game Over
        </h2>

        {/* Explain error nicely if wrong color */}
        {data.reason === 'wrong_color' && data.selectedColor && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 my-3 text-xs text-slate-600">
            <span>You picked </span>
            <span className="font-bold text-red-600">{data.selectedColor.name}</span>
            <span>, but the ink was </span>
            <span className="font-bold text-emerald-600">{data.correctColor.name}</span>!
          </div>
        )}

        {/* New High Score celebration callout */}
        {data.isNewHighScore && data.score > 0 ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 my-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center gap-1.5 text-amber-900 font-black text-base">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>New High Score! 🎉</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-amber-700 font-medium mt-0.5">
              Awesome job! You beat your previous record of {data.previousHighScore}.
            </p>
          </div>
        ) : null}

        {/* Score Display Card */}
        <div className="bg-slate-900 text-white rounded-xl p-5 my-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">
              Final Score
            </span>
            <span className="text-[11px] font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              Level {data.level || 1}: {data.levelName || 'Novice'}
            </span>
          </div>

          <div className="text-5xl font-black font-mono tracking-tight text-white mb-2">
            {data.score}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-around text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Best Record</span>
              <span className="font-mono font-bold text-base text-amber-400">
                {data.highestScore}
              </span>
            </div>

            <div className="w-px h-8 bg-slate-800" />

            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Campus Rank</span>
              <span className="font-mono font-bold text-base text-blue-400">
                {data.rank ? `#${data.rank}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Player roll confirmation */}
        <div className="text-xs text-slate-400 mb-5 font-mono">
          Roll No: <strong className="text-slate-700">{studentId}</strong>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              soundManager.playClick();
              onPlayAgain();
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onOpenLeaderboard();
            }}
            className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer shadow-2xs"
          >
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>View Campus Leaderboard</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onGoHome();
            }}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium py-2 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
