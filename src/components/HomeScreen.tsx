import React, { useState, useEffect } from 'react';
import { Trophy, Play, Sparkles, HelpCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { PlayerProfile } from '../types';
import { fetchPlayer, saveStudentIdLocally } from '../utils/api';
import { soundManager } from '../utils/audio';

interface HomeScreenProps {
  initialStudentId: string;
  onStartGame: (studentId: string) => void;
  onOpenLeaderboard: () => void;
  playerProfile: PlayerProfile | null;
  onProfileLoaded: (profile: PlayerProfile) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  initialStudentId,
  onStartGame,
  onOpenLeaderboard,
  playerProfile,
  onProfileLoaded,
}) => {
  const [studentIdInput, setStudentIdInput] = useState(initialStudentId);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    if (initialStudentId) {
      setStudentIdInput(initialStudentId);
      loadProfile(initialStudentId);
    }
  }, [initialStudentId]);

  const loadProfile = async (id: string) => {
    if (!id || id.trim().length < 2) return;
    setIsLoadingProfile(true);
    try {
      const profile = await fetchPlayer(id);
      onProfileLoaded(profile);
    } catch {
      // Handled
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = studentIdInput.trim().toUpperCase();

    if (!cleanId) {
      setValidationError('Please enter your Student ID or Roll Number');
      return;
    }

    if (cleanId.length < 2) {
      setValidationError('Student ID must be at least 2 characters');
      return;
    }

    if (cleanId.length > 25) {
      setValidationError('Student ID cannot exceed 25 characters');
      return;
    }

    setValidationError('');
    saveStudentIdLocally(cleanId);
    soundManager.playClick();
    onStartGame(cleanId);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center">
      {/* Game Branding Title */}
      <div className="text-center my-4">
        <div className="inline-flex items-center gap-1 font-black text-5xl tracking-tighter mb-1 select-none">
          <span className="text-red-500 drop-shadow-sm">C</span>
          <span className="text-blue-500 drop-shadow-sm">O</span>
          <span className="text-emerald-500 drop-shadow-sm">C</span>
          <span className="text-amber-500 drop-shadow-sm">O</span>
        </div>
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Colour Confusion
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          The brain-twisting colour reflex challenge. Pick the ink, ignore the text!
        </p>
      </div>

      {/* Mini Interactive / Visual Demo Card */}
      <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 my-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Quick Example</span>
          <span className="text-emerald-600 font-medium">1-Second Rule</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-xs">
          <div className="text-xs text-slate-400 font-medium mb-1">
            What colour is this text?
          </div>
          <div className="text-3xl font-black text-amber-500 tracking-wide my-1 select-none">
            GREEN
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-600">
            <span>Tap:</span>
            <span className="bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-md font-bold shadow-xs">
              Yellow ✓
            </span>
            <span className="text-slate-400 line-through text-[11px]">Green ✗</span>
          </div>
        </div>
      </div>

      {/* Student ID Login & Profile Card */}
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-5 my-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="student-id"
                className="text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                College Roll No. / Student ID
              </label>
              {playerProfile && playerProfile.highScore > 0 && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Best: {playerProfile.highScore}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="student-id"
                type="text"
                value={studentIdInput}
                onChange={(e) => {
                  setStudentIdInput(e.target.value.toUpperCase());
                  if (validationError) setValidationError('');
                }}
                onBlur={() => {
                  if (studentIdInput.trim()) {
                    loadProfile(studentIdInput.trim());
                  }
                }}
                placeholder="e.g. 23CSE041, 24BTECH102"
                maxLength={25}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm uppercase"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {validationError ? (
              <p className="text-xs text-red-500 mt-1 font-medium">{validationError}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Enter your ID once. Your high score stays permanently linked to this ID.
              </p>
            )}
          </div>

          {/* If returning player, show stat summary */}
          {playerProfile && playerProfile.studentId && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Player: </span>
                <span className="font-mono font-bold text-slate-800">
                  {playerProfile.studentId}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-slate-400">Best: </span>
                  <span className="font-black text-slate-900">
                    {playerProfile.highScore}
                  </span>
                  {playerProfile.highestLevel && (
                    <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 font-bold px-1.5 py-0.5 rounded">
                      Lvl {playerProfile.highestLevel}
                    </span>
                  )}
                </div>
                {playerProfile.rank && (
                  <div>
                    <span className="text-slate-400">Rank: </span>
                    <span className="font-bold text-blue-600">
                      #{playerProfile.rank}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={isLoadingProfile}
              className="w-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Game</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onOpenLeaderboard();
              }}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer shadow-2xs"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Campus Leaderboard</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rules & College Cred Footnote */}
      <div className="w-full flex items-center justify-between mt-3 px-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="flex items-center gap-1 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Game Rules</span>
        </button>
        <span className="flex items-center gap-1 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Single-ID Verified Scores
        </span>
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h2 id="rules-dialog-title" className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              How to Play COCO
            </h2>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="font-bold text-blue-900 block mb-0.5">1. The Golden Rule</span>
                Select the <strong className="text-blue-700">INK / FONT COLOUR</strong> of the word on screen, NOT what the word spells out.
              </div>
              <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="font-bold text-amber-900 block mb-1">2. 15-Answer Levels & Timings</span>
                <p className="text-[11px] text-slate-500 mb-1.5">Every level has 15 questions. Timing decreases as you advance:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-700 font-mono">
                  <span>• Lvl 1 (0-14): <strong>10.0s</strong></span>
                  <span>• Lvl 2 (15-29): <strong>8.0s</strong></span>
                  <span>• Lvl 3 (30-44): <strong>6.0s</strong></span>
                  <span>• Lvl 4 (45-59): <strong>4.5s</strong></span>
                  <span>• Lvl 5 (60-74): <strong>3.0s</strong></span>
                  <span>• Lvl 6 (75-89): <strong>2.0s</strong></span>
                  <span>• Lvl 7 (90-104): <strong>1.4s</strong></span>
                  <span>• Lvl 8 (105-119): <strong className="text-red-600">1.0s</strong></span>
                  <span>• Lvl 9 (120-134): <strong className="text-red-600">0.9s</strong></span>
                  <span>• Lvl 10+ (135+): <strong className="text-red-700">0.8s-0.6s</strong></span>
                </div>
              </div>
              <div className="p-2.5 bg-red-50/60 rounded-xl border border-red-100">
                <span className="font-bold text-red-900 block mb-0.5">3. Higher Toughness</span>
                As levels increase, more colours appear, timings shrink, and deceptive match traps test your reflexes.
              </div>
              <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-0.5">4. Permanent Campus Leaderboard</span>
                Your high score & highest level are linked to your Student ID and permanently saved.
              </div>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-4 w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-colors"
            >
              Got it, let's play!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
