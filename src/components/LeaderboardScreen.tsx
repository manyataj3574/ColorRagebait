import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, ArrowLeft, Search, Play, UserCheck } from 'lucide-react';
import { fetchLeaderboard, getLocalLeaderboard, LeaderboardResult } from '../utils/api';
import { soundManager } from '../utils/audio';

interface LeaderboardScreenProps {
  currentStudentId: string;
  onBack: () => void;
  onStartGame: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  currentStudentId,
  onBack,
  onStartGame,
}) => {
  // Initialize immediately from cached registry so scores never disappear or flash
  const [data, setData] = useState<LeaderboardResult>(() => getLocalLeaderboard(currentStudentId));
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getLocalLeaderboard(currentStudentId);
    return cached.leaderboard.length === 0;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadLeaderboard = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    }
    try {
      const res = await fetchLeaderboard(currentStudentId);
      if (res && Array.isArray(res.leaderboard)) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentStudentId]);

  useEffect(() => {
    loadLeaderboard(false);
  }, [loadLeaderboard]);

  const filteredList = data.leaderboard.filter((entry) =>
    entry.studentId.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  // Check if current player is displayed inside the visible list
  const isCurrentInVisibleList = filteredList.some(
    (item) => item.studentId.toUpperCase() === currentStudentId.toUpperCase()
  );

  const formatShortDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-5 flex flex-col items-center">
      {/* Top Bar with back button and refresh */}
      <div className="w-full flex items-center justify-between mb-4">
        <button
          onClick={() => {
            soundManager.playClick();
            onBack();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">
            {data.totalPlayers} {data.totalPlayers === 1 ? 'Player' : 'Players'}
          </span>
          <button
            onClick={() => {
              soundManager.playClick();
              loadLeaderboard(true);
            }}
            disabled={isRefreshing}
            title="Refresh Leaderboard"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Screen Title */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 mb-1.5 shadow-2xs">
          <Trophy className="w-5 h-5 text-amber-600" />
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">
          Campus Leaderboard
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Top scoring students in Colour Confusion
        </p>
      </div>

      {/* Search Input */}
      {data.leaderboard.length > 0 && (
        <div className="w-full mb-3 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Roll Number / Student ID..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase"
          />
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden mb-4">
        {loading && data.leaderboard.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mb-2" />
            <span>Loading rankings...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 px-4 text-center">
            {searchTerm ? (
              <p className="text-xs text-slate-500">
                No player found matching "<span className="font-mono font-bold">{searchTerm}</span>"
              </p>
            ) : (
              <div className="space-y-3">
                <div className="text-3xl">🎯</div>
                <p className="text-sm font-bold text-slate-800">
                  No scores recorded yet!
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Be the very first student to play and lock in the #1 position on the campus leaderboard.
                </p>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onStartGame();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-800 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play First Game</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5 px-3 w-14 text-center">Rank</th>
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-2 text-center">Level</th>
                  <th className="py-2.5 px-3 text-right">High Score</th>
                  <th className="py-2.5 px-3 text-right hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((entry) => {
                  const isCurrent =
                    currentStudentId &&
                    entry.studentId.toUpperCase() === currentStudentId.toUpperCase();

                  return (
                    <tr
                      key={entry.studentId}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/80 font-semibold text-blue-950'
                          : 'hover:bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3 px-3 text-center">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs shadow-2xs">
                            🥇
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs shadow-2xs">
                            🥈
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-900 font-black text-xs shadow-2xs">
                            🥉
                          </span>
                        ) : (
                          <span className="font-mono text-slate-500 font-bold text-xs">
                            #{entry.rank}
                          </span>
                        )}
                      </td>

                      {/* Student ID Column */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold tracking-wide">
                            {entry.studentId}
                          </span>
                          {isCurrent && (
                            <span className="bg-blue-600 text-white text-[9px] font-sans font-bold px-1.5 py-0.2 rounded-full uppercase tracking-tight">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Level Column */}
                      <td className="py-3 px-2 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                          Lvl {entry.level || 1}
                        </span>
                      </td>

                      {/* High Score Column */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-black text-sm text-slate-900">
                          {entry.highScore}
                        </span>
                      </td>

                      {/* Date Column */}
                      <td className="py-3 px-3 text-right text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                        {formatShortDate(entry.highestScoreDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pinned Card if current player is outside the top 10 / not visible */}
      {data.currentPlayer && !isCurrentInVisibleList && currentStudentId && (
        <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-2xl p-3.5 mb-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-blue-700 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Your Current Rank
            </span>
            <span>Outside Top 10</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg text-blue-900">
                #{data.currentPlayer.rank}
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {data.currentPlayer.studentId}
              </span>
              <span className="bg-blue-200/70 text-blue-900 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                Lvl {data.currentPlayer.level || 1}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 mr-1.5">High Score:</span>
              <span className="font-mono font-black text-base text-slate-900">
                {data.currentPlayer.highScore}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="w-full space-y-2">
        <button
          onClick={() => {
            soundManager.playClick();
            onStartGame();
          }}
          className="w-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Play COCO Now</span>
        </button>
      </div>
    </div>
  );
};
