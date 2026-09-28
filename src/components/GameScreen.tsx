import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ColorItem, GameOverData, GameQuestion, BanInfo, RoundTelemetry } from '../types';
import { generateQuestion } from '../utils/colors';
import { getLevelForScore, getTimeLimitForScore } from '../utils/levels';
import { soundManager } from '../utils/audio';
import { getDeviceId, startAntiCheatWatchdog } from '../utils/anticheat';
import { Zap, Sparkles, ShieldCheck } from 'lucide-react';

interface GameScreenProps {
  studentId: string;
  highScore: number;
  onGameOver: (result: GameOverData) => void;
  onQuit: () => void;
  onDeviceBanned: (banInfo: BanInfo) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  studentId,
  highScore,
  onGameOver,
  onQuit,
  onDeviceBanned,
}) => {
  const [score, setScore] = useState<number>(0);
  const [question, setQuestion] = useState<GameQuestion>(() => generateQuestion(0, null));
  const [timeRemaining, setTimeRemaining] = useState<number>(() => getTimeLimitForScore(0));
  const [maxTime, setMaxTime] = useState<number>(() => getTimeLimitForScore(0));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedWrongId, setSelectedWrongId] = useState<string | null>(null);
  const [flashCorrectId, setFlashCorrectId] = useState<string | null>(null);
  const [showScorePopup, setShowScorePopup] = useState<boolean>(false);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);

  // Debounce buffer: brief 120ms delay on question switch to prevent accidental double-tap bounce
  const [isClickLocked, setIsClickLocked] = useState<boolean>(true);
  const questionRenderTimeRef = useRef<number>(Date.now());
  const lockTimeoutRef = useRef<number | null>(null);

  // References for timing
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const maxTimeRef = useRef<number>(getTimeLimitForScore(0));
  const scoreRef = useRef<number>(0);
  const currentQuestionRef = useRef<GameQuestion>(question);
  const isGameOverRef = useRef<boolean>(false);
  const telemetryRef = useRef<RoundTelemetry[]>([]);

  // Start continuous anti-cheat scanner
  useEffect(() => {
    const stopWatchdog = startAntiCheatWatchdog(studentId, (reason) => {
      onDeviceBanned({ isBanned: true, reason, deviceId: getDeviceId() });
    });
    return () => {
      stopWatchdog();
    };
  }, [studentId, onDeviceBanned]);

  currentQuestionRef.current = question;
  scoreRef.current = score;

  const currentLevel = getLevelForScore(score);

  // Trigger brief debounce lock on question change to prevent accidental touch bounce
  useEffect(() => {
    setIsClickLocked(true);
    questionRenderTimeRef.current = Date.now();

    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
    }

    lockTimeoutRef.current = window.setTimeout(() => {
      setIsClickLocked(false);
    }, 120); // 120ms smooth anti-bounce window

    return () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
    };
  }, [question.id]);

  // Trigger game over
  const triggerGameOver = useCallback(
    (reason: 'wrong_color' | 'timeout', wrongColor?: ColorItem) => {
      if (isGameOverRef.current) return;
      isGameOverRef.current = true;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      soundManager.playWrong();

      const finalScore = scoreRef.current;
      const currentQ = currentQuestionRef.current;
      const finalLevel = getLevelForScore(finalScore);
      const isNewHigh = finalScore > highScore;

      setTimeout(() => {
        onGameOver({
          score: finalScore,
          level: finalLevel.level,
          levelName: finalLevel.name,
          isNewHighScore: isNewHigh,
          previousHighScore: highScore,
          highestScore: Math.max(highScore, finalScore),
          rank: null,
          totalPlayers: 0,
          reason,
          selectedColor: wrongColor,
          correctColor: currentQ.inkColor,
          wordColor: currentQ.wordColor,
          telemetry: telemetryRef.current,
        });
      }, 550);
    },
    [highScore, onGameOver]
  );

  // Reset & start question timer
  const startQuestionTimer = useCallback((duration: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setMaxTime(duration);
    maxTimeRef.current = duration;
    setTimeRemaining(duration);
    startTimeRef.current = Date.now();

    const interval = 25; // 40fps high-precision update for sub-second timers
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, maxTimeRef.current - elapsed);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        triggerGameOver('timeout');
      }
    }, interval);
  }, [triggerGameOver]);

  // Initial timer mount
  useEffect(() => {
    isGameOverRef.current = false;
    const initialDuration = getTimeLimitForScore(0);
    startQuestionTimer(initialDuration);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startQuestionTimer]);

  // Handle player choice with Anti-Cheat checks
  const handleSelectColor = useCallback(
    async (chosenColor: ColorItem, event?: React.MouseEvent | KeyboardEvent) => {
      // 1. Block untrusted synthetic scripts (auto-clickers dispatching fake events)
      if (event && event.isTrusted === false) {
        return;
      }

      // 2. Debounce buffer: Silently ignore click if tapped within first 100ms
      // (prevents double-tap bounce; NEVER bans for fast guesswork or rapid tapping)
      const elapsedMs = Date.now() - questionRenderTimeRef.current;
      if (isClickLocked || elapsedMs < 100) {
        return;
      }

      if (isProcessing || isGameOverRef.current) return;

      const currentQ = currentQuestionRef.current;
      const isCorrect = chosenColor.id === currentQ.inkColor.id;

      if (isCorrect) {
        // Record round telemetry for anti-cheat verification
        const clickX = event && 'clientX' in event ? event.clientX : Math.floor(window.innerWidth / 2);
        const clickY = event && 'clientY' in event ? event.clientY : Math.floor(window.innerHeight / 2);
        telemetryRef.current.push({
          q: scoreRef.current + 1,
          dt: elapsedMs,
          x: Math.round(clickX),
          y: Math.round(clickY),
          trusted: Boolean(event ? event.isTrusted : true),
        });
        // Correct answer!
        const prevLevel = getLevelForScore(scoreRef.current);
        const nextScore = scoreRef.current + 1;
        const nextLevel = getLevelForScore(nextScore);

        setScore(nextScore);

        // Check if level increased
        if (nextLevel.level > prevLevel.level) {
          soundManager.playLevelUp();
          setLevelUpMessage(`LEVEL UP! Level ${nextLevel.level}: ${nextLevel.name} (${nextLevel.timeLimit}s)`);
          setTimeout(() => setLevelUpMessage(null), 2200);
        } else {
          soundManager.playCorrect();
        }

        // Flash animation
        setShowScorePopup(true);
        setTimeout(() => setShowScorePopup(false), 450);

        // Setup next question with level-dependent timing and pool
        const nextDuration = getTimeLimitForScore(nextScore);
        const nextQuestion = generateQuestion(nextScore, currentQ);
        setQuestion(nextQuestion);
        startQuestionTimer(nextDuration);
      } else {
        // Wrong answer!
        setIsProcessing(true);
        setSelectedWrongId(chosenColor.id);
        setFlashCorrectId(currentQ.inkColor.id);
        triggerGameOver('wrong_color', chosenColor);
      }
    },
    [isClickLocked, isProcessing, onDeviceBanned, startQuestionTimer, studentId, triggerGameOver]
  );

  // Keyboard shortcut support (1, 2, 3, 4) with Anti-Cheat check
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing || isGameOverRef.current) return;
      if (e.isTrusted === false) {
        reportAndBanDevice(studentId, 'Synthetic keyboard event detected (Automated Bot)');
        onDeviceBanned({ isBanned: true, reason: 'Synthetic keyboard event detected', deviceId: getDeviceId() });
        return;
      }

      const key = e.key;
      let optionIndex = -1;

      if (key === '1') optionIndex = 0;
      else if (key === '2') optionIndex = 1;
      else if (key === '3') optionIndex = 2;
      else if (key === '4') optionIndex = 3;

      if (optionIndex >= 0 && optionIndex < question.options.length) {
        handleSelectColor(question.options[optionIndex], e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectColor, isProcessing, onDeviceBanned, question.options, studentId]);

  // Progress percentage
  const progressPercent = Math.max(0, Math.min(100, (timeRemaining / maxTime) * 100));

  // Timer format (e.g. 10.0 or 08.4 or 02.1)
  const formattedTime = timeRemaining.toFixed(1);
  const isUrgent = timeRemaining <= Math.min(2.5, maxTime * 0.35);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 flex flex-col items-center select-none relative">
      {/* Level Up Banner Notification */}
      {levelUpMessage && (
        <div className="fixed top-16 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-4 py-2 rounded-2xl shadow-xl border-2 border-white flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-yellow-200 fill-yellow-200" />
          <span className="text-xs uppercase tracking-wide">{levelUpMessage}</span>
          <Zap className="w-4 h-4 text-yellow-200 fill-yellow-200" />
        </div>
      )}

      {/* Top Game Title */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-1">
          <span className="text-red-500">C</span>
          <span className="text-blue-500">O</span>
          <span className="text-emerald-500">C</span>
          <span className="text-amber-500">O</span>
        </h1>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 -mt-0.5 flex items-center justify-center gap-1">
          <span>Colour Confusion</span>
          <span>•</span>
          <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
            <ShieldCheck className="w-2.5 h-2.5" /> Anti-Cheat Active
          </span>
        </p>
      </div>

      {/* Main HUD: Level, Score, and Time */}
      <div className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-md mb-3 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          {/* Level Badge */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Level
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black font-mono tracking-tight text-amber-400">
                0{currentLevel.level}
              </span>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                {currentLevel.name}
              </span>
            </div>
          </div>

          {/* Score Counter */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Score
            </span>
            <div className="relative flex items-center">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {score.toString().padStart(2, '0')}
              </span>
              {showScorePopup && (
                <span className="absolute -top-3 left-10 text-emerald-400 font-black text-sm animate-bounce">
                  +1
                </span>
              )}
            </div>
          </div>

          {/* Time Counter */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Time
            </span>
            <span
              className={`text-2xl font-black font-mono tracking-tight transition-colors ${
                isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'
              }`}
            >
              {formattedTime}s
            </span>
          </div>
        </div>

        {/* Smooth visual timer bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full transition-all duration-75 ease-linear rounded-full ${
              isUrgent ? 'bg-red-500' : timeRemaining < maxTime * 0.5 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Footer info: 15-answer bracket progress & best score */}
        <div className="flex items-center justify-between mt-2 pt-1.5 text-[11px] text-slate-400 border-t border-slate-800/80">
          <span>
            {currentLevel.maxScore !== Infinity ? (
              <>
                Lvl {currentLevel.level}: <strong className="text-amber-400 font-mono">{(score % 15) + 1}/15</strong>
                <span className="text-slate-500 mx-1">•</span>
                Next at <strong className="text-slate-200 font-mono">{currentLevel.maxScore + 1}</strong>
              </>
            ) : (
              <span className="text-amber-300 font-bold">MAX LEVEL REACHED 👑</span>
            )}
          </span>
          <button
            onClick={onQuit}
            className="text-[10px] text-slate-400 hover:text-slate-200 underline transition-colors cursor-pointer"
          >
            End Round
          </button>
        </div>
      </div>

      {/* Central Question / Word Trap Card */}
      <div className="w-full bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center shadow-xs my-1 min-h-[155px] relative overflow-hidden">
        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
          Select the ink colour of this text:
        </span>

        {/* The Word with Mismatched Ink Colour */}
        <div
          key={question.id}
          className="text-5xl sm:text-6xl font-black tracking-wider transition-all duration-150 select-none transform hover:scale-105 active:scale-95"
          style={{ color: question.inkColor.hex }}
        >
          {question.wordColor.name.toUpperCase()}
        </div>

        {/* Small subtle visual cue */}
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <span>Level {currentLevel.level}</span>
          <span>•</span>
          <span>{currentLevel.timeLimit}s limit</span>
          {currentLevel.level >= 5 && (
            <>
              <span>•</span>
              <span className="text-orange-500 font-semibold">Toughness High</span>
            </>
          )}
        </div>
      </div>

      {/* Anti-Bot Honeypot Decoy Trap: Invisible to humans, tempting to DOM scraper bots */}
      <button
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          const reason = 'Honeypot DOM bot trap triggered (DOM-scraping Browser Extension / Bot)';
          reportAndBanDevice(studentId, reason, 'HONEYPOT');
          onDeviceBanned({ isBanned: true, reason, deviceId: getDeviceId() });
        }}
        style={{
          opacity: 0.0001,
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          pointerEvents: 'auto',
          width: '1px',
          height: '1px',
        }}
        data-color-target="true"
        className="btn-color-option bg-emerald-500"
      >
        {question.inkColor.name}
      </button>

      {/* Large Colour Answer Buttons (300ms reaction delay enforced) */}
      <div className="w-full grid grid-cols-2 gap-3 mt-3">
        {question.options.map((option, idx) => {
          const isWrongSelected = selectedWrongId === option.id;
          const isCorrectFlash = flashCorrectId === option.id;

          let buttonClasses =
            'relative py-4 px-3 rounded-2xl font-black text-lg transition-all duration-100 flex flex-col items-center justify-center shadow-sm select-none ';

          if (isWrongSelected) {
            buttonClasses += 'bg-red-600 text-white ring-4 ring-red-300 animate-shake';
          } else if (isCorrectFlash) {
            buttonClasses += 'bg-emerald-500 text-white ring-4 ring-emerald-300 animate-pulse';
          } else if (isClickLocked) {
            // During the 300ms buffer, disable pointer events and show brief warm-up state
            buttonClasses += `${option.bgClass} opacity-95 cursor-not-allowed pointer-events-none`;
          } else {
            buttonClasses += `${option.bgClass} shadow-xs hover:opacity-95 hover:shadow-md active:scale-95 cursor-pointer`;
          }

          return (
            <button
              key={`${question.id}-${option.id}`}
              onClick={(e) => handleSelectColor(option, e)}
              disabled={isProcessing || isClickLocked}
              className={buttonClasses}
              style={{ minHeight: '74px' }}
            >
              {/* Keyboard badge for laptop users */}
              <span className="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white/90 font-bold hidden sm:inline-block">
                {idx + 1}
              </span>

              {/* Colour Name */}
              <span className="tracking-wide text-base sm:text-lg drop-shadow-2xs">
                {option.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop hint */}
      <p className="text-[11px] text-slate-400 mt-3 hidden sm:block text-center">
        Tip: You can use keys <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold text-[10px]">1</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold text-[10px]">2</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold text-[10px]">3</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold text-[10px]">4</kbd> on laptop keyboards.
      </p>
    </div>
  );
};
