import { useState, useEffect, useCallback } from 'react';
import { GameOverData, PlayerProfile, ScreenState, BanInfo } from './types';
import {
  getSavedStudentId,
  saveStudentIdLocally,
  fetchPlayer,
  submitScore,
  initializeSync,
  checkDeviceBanStatus,
  startVerifiedGameSession,
} from './utils/api';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { CountdownOverlay } from './components/CountdownOverlay';
import { GameScreen } from './components/GameScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { BannedScreen } from './components/BannedScreen';

export default function App() {
  const [screenState, setScreenState] = useState<ScreenState>('HOME');
  const [studentId, setStudentId] = useState<string>(() => getSavedStudentId());
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);

  const CACHE_VERSION = 'v5_secure_db_2026';

  // Initial Anti-Cheat check and stale local cache sanitization on mount
  useEffect(() => {
    try {
      const cachedVer = localStorage.getItem('coco_app_cache_version');
      if (cachedVer !== CACHE_VERSION) {
        // Clear all legacy unverified local storage caches
        localStorage.removeItem('coco_permanent_scores_v3');
        localStorage.removeItem('coco_players_registry_v2');
        localStorage.removeItem('coco_players_registry');
        localStorage.setItem('coco_app_cache_version', CACHE_VERSION);
      }
    } catch {
      // Ignore
    }

    initializeSync();
    // Pre-warm Render backend on free tier so cold starts don't affect initial games
    fetch(`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/health`).catch(() => {});
    checkDeviceBanStatus().then((info) => {
      if (info.isBanned) {
        setBanInfo(info);
        setScreenState('BANNED');
      } else {
        setBanInfo(null);
      }
    });
  }, []);

  // Sync profile when studentId is known
  const refreshProfile = useCallback(async (id: string) => {
    if (!id || id.trim().length < 2) return;
    try {
      const p = await fetchPlayer(id);
      setPlayerProfile(p);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    if (studentId && screenState !== 'BANNED') {
      refreshProfile(studentId);
    }
  }, [studentId, refreshProfile, screenState]);

  // Handle start game request with Anti-Cheat session establishment
  const handleStartGame = async (idToUse?: string) => {
    // Check if device is banned before starting
    const check = await checkDeviceBanStatus();
    if (check.isBanned) {
      setBanInfo(check);
      setScreenState('BANNED');
      return;
    }

    const targetId = (idToUse || studentId).trim().toUpperCase();
    if (!targetId || targetId.length < 2) {
      setScreenState('HOME');
      return;
    }

    setStudentId(targetId);
    saveStudentIdLocally(targetId);

    // Initialize authenticated round session
    await startVerifiedGameSession(targetId);
    setScreenState('COUNTDOWN');
  };

  // Called when 3-2-1 countdown finishes
  const handleCountdownFinished = () => {
    setScreenState('PLAYING');
  };

  // Called when round finishes (wrong choice or timeout)
  const handleGameOver = async (preliminaryData: GameOverData) => {
    try {
      const res = await submitScore(
        studentId,
        preliminaryData.score,
        preliminaryData.level,
        preliminaryData.telemetry || []
      );
      const finalGameOverData: GameOverData = {
        ...preliminaryData,
        isNewHighScore: res.isNewHighScore,
        previousHighScore: res.previousHighScore,
        highestScore: res.highScore,
        rank: res.rank,
        totalPlayers: res.totalPlayers,
      };

      setGameOverData(finalGameOverData);

      // Update current in-memory profile
      setPlayerProfile({
        studentId,
        highScore: res.highScore,
        highestScoreDate: res.highestScoreDate,
        totalGames: (playerProfile?.totalGames || 0) + 1,
        rank: res.rank,
        highestLevel: res.highestLevel,
      });
      setScreenState('GAME_OVER');
    } catch (err: any) {
      if (err.message && err.message.startsWith('CLIENT_UPDATE_REQUIRED')) {
        alert('The game has received a security update. Reloading to apply changes...');
        window.location.reload();
        return;
      }
      if (err.message && err.message.startsWith('DEVICE_BANNED')) {
        const reason = err.message.replace('DEVICE_BANNED: ', '');
        setBanInfo({ isBanned: true, reason });
        setScreenState('BANNED');
        return;
      }
      setGameOverData(preliminaryData);
      setScreenState('GAME_OVER');
    }
  };

  const handleDeviceBanned = (info: BanInfo) => {
    setBanInfo(info);
    setScreenState('BANNED');
  };

  const handleSwitchPlayer = () => {
    if (screenState === 'BANNED') return;
    setStudentId('');
    setPlayerProfile(null);
    saveStudentIdLocally('');
    setScreenState('HOME');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header Navigation */}
      <Header
        studentId={studentId}
        showBack={screenState === 'LEADERBOARD'}
        onBackHome={() => screenState !== 'BANNED' && setScreenState('HOME')}
        onOpenLeaderboard={() => screenState !== 'BANNED' && setScreenState('LEADERBOARD')}
        onSwitchPlayer={screenState === 'HOME' ? handleSwitchPlayer : undefined}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col justify-center items-center py-4 sm:py-6">
        {screenState === 'BANNED' && banInfo && (
          <BannedScreen banInfo={banInfo} />
        )}

        {screenState === 'HOME' && (
          <HomeScreen
            initialStudentId={studentId}
            onStartGame={(id) => handleStartGame(id)}
            onOpenLeaderboard={() => setScreenState('LEADERBOARD')}
            playerProfile={playerProfile}
            onProfileLoaded={setPlayerProfile}
          />
        )}

        {screenState === 'COUNTDOWN' && (
          <CountdownOverlay onComplete={handleCountdownFinished} />
        )}

        {screenState === 'PLAYING' && (
          <GameScreen
            studentId={studentId}
            highScore={playerProfile?.highScore || 0}
            onGameOver={handleGameOver}
            onQuit={() => setScreenState('HOME')}
            onDeviceBanned={handleDeviceBanned}
          />
        )}

        {screenState === 'GAME_OVER' && gameOverData && (
          <GameOverScreen
            data={gameOverData}
            studentId={studentId}
            onPlayAgain={() => handleStartGame()}
            onOpenLeaderboard={() => setScreenState('LEADERBOARD')}
            onGoHome={() => setScreenState('HOME')}
          />
        )}

        {screenState === 'LEADERBOARD' && (
          <LeaderboardScreen
            currentStudentId={studentId}
            onBack={() => setScreenState('HOME')}
            onStartGame={() => handleStartGame()}
          />
        )}
      </main>

      {/* Campus Game Footer */}
      <footer className="w-full py-3 text-center text-[11px] text-slate-400 border-t border-slate-200">
        <div className="flex items-center justify-center gap-2">
          <span>COCO – Colour Confusion</span>
          <span>•</span>
          <span>College Edition (Anti-Cheat Protected)</span>
        </div>
      </footer>
    </div>
  );
}
