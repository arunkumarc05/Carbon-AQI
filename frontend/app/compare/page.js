'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCities, compareCities } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/firebase';

export default function ComparePage() {
  const [cities, setCities] = useState([]);
  const [city1, setCity1] = useState('');
  const [city2, setCity2] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return unsubscribe;
  }, [auth, router]);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const data = await getCities();
      setCities(data);
    } catch (error) {
      setError('Failed to load cities');
      console.error(error);
    }
  };

  const handleCompare = async () => {
    if (!city1 || !city2 || city1 === city2) {
      setError('Please select two different cities');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await compareCities(city1, city2);
      setComparisonData(data);
    } catch (error) {
      setError('Failed to compare cities');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAQIColor = (aqi) => {
    if (!Number.isFinite(aqi)) return '#9ca3af';
    if (aqi <= 50) return '#00C853';
    if (aqi <= 100) return '#FFD600';
    if (aqi <= 200) return '#FF6D00';
    if (aqi <= 300) return '#DD2C00';
    if (aqi <= 400) return '#6A1B9A';
    return '#37474F';
  };

  const getAQITextColor = (aqi) => {
    if (!Number.isFinite(aqi)) return '#9ca3af';
    if (aqi <= 50) return '#00C853';
    if (aqi <= 100) return '#FFD600';
    if (aqi <= 200) return '#FF6D00';
    if (aqi <= 300) return '#DD2C00';
    if (aqi <= 400) return '#6A1B9A';
    return '#37474F';
  };

  const getAQILevel = (aqi) => {
    if (!Number.isFinite(aqi)) return 'Unknown';
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Hazardous';
  };

  const getCityFlag = (cityName) => {
    const flags = {
      'Delhi': '🇮🇳', 'Mumbai': '🇮🇳', 'Bangalore': '🇮🇳', 'Chennai': '🇮🇳',
      'Kolkata': '🇮🇳', 'Hyderabad': '🇮🇳', 'Ahmedabad': '🇮🇳', 'Pune': '🇮🇳',
      'London': '🇬🇧', 'New York': '🇺🇸', 'Tokyo': '🇯🇵', 'Paris': '🇫🇷', 'Beijing': '🇨🇳'
    };
    return flags[cityName] || '📍';
  };

  const getChartData = () => {
    if (!comparisonData) return [];
    return [
      { metric: 'PM2.5', [comparisonData.city1.name]: comparisonData.city1.pm25 ?? 0, [comparisonData.city2.name]: comparisonData.city2.pm25 ?? 0 },
      { metric: 'PM10',  [comparisonData.city1.name]: comparisonData.city1.pm10 ?? 0, [comparisonData.city2.name]: comparisonData.city2.pm10 ?? 0 },
      { metric: 'NO2',   [comparisonData.city1.name]: comparisonData.city1.no2  ?? 0, [comparisonData.city2.name]: comparisonData.city2.no2  ?? 0 },
      { metric: 'CO',    [comparisonData.city1.name]: comparisonData.city1.co   ?? 0, [comparisonData.city2.name]: comparisonData.city2.co   ?? 0 },
      { metric: 'SO2',   [comparisonData.city1.name]: comparisonData.city1.so2  ?? 0, [comparisonData.city2.name]: comparisonData.city2.so2  ?? 0 },
      { metric: 'O3',    [comparisonData.city1.name]: comparisonData.city1.o3   ?? 0, [comparisonData.city2.name]: comparisonData.city2.o3   ?? 0 },
    ];
  };

  const getRadarData = () => {
    if (!comparisonData) return [];
    return [
      { metric: 'PM2.5', city1: comparisonData.city1.pm25 ?? 0,        city2: comparisonData.city2.pm25 ?? 0 },
      { metric: 'PM10',  city1: comparisonData.city1.pm10 ?? 0,        city2: comparisonData.city2.pm10 ?? 0 },
      { metric: 'NO2',   city1: comparisonData.city1.no2  ?? 0,        city2: comparisonData.city2.no2  ?? 0 },
      { metric: 'CO',    city1: (comparisonData.city1.co  ?? 0) * 10,  city2: (comparisonData.city2.co  ?? 0) * 10 },
      { metric: 'SO2',   city1: comparisonData.city1.so2  ?? 0,        city2: comparisonData.city2.so2  ?? 0 },
      { metric: 'O3',    city1: comparisonData.city1.o3   ?? 0,        city2: comparisonData.city2.o3   ?? 0 },
    ];
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Compare Cities</h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">Side-by-side air quality comparison</p>
        </div>

        {/* City Selection */}
        <div className="bg-[#111827] rounded-2xl shadow-xl p-4 md:p-8 mb-6 md:mb-8 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                Primary Comparison City
              </label>
              <select
                value={city1}
                onChange={(e) => setCity1(e.target.value)}
                className="w-full px-4 py-2 bg-[#1f2937] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 font-bold"
                style={{ color: 'white', backgroundColor: '#1f2937' }}
              >
                <option value="">Select first city...</option>
                {cities.map((city) => (
                  <option key={city.city_id} value={city.city_id}>
                    {getCityFlag(city.city_name)} {city.city_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                Secondary Comparison City
              </label>
              <select
                value={city2}
                onChange={(e) => setCity2(e.target.value)}
                className="w-full px-4 py-2 bg-[#1f2937] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 font-bold"
                style={{ color: 'white', backgroundColor: '#1f2937' }}
              >
                <option value="">Select second city...</option>
                {cities.map((city) => (
                  <option key={city.city_id} value={city.city_id}>
                    {getCityFlag(city.city_name)} {city.city_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCompare}
                disabled={loading || !city1 || !city2}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 font-bold uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {loading ? 'Analyzing...' : 'Execute Comparison'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 animate-shake">
              <span className="text-xl">⚠️</span>
              <p className="text-sm font-black text-red-400 uppercase tracking-tighter">{error}</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center h-96 space-y-8 animate-pulse">
            <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Analyzing Atmospheric Data</h3>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">Synching Regional Feeds...</p>
            </div>
          </div>
        )}

        {comparisonData && !loading && (
          <div className="space-y-8">
            {/* Side-by-side cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {[
                { data: comparisonData.city1, other: comparisonData.city2, color: 'from-blue-400 to-indigo-400' },
                { data: comparisonData.city2, other: comparisonData.city1, color: 'from-orange-400 to-red-400' }
              ].map((city, idx) => (
                <div key={idx} className="bg-[#111827] rounded-2xl md:rounded-[2rem] shadow-2xl p-4 md:p-8 border border-gray-700 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: getAQIColor(city.data.aqi_value) }}></div>

                  {city.data.aqi_value < city.other.aqi_value && (
                    <div className="absolute top-4 right-4 text-3xl animate-bounce">👑</div>
                  )}

                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${city.color} mb-1`}>
                        {city.data.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCityFlag(city.data.name)}</span>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">{city.data.country || 'Station Map'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-5xl font-black tabular-nums" style={{ color: getAQITextColor(city.data.aqi_value) }}>
                        {city.data.aqi_value}
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-opacity-10 opacity-80" style={{ backgroundColor: getAQIColor(city.data.aqi_value) + '1A', color: getAQIColor(city.data.aqi_value), borderColor: getAQIColor(city.data.aqi_value) + '4D' }}>
                        {getAQILevel(city.data.aqi_value)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-8 border-t border-gray-800/50">
                    {[
                      { l: 'PM2.5', v: city.data.pm25, u: 'μg/m³' },
                      { l: 'PM10', v: city.data.pm10, u: 'μg/m³' },
                      { l: 'NO2', v: city.data.no2, u: 'μg/m³' },
                      { l: 'CO', v: city.data.co, u: 'mg/m³' },
                      { l: 'SO2', v: city.data.so2, u: 'μg/m³' },
                      { l: 'O3', v: city.data.o3, u: 'μg/m³' },
                    ].map((p, pidx) => (
                      <div key={pidx} className="text-center p-3 bg-gray-800/30 rounded-2xl border border-gray-700/30">
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{p.l}</div>
                        <div className="text-lg font-black text-white">{p.v ?? 'N/A'}</div>
                        <div className="text-[8px] font-bold text-gray-600 uppercase">{p.u}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Visual Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Radar Chart */}
              <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] shadow-xl p-4 md:p-8 border border-gray-700">
                <h3 className="text-lg md:text-xl font-black text-white mb-4 md:mb-8 flex items-center gap-2 uppercase tracking-tight">
                  <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                  Environmental Balance
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                      <Radar
                        name={comparisonData.city1.name}
                        dataKey="city1"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.5}
                      />
                      <Radar
                        name={comparisonData.city2.name}
                        dataKey="city2"
                        stroke="#F97316"
                        fill="#F97316"
                        fillOpacity={0.5}
                      />
                      <Legend />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grouped Bar Chart */}
              <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] shadow-xl p-4 md:p-8 border border-gray-700">
                <h3 className="text-lg md:text-xl font-black text-white mb-4 md:mb-8 flex items-center gap-2 uppercase tracking-tight">
                  <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                  Direct Pollutant Comparison
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="metric" stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                      <YAxis stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }} />
                      <Legend />
                      <Bar dataKey={comparisonData.city1.name} fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} />
                      <Bar dataKey={comparisonData.city2.name} fill="#F97316" radius={[6, 6, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-[#111827] rounded-2xl md:rounded-3xl p-4 md:p-8 border border-gray-700 shadow-xl flex flex-col items-center">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">AQI Variance</div>
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-black text-white tabular-nums">
                    {Math.abs(comparisonData.city1.aqi_value - comparisonData.city2.aqi_value)}
                  </div>
                  <div className={`text-2xl ${comparisonData.city1.aqi_value > comparisonData.city2.aqi_value ? 'text-red-400' : 'text-emerald-400'}`}>
                    {comparisonData.city1.aqi_value > comparisonData.city2.aqi_value ? '↑' : '↓'}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">Points Difference</p>
              </div>

              <div className="bg-[#111827] rounded-3xl p-8 border border-emerald-500/20 shadow-xl flex flex-col items-center">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Superior Environment</div>
                <div className="px-6 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 font-black text-sm uppercase tracking-tighter">
                  {comparisonData.city1.aqi_value < comparisonData.city2.aqi_value ? comparisonData.city1.name : comparisonData.city2.name}
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">Optimal air conditions</p>
              </div>

              <div className="bg-[#111827] rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col items-center">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Activity Forecast</div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-300">
                    Prefer <span className="text-emerald-400 font-black">{comparisonData.city1.aqi_value < comparisonData.city2.aqi_value ? comparisonData.city1.name : comparisonData.city2.name}</span> for outdoor activities today.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!comparisonData && !loading && (
          <div className="bg-[#111827] rounded-[3rem] p-24 text-center border border-dashed border-gray-800 shadow-inner">
            <div className="relative inline-block mb-10">
              <div className="text-7xl">⚖️</div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            </div>
            <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Environmental Comparison Engine</h3>
            <p className="text-gray-500 max-w-lg mx-auto text-xs font-bold leading-relaxed uppercase tracking-widest opacity-60">
              Select two distinct monitoring stations from the dropdowns above <br /> to initialize a side-by-side atmospheric cross-analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
