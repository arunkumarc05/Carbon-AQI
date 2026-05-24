'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/firebase';

export default function LeaderboardPage() {
    const [currentUser, setCurrentUser] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Track auth state
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

    // Fetch real leaderboard data from backend
    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch('http://localhost:8000/api/leaderboard');
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }
                const data = await res.json();
                setLeaderboard(data);
            } catch (err) {
                console.error('Leaderboard fetch error:', err);
                setError('Unable to load leaderboard');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const getRankIcon = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank;
    };

    // Map risk_level from API to badge colour classes (same palette as before)
    const getBadgeColor = (riskLevel) => {
        if (riskLevel === 'Good') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
        if (riskLevel === 'Moderate') return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
        if (riskLevel === 'Unhealthy for Sensitive Groups') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
        if (riskLevel === 'Unhealthy') return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
        if (riskLevel === 'Very Unhealthy') return 'bg-red-500/20 text-red-400 border-red-500/50';
        return 'bg-red-900/30 text-red-300 border-red-700/50'; // Hazardous
    };

    return (
        <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-16">
                <div className="text-center mb-8 md:mb-16">
                    <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-600">
                        City Air Quality Leaderboard
                    </h1>
                    <p className="text-gray-400 font-medium tracking-wide uppercase text-xs">
                        Ranked by average AQI — lower is cleaner
                    </p>
                </div>

                {/* ── Loading state ── */}
                {loading && (
                    <div className="flex items-center justify-center py-24 text-gray-400 font-semibold tracking-widest uppercase text-xs">
                        <span className="animate-pulse">Loading leaderboard…</span>
                    </div>
                )}

                {/* ── Error state ── */}
                {!loading && error && (
                    <div className="flex items-center justify-center py-24">
                        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl px-8 py-6 text-center">
                            <p className="text-red-400 font-black uppercase tracking-widest text-sm mb-1">⚠ {error}</p>
                            <p className="text-gray-500 text-xs">Check that the backend is running on port 8000.</p>
                        </div>
                    </div>
                )}

                {/* ── Leaderboard table ── */}
                {!loading && !error && (
                    <div className="bg-[#111827] rounded-2xl md:rounded-[2.5rem] border border-gray-700 shadow-2xl overflow-hidden overflow-x-auto">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-4 p-4 md:p-8 border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[600px]">
                            <div className="col-span-1">Rank</div>
                            <div className="col-span-4">City</div>
                            <div className="col-span-3">Air Quality</div>
                            <div className="col-span-2 text-right">Avg AQI</div>
                            <div className="col-span-2 text-center">Badge</div>
                        </div>

                        {/* Table rows */}
                        <div className="divide-y divide-gray-800/50 min-w-[600px]">
                            {leaderboard.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm font-medium">
                                    No city data available yet.
                                </div>
                            ) : (
                                leaderboard.map((city) => (
                                    <div
                                        key={city.city_id}
                                        className={`grid grid-cols-12 gap-4 p-4 md:p-8 items-center transition-all hover:bg-gray-800/30`}
                                    >
                                        {/* Rank */}
                                        <div className="col-span-1 text-2xl font-black text-white">
                                            {getRankIcon(city.rank)}
                                        </div>

                                        {/* City name */}
                                        <div className="col-span-4 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black bg-gray-800">
                                                {city.city_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-sm">{city.city_name}</h4>
                                            </div>
                                        </div>

                                        {/* Risk level badge */}
                                        <div className="col-span-3">
                                            <span className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getBadgeColor(city.risk_level)}`}>
                                                {city.risk_level}
                                            </span>
                                        </div>

                                        {/* Average AQI score */}
                                        <div className="col-span-2 text-right">
                                            <span className="text-lg font-black text-white tabular-nums">{city.average_aqi}</span>
                                            <span className="text-[10px] text-gray-500 ml-1 font-bold">AQI</span>
                                        </div>

                                        {/* Special badge (only rank 1) */}
                                        <div className="col-span-2 text-center text-xl">
                                            {city.badge === 'Cleanest City' && (
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-1">
                                                    🌿 Cleanest
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── Summary cards (unchanged) ── */}
                <div className="mt-6 md:mt-12 flex flex-col md:flex-row gap-4 md:gap-8">
                    <div className="flex-1 bg-gradient-to-br from-blue-600/20 to-blue-900/40 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-blue-500/30">
                        <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Cleanest City</h5>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-black">
                                    {leaderboard[0]?.city_name ?? '—'}
                                </p>
                                <p className="text-xs text-gray-400 font-medium">Rank #1 · Avg AQI {leaderboard[0]?.average_aqi ?? '—'}</p>
                            </div>
                            <div className="text-4xl">🌍</div>
                        </div>
                    </div>

                    <div className="flex-1 bg-gradient-to-br from-emerald-600/20 to-emerald-900/40 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-emerald-500/30">
                        <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Cities Monitored</h5>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-black">{leaderboard.length}</p>
                                <p className="text-xs text-gray-400 font-medium">Active in the network</p>
                            </div>
                            <div className="text-4xl">🌲</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
