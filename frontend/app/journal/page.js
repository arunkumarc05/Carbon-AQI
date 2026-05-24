'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { getCities, getCityAQILatest } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    AreaChart, Area
} from 'recharts';

export default function JournalPage() {
    const [cities, setCities] = useState([]);
    const [entries, setEntries] = useState([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        city: '',
        activity: '',
        healthRating: 3,
        notes: ''
    });
    const [currentCityAqi, setCurrentCityAqi] = useState(null);
    const [aqiUnavailable, setAqiUnavailable] = useState(false);

    useEffect(() => {
        fetchCities();
        const saved = localStorage.getItem('aqi_journal_entries');
        if (saved) {
            setEntries(JSON.parse(saved));
        }
    }, []);

    const fetchCities = async () => {
        try {
            const data = await getCities();
            setCities(data);
            if (data.length > 0) setFormData(p => ({ ...p, city: data[0].name }));
        } catch (error) {
            console.error('Failed to fetch cities:', error);
        }
    };

    const fetchCityAqi = async (cityName) => {
        setAqiUnavailable(false);
        setCurrentCityAqi(null);
        try {
            const cityList = await getCities();
            const matched = cityList.find(
                (c) => c.name === cityName
            );
            if (!matched) throw new Error('city not found');
            const aqiData = await getCityAQILatest(matched.id);
            setCurrentCityAqi(aqiData.aqi_score ?? aqiData.aqi_value ?? aqiData.aqi ?? 0);
        } catch (err) {
            console.error('fetchCityAqi error:', err);
            setCurrentCityAqi(0);
            setAqiUnavailable(true);
        }
    };

    useEffect(() => {
        if (formData.city) fetchCityAqi(formData.city);
    }, [formData.city]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Use the live AQI fetched from the backend for the selected city
        const newEntry = {
            ...formData,
            id: Date.now(),
            aqi: currentCityAqi ?? 0
        };

        const updated = [newEntry, ...entries];
        setEntries(updated);
        localStorage.setItem('aqi_journal_entries', JSON.stringify(updated));
        setFormData({
            date: new Date().toISOString().split('T')[0],
            city: cities[0]?.name || '',
            activity: '',
            healthRating: 3,
            notes: ''
        });
        toast.success('Journal entry added!');
    };

    const getHealthEmoji = (rating) => {
        const emojis = ['😫', '🤒', '😐', '😊', '🤩'];
        return emojis[rating - 1];
    };

    const chartData = [...entries].reverse().map(e => ({
        date: e.date,
        health: e.healthRating,
        aqi: e.aqi / 50 // Scale AQI for chart visibility
    }));

    return (
        <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
                <div className="flex flex-col lg:flex-row gap-6 md:gap-12">

                    {/* Form Column */}
                    <div className="w-full lg:w-1/3 space-y-6 md:space-y-8">
                        <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] p-4 md:p-8 border border-gray-700 shadow-2xl">
                            <div className="flex items-center gap-4 mb-6 md:mb-8">
                                <span className="text-2xl md:text-3xl">📓</span>
                                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">Personal AQI Journal</h1>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Activity Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Location</label>
                                    <select
                                        value={formData.city}
                                        onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white"
                                        style={{colorScheme:'dark'}}
                                    >
                                        {cities.map(c => <option key={c.id} value={c.name} className="bg-gray-800 text-white">{c.name}</option>)}
                                    </select>
                                    {aqiUnavailable && (
                                        <p className="mt-2 text-[10px] text-amber-400 font-semibold">
                                            ⚠️ AQI unavailable for this city
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Outdoor Activity</label>
                                    <input
                                        type="text"
                                        value={formData.activity}
                                        onChange={e => setFormData(p => ({ ...p, activity: e.target.value }))}
                                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white"
                                        placeholder="e.g. Morning Run, Commute"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">How did you feel?</label>
                                    <div className="flex justify-between items-center bg-[#1f2937] p-4 rounded-xl">
                                        {[1, 2, 3, 4, 5].map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, healthRating: r }))}
                                                className={`text-2xl transition-transform hover:scale-125 ${formData.healthRating === r ? 'opacity-100 scale-125' : 'opacity-40'}`}
                                            >
                                                {getHealthEmoji(r)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Personal Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white h-32 resize-none"
                                        placeholder="Any breathing issues or observations?"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-500/20"
                                >
                                    ➕ Log Entry
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Timeline & Analysis Column */}
                    <div className="w-full lg:w-2/3 space-y-6 md:space-y-10">
                        {/* Correlation Chart */}
                        <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] p-4 md:p-8 border border-gray-700 shadow-2xl">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8">Health vs AQI Correlation</h3>
                            <div className="h-64">
                                {entries.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                            <XAxis dataKey="date" stroke="#4b5563" fontSize={10} />
                                            <YAxis stroke="#4b5563" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }}
                                                itemStyle={{ fontSize: '12px' }}
                                            />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px' }} />
                                            <Area type="monotone" dataKey="aqi" name="AQI Impact" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAqi)" />
                                            <Line type="monotone" dataKey="health" name="Health Rating" stroke="#10b981" strokeWidth={3} dot={{ r: 6 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
                                        Log at least 2 entries to see trend analysis
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Entries Timeline */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                                Activity Timeline
                            </h3>

                            <div className="space-y-4">
                                {entries.map(entry => (
                                    <div key={entry.id} className="bg-[#111827] rounded-3xl p-6 border border-gray-700 flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{entry.date}</p>
                                                    <h4 className="text-lg font-black text-white uppercase">{entry.activity || 'Outdoor Activity'}</h4>
                                                    <p className="text-gray-500 text-xs font-bold uppercase">{entry.city}</p>
                                                </div>
                                                <div className="text-4xl">{getHealthEmoji(entry.healthRating)}</div>
                                            </div>
                                            <p className="text-sm text-gray-400 leading-relaxed italic">"{entry.notes || 'No specific notes recorded.'}"</p>
                                        </div>

                                        <div className="md:w-32 flex flex-col justify-center items-center bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
                                            <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Exposure</p>
                                            <div className="text-2xl font-black text-white">{entry.aqi}</div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">AQI Unit</p>
                                        </div>
                                    </div>
                                ))}

                                {entries.length === 0 && (
                                    <div className="text-center py-20 bg-[#111827]/30 border border-dashed border-gray-700 rounded-[2rem]">
                                        <div className="text-5xl mb-4">⛰️</div>
                                        <p className="text-gray-500">Your journal is empty. Start tracking your environmental exposure today.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
