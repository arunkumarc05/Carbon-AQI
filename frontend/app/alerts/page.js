'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { toast } from 'react-hot-toast';
import { getAllCitiesAQI, getCities } from '@/lib/api';

export default function AlertsPage() {
    const [citiesData, setCitiesData] = useState([]);
    const [allCities, setAllCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertHistory, setAlertHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [form, setForm] = useState({
        org: '',
        contact: '',
        email: '',
        selectedCities: [],
        threshold: 200,
        frequency: 'Immediate'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [data, list] = await Promise.all([
                getAllCitiesAQI(),
                getCities()
            ]);
            setCitiesData(data);
            setAllCities(list);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load real-time monitoring data');
        } finally {
            setLoading(false);
        }
    };

    const deriveType = (aqi) => {
        if (aqi > 300) return 'hazardous';
        if (aqi > 200) return 'poor';
        return 'moderate';
    };

    // Derive incidents from live cities data — no separate API call needed
    useEffect(() => {
        if (citiesData.length === 0) return;
        const incidents = [...citiesData]
            .map(c => ({ ...c, _aqi: c.aqi_value ?? c.aqi_score ?? 0 }))
            .filter(c => c._aqi > 150)
            .sort((a, b) => b._aqi - a._aqi)
            .slice(0, 5)
            .map(c => ({
                city: c.name ?? c.city_name,
                message: `AQI currently at ${c._aqi} — live reading`,
                time: 'Live',
                type: deriveType(c._aqi),
            }));
        setAlertHistory(incidents);
        setHistoryLoading(false);
    }, [citiesData]);

    const handleCityToggle = (cityName) => {
        setForm(prev => ({
            ...prev,
            selectedCities: prev.selectedCities.includes(cityName)
                ? prev.selectedCities.filter(c => c !== cityName)
                : [...prev.selectedCities, cityName]
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (form.selectedCities.length === 0) {
            toast.error('Please select at least one city');
            return;
        }
        localStorage.setItem('health_alert_config', JSON.stringify(form));
        toast.success(`Alert set for ${form.selectedCities.join(', ')} when AQI exceeds ${form.threshold}`, {
            duration: 5000,
            icon: '✅'
        });
    };

    const getStatusInfo = (aqi) => {
        if (aqi <= 50) return { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
        if (aqi <= 100) return { label: 'Satisfactory', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
        if (aqi <= 200) return { label: 'Moderate', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
        if (aqi <= 300) return { label: 'Poor', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
        if (aqi <= 400) return { label: 'Very Poor', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
        return { label: 'Hazardous', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    };

    const highAlertCities = citiesData.filter(c => c.aqi_value > 200);
    const sortedCities = [...citiesData].sort((a, b) => (b.aqi_value || 0) - (a.aqi_value || 0));



    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1e] text-white">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-20">
                    <div className="animate-pulse space-y-8">
                        <div className="h-10 bg-gray-800 rounded w-1/3"></div>
                        <div className="h-32 bg-gray-800 rounded-2xl w-full"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="h-96 bg-gray-800 rounded-2xl"></div>
                            <div className="h-96 bg-gray-800 rounded-2xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <span className="text-5xl">🚨</span> AQI Alert System
                    </h1>
                    <p className="text-gray-400 text-lg mt-2 font-medium">Real-time monitoring for health officials</p>
                </div>

                {/* ACTIVE ALERTS BANNER */}
                <div className="mb-12">
                    {highAlertCities.length > 0 ? (
                        <div className="space-y-3">
                            {highAlertCities.map(city => (
                                <div key={city.id} className={`p-5 rounded-2xl border ${city.aqi_value > 300 ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' : 'bg-red-500/20 border-red-500/50 text-red-200'} flex items-center justify-between shadow-lg`}>
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{city.aqi_value > 300 ? '🚨' : '⚠️'}</span>
                                        <div>
                                            <p className="font-black uppercase tracking-widest text-xs mb-1">
                                                {city.aqi_value > 300 ? 'HAZARDOUS AIR QUALITY ALERT' : 'POOR AIR QUALITY ALERT'}
                                            </p>
                                            <p className="text-lg font-bold">
                                                {city.name} AQI: <span className="font-black">{city.aqi_value}</span> — Issued {new Date().toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => toast.success('Dispatching alert to local handlers...')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                                        Action Required
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center gap-4 text-green-400 shadow-lg">
                            <span className="text-2xl">✅</span>
                            <p className="text-lg font-bold">All cities within safe limits. No active alerts across monitored regions.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
                    {/* ALERT SUBSCRIPTION FORM */}
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 lg:p-10 shadow-2xl">
                        <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                            Set Personal Alert
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Name / Organization</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.org}
                                        onChange={(e) => setForm(p => ({ ...p, org: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g. WHO North"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Contact Number</label>
                                    <input
                                        type="tel"
                                        required
                                        value={form.contact}
                                        onChange={(e) => setForm(p => ({ ...p, contact: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                        placeholder="+91 XXXXX XXXXX"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                    placeholder="official@env.gov"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Monitor Cities (Multi-select)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                    {allCities.map(city => (
                                        <button
                                            key={city.id}
                                            type="button"
                                            onClick={() => handleCityToggle(city.name)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${form.selectedCities.includes(city.name)
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                                }`}
                                        >
                                            {city.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">AQI Threshold: <span className="text-white text-base ml-2">{form.threshold}</span></label>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-lg`} style={{ backgroundColor: getStatusInfo(form.threshold).color.replace('text-', '') }}>
                                        {getStatusInfo(form.threshold).label}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="400"
                                    step="10"
                                    value={form.threshold}
                                    onChange={(e) => setForm(p => ({ ...p, threshold: parseInt(e.target.value) }))}
                                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-600 font-bold mt-2 uppercase tracking-tighter">
                                    <span>Safe (50)</span>
                                    <span>Moderate (200)</span>
                                    <span>Critical (400)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Alert Frequency</label>
                                <div className="flex gap-4">
                                    {['Immediate', 'Hourly', 'Daily'].map(freq => (
                                        <label key={freq} className="flex-1">
                                            <input
                                                type="radio"
                                                name="frequency"
                                                className="sr-only"
                                                checked={form.frequency === freq}
                                                onChange={() => setForm(p => ({ ...p, frequency: freq }))}
                                            />
                                            <div className={`text-center py-3 rounded-xl border text-sm font-bold cursor-pointer transition-all ${form.frequency === freq
                                                ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                                                }`}>
                                                {freq}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all transform hover:-translate-y-1"
                            >
                                🔔 Activate Alert System
                            </button>
                        </form>
                    </div>

                    {/* ALERT HISTORY TIMELINE */}
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 lg:p-10 shadow-2xl flex flex-col">
                        <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                            Alert Incident History
                        </h2>

                        <div className="flex-1 space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-800">
                            {historyLoading ? (
                                <div className="space-y-4 animate-pulse">
                                    {[1, 2, 3].map((n) => (
                                        <div key={n} className="relative pl-10">
                                            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-gray-700" />
                                            <div className="bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 space-y-2">
                                                <div className="h-4 bg-gray-700 rounded w-2/3" />
                                                <div className="h-3 bg-gray-700 rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : alertHistory.length === 0 ? (
                                <div className="flex items-center justify-center h-40 text-gray-500 text-sm italic">
                                    No alert incidents recorded yet.
                                </div>
                            ) : (
                                alertHistory.map((item, idx) => (
                                    <div key={idx} className="relative pl-10">
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${
                                            item.type === 'hazardous' ? 'bg-purple-600' : item.type === 'poor' ? 'bg-red-600' : 'bg-orange-600'
                                        }`}>
                                            <span className="text-[10px]">🔴</span>
                                        </div>
                                        <div className="bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 hover:border-gray-600 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-black text-white">{item.city} — Incident Reported</p>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">{item.time}</span>
                                            </div>
                                            <p className="text-sm text-gray-400">{item.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-8 p-4 bg-gray-800/50 rounded-2xl text-center">
                            <p className="text-xs text-gray-500 font-bold flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Monitoring active for 10 global cities
                            </p>
                        </div>
                    </div>
                </div>

                {/* CURRENT CITY STATUS TABLE */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                            Live Environmental Data
                        </h2>
                        <button
                            onClick={fetchData}
                            className="bg-gray-800 hover:bg-gray-700 text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all"
                        >
                            🔄 Refresh Data
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-800/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">City</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Current AQI</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">PM 2.5</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">PM 10</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCities.map((city) => {
                                    const info = getStatusInfo(city.aqi_value);
                                    return (
                                        <tr key={city.id} className={`border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors ${info.bg}`}>
                                            <td className="px-8 py-6 font-black text-white">{city.name}</td>
                                            <td className={`px-8 py-6 text-center text-xl font-black ${info.color}`}>{city.aqi_value}</td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${info.bg} ${info.color} border ${info.border}`}>
                                                    {info.label}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-center text-gray-400 font-bold">{city.pm25 || '—'}</td>
                                            <td className="px-8 py-6 text-center text-gray-400 font-bold">{city.pm10 || '—'}</td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => toast.success(`Environmental report sent for ${city.name}`)}
                                                    className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border border-blue-600/30 transition-all"
                                                >
                                                    Send Report
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <footer className="border-t border-gray-800 mt-20 py-12 text-center">
                <p className="text-gray-600 text-xs font-bold uppercase tracking-widest leading-loose">
                    Air Quality Data &bull; Environmental Health Division &bull; 2026<br />
                    All indices monitored in real-time.
                </p>
            </footer>
        </div>
    );
}
