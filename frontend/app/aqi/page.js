'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getCities, getCityAQI, getCityAQILatest, getSmartAnalysis } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/firebase';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

export default function AQIPage() {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [cityData, setCityData] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [rlStrategy, setRlStrategy] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();

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

    const cityId = searchParams.get('city');
    if (cityId) {
      setSelectedCity(cityId);
      fetchSmartAnalysis(cityId);
    }
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, [searchParams]);

  const fetchCities = async () => {
    try {
      const data = await getCities();
      setCities(data);
    } catch (error) {
      setError('Failed to load cities');
      console.error(error);
    }
  };

  // ── Smart Analysis — single orchestration endpoint ──────────────────────
  const fetchSmartAnalysis = async (cityId) => {
    if (!cityId) return;
    setLoading(true);
    setForecastLoading(true);
    setError('');
    setActiveAlerts([]);
    setDismissedAlerts(new Set());
    try {
      const response = await getSmartAnalysis(cityId);

      // Map city / pollutant data shape the rest of the page expects
      setCityData({
        city_name:  response.city_name,
        aqi_score:  response.current_aqi,
        pm25:       response.pm25 ?? response.forecast?.forecast?.[0]?.pm25  ?? null,
        pm10:       response.pm10 ?? response.forecast?.forecast?.[0]?.pm10  ?? null,
        no2:        response.no2 ?? response.forecast?.forecast?.[0]?.no2   ?? null,
        so2:        response.so2 ?? response.forecast?.forecast?.[0]?.so2   ?? null,
        o3:         response.o3 ?? response.forecast?.forecast?.[0]?.o3    ?? null,
        co:         response.co ?? response.forecast?.forecast?.[0]?.co    ?? null,
        // keep a reference to the full raw response for any downstream use
        _raw: response,
      });

      // ML prediction block
      setMlPrediction({
        risk_level: response.ml_prediction.risk_level,
        confidence: response.ml_prediction.confidence,
        next_24h:   response.forecast?.forecast?.[0]?.predicted_aqi ?? null,
      });

      // RL strategy block
      setRlStrategy({
        strategy:       response.rl_strategy.strategy_name,
        description:    response.rl_strategy.description,
        confidence:     response.rl_strategy.confidence ?? response.rl_strategy.rl_reward,
        urgency:        response.rl_strategy.urgency,
        trigger_reason: response.rl_strategy.trigger_reason,
      });

      // 7-day forecast (passed straight to existing forecast renderer)
      setForecastData(response.forecast);

      // Active alerts from alert engine — seed from smart-analysis response,
      // then override with dedicated endpoint for freshest data
      setActiveAlerts(Array.isArray(response.active_alerts) ? response.active_alerts : []);
      try {
        const alertsRes = await api.get('/alerts/active', { params: { city_id: cityId } });
        const fresh = Array.isArray(alertsRes.data) ? alertsRes.data : [];
        if (fresh.length > 0) setActiveAlerts(fresh);
      } catch (_) { /* fall back to smart-analysis alerts */ }

    } catch (err) {
      setError(err.message || 'Failed to load analysis');
      console.error('fetchSmartAnalysis error:', err);
    } finally {
      setLoading(false);
      setForecastLoading(false);
    }
  };

  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setSelectedCity(cityId);
    if (cityId) {
      fetchSmartAnalysis(cityId);
    } else {
      setCityData(null);
      setMlPrediction(null);
      setRlStrategy(null);
      setForecastData(null);
      setActiveAlerts([]);
      setDismissedAlerts(new Set());
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

  const pollutantLimits = {
    pm25: 60,
    pm10: 100,
    no2: 80,
    co: 4,
    so2: 80,
    o3: 100,
  };

  const getPollutantColor = (val, limit) => {
    const ratio = val / limit;
    if (ratio < 0.5) return 'bg-emerald-500';
    if (ratio < 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getCityFlag = (cityName) => {
    const flags = {
      'Delhi': '🇮🇳', 'Mumbai': '🇮🇳', 'Bangalore': '🇮🇳', 'Chennai': '🇮🇳',
      'Kolkata': '🇮🇳', 'Hyderabad': '🇮🇳', 'Ahmedabad': '🇮🇳', 'Pune': '🇮🇳',
      'London': '🇬🇧', 'New York': '🇺🇸', 'Tokyo': '🇯🇵', 'Paris': '🇫🇷', 'Beijing': '🇨🇳'
    };
    return flags[cityName] || '📍';
  };

  function getMainPollutant(pollutants) {
    const subIndex = {
      'PM2.5': pollutants.pm25 ? (pollutants.pm25 / 60)  * 100 : 0,
      'PM10':  pollutants.pm10 ? (pollutants.pm10 / 100) * 100 : 0,
      'NO2':   pollutants.no2  ? (pollutants.no2  / 80)  * 100 : 0,
      'CO':    pollutants.co   ? (pollutants.co   / 10)  * 100 : 0,
      'SO2':   pollutants.so2  ? (pollutants.so2  / 80)  * 100 : 0,
      'O3':    pollutants.o3   ? (pollutants.o3   / 180) * 100 : 0,
    };
    const main = Object.entries(subIndex).sort((a, b) => b[1] - a[1])[0];
    return main[0];
  }

  function computeContributions(pollutants) {
    const COLOR_MAP = {
      'PM2.5': '#ef4444',
      'PM10':  '#f97316',
      'NO2':   '#eab308',
      'CO':    '#84cc16',
      'SO2':   '#06b6d4',
      'O3':    '#a855f7',
    };
    const raw = {
      'PM2.5': pollutants.pm25 ? (pollutants.pm25 / 60)  * 100 : 0,
      'PM10':  pollutants.pm10 ? (pollutants.pm10 / 100) * 100 : 0,
      'NO2':   pollutants.no2  ? (pollutants.no2  / 80)  * 100 : 0,
      'CO':    pollutants.co   ? (pollutants.co   / 10)  * 100 : 0,
      'SO2':   pollutants.so2  ? (pollutants.so2  / 80)  * 100 : 0,
      'O3':    pollutants.o3   ? (pollutants.o3   / 180) * 100 : 0,
    };
    const total = Object.values(raw).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    return Object.entries(raw)
      .map(([name, value]) => ({
        name,
        value: parseFloat(((value / total) * 100).toFixed(1)),
        color: COLOR_MAP[name],
      }))
      .sort((a, b) => b.value - a.value);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">AQI Monitor</h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">Detailed air quality analysis for cities</p>
        </div>

        {/* City Selector */}
        <div className="mb-6 md:mb-8 p-4 md:p-6 bg-[#111827] rounded-xl border border-gray-700">
          <label htmlFor="city-select" className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-tight">
            Select Monitoring Station
          </label>
          <select
            id="city-select"
            value={selectedCity}
            onChange={handleCityChange}
            className="w-full md:w-96 px-4 py-3 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 bg-[#1f2937] text-white font-bold"
            style={{ color: 'white', backgroundColor: '#1f2937' }}
          >
            <option value="">Choose a monitoring station...</option>
            {cities.map((city) => (
              <option key={city.city_id} value={city.city_id}>
                {getCityFlag(city.city_name)} {city.city_name}
              </option>
            ))}
          </select>
        </div>


        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading city data...</p>
            </div>
          </div>
        )}

        {cityData && !loading && (
          <div className="space-y-6 md:space-y-10">
            {/* ── Active Alert Banners ─────────────────────────────────── */}
            {activeAlerts
              .filter(a => !dismissedAlerts.has(a.alert_id))
              .map((alert) => {
                const type = alert.alert_type?.toUpperCase();
                const isCritical = type === 'CRITICAL';
                const isWarning  = type === 'WARNING';
                return (
                  <div
                    key={alert.alert_id}
                    className={`flex items-start justify-between gap-3 px-5 py-4 rounded-2xl border text-sm font-bold ${
                      isCritical ? 'bg-red-500/10 border-red-500/40 text-red-300'
                      : isWarning ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span className="flex-shrink-0">
                        {isCritical ? '⚠' : isWarning ? '⚡' : 'ℹ'}
                      </span>
                      <span>
                        {alert.message}
                        {alert.strategy_name && (
                          <span className="ml-2 opacity-60 font-medium">
                            — Strategy: {alert.strategy_name}
                          </span>
                        )}
                      </span>
                    </span>
                    <button
                      onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.alert_id]))}
                      className="flex-shrink-0 opacity-50 hover:opacity-100 text-lg leading-none"
                      aria-label="Dismiss alert"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            }

            {/* SECTION A — AQI Score Hero */}
            <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] shadow-2xl p-6 md:p-10 border border-gray-700 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 md:gap-12">
              <div className="relative w-48 h-48 md:w-64 md:h-64 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="128"
                    cy="128"
                    r="110"
                    stroke="currentColor"
                    strokeWidth="16"
                    fill="transparent"
                    className="text-gray-800"
                  />
                  <circle
                    cx="128"
                    cy="128"
                    r="110"
                    strokeWidth="16"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 110}
                    strokeDashoffset={2 * Math.PI * 110 * (1 - Math.min(cityData.aqi_score, 500) / 500)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ stroke: getAQIColor(cityData.aqi_score) }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-black text-white">{cityData.aqi_score}</span>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Points</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-4 mb-4 justify-center md:justify-start">
                  <h2 className="text-5xl font-black text-white">{cityData.city_name}</h2>
                  <span className="text-4xl">{getCityFlag(cityData.city_name)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-6 justify-center md:justify-start">
                  <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{
                    backgroundColor: getAQIColor(cityData.aqi_score) + '33',
                    color: getAQIColor(cityData.aqi_score),
                    borderColor: getAQIColor(cityData.aqi_score) + '4D'
                  }}>
                    {getAQILevel(cityData.aqi_score)} Risk Level
                  </span>
                  <span className="text-gray-500 font-bold text-xs uppercase tracking-widest bg-gray-800/50 px-3 py-1.5 rounded-full">
                    Station ID: #00{selectedCity}
                  </span>
                </div>

                <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-gray-700/50 inline-block">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Last Sync Time</div>
                      <div className="text-sm font-bold text-white tabular-nums">{currentTime}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Main Pollutant: {getMainPollutant(cityData)}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION B — Pollutant Breakdown (6 cards in 2x3 grid) */}
            <div>
              <h3 className="text-lg md:text-xl font-black text-white mb-4 md:mb-8 flex items-center gap-3 uppercase tracking-tight">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                Atomic Pollutant Analysis
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[
                  { id: 'pm25', name: 'PM2.5', label: 'Fine Particulates', unit: 'μg/m³', value: cityData.pm25 },
                  { id: 'pm10', name: 'PM10', label: 'Inhalable Dust', unit: 'μg/m³', value: cityData.pm10 },
                  { id: 'no2', name: 'NO2', label: 'Nitrogen Dioxide', unit: 'μg/m³', value: cityData.no2 },
                  { id: 'so2', name: 'SO2', label: 'Sulfur Dioxide', unit: 'μg/m³', value: cityData.so2 },
                  { id: 'o3', name: 'O3', label: 'Ozone Layer', unit: 'μg/m³', value: cityData.o3 },
                  { id: 'co', name: 'CO', label: 'Carbon Monoxide', unit: 'mg/m³', value: cityData.co },
                ].map((item) => (
                  <div key={item.id} className="bg-[#111827] rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-700 hover:border-gray-500 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{item.label}</div>
                        <h4 className="text-2xl font-black text-white tracking-tighter">{item.name}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-white">
                          {item.value != null ? item.value : 'N/A'}
                        </div>
                        <div className="text-[9px] font-black text-gray-500 uppercase">{item.unit}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {item.value != null ? (
                        <>
                          <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            <span>Safe Margin</span>
                            <span className={item.value > pollutantLimits[item.id] ? 'text-red-400' : 'text-emerald-400'}>
                              {Math.round((item.value / pollutantLimits[item.id]) * 100)}% Load
                            </span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ease-out ${getPollutantColor(item.value, pollutantLimits[item.id])}`}
                              style={{ width: `${Math.min((item.value / pollutantLimits[item.id]) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            <span>Safe Margin</span>
                            <span className="text-gray-600">No data</span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION E — Pollutant Contribution Breakdown */}
            {(() => {
              const contributions = computeContributions(cityData);
              if (!contributions.length) return null;
              return (
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white mb-4 md:mb-8 flex items-center gap-3 uppercase tracking-tight">
                    <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                    Pollutant Contribution
                  </h3>

                  <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] p-4 md:p-8 border border-gray-700 shadow-2xl space-y-4">
                    {contributions.map((p) => (
                      <div key={p.name} className="flex items-center gap-3">
                        {/* Label */}
                        <span
                          className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-right shrink-0"
                          style={{ width: '52px' }}
                        >
                          {p.name}
                        </span>

                        {/* Bar track */}
                        <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${p.value}%`,
                              backgroundColor: p.color,
                              boxShadow: `0 0 8px ${p.color}66`,
                            }}
                          />
                        </div>

                        {/* Percentage */}
                        <span
                          className="text-xs font-black tabular-nums shrink-0"
                          style={{ color: p.color, width: '44px', textAlign: 'right' }}
                        >
                          {p.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* SECTION D — 7-Day AQI Forecast */}
            <div>
              <div className="flex items-center justify-between mb-4 md:mb-8">
                <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                  <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                  7-Day AQI Forecast
                </h3>
                {forecastData && !forecastData.error && (
                  <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                    forecastData.trend === 'increasing'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : forecastData.trend === 'decreasing'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-gray-500/10 text-gray-400 border-gray-600/30'
                  }`}>
                    Trend:&nbsp;
                    {forecastData.trend === 'increasing' ? 'Rising ↑'
                      : forecastData.trend === 'decreasing' ? 'Falling ↓'
                      : 'Stable →'}
                  </span>
                )}
              </div>

              <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] p-4 md:p-8 border border-gray-700 shadow-2xl">
                {/* Loading */}
                {forecastLoading && (
                  <div className="flex items-center justify-center h-52 text-gray-500 text-xs font-black uppercase tracking-widest animate-pulse">
                    Computing XGBoost forecast…
                  </div>
                )}

                {/* Error */}
                {!forecastLoading && forecastData?.error && (
                  <div className="flex flex-col items-center justify-center h-52 gap-3">
                    <span className="text-3xl">📉</span>
                    <p className="text-yellow-400 font-black text-sm uppercase tracking-widest">
                      Forecast unavailable — insufficient history data
                    </p>
                    <p className="text-gray-600 text-xs">{forecastData.error}</p>
                  </div>
                )}

                {/* Chart */}
                {!forecastLoading && forecastData && !forecastData.error && (() => {
                  const chartData = forecastData.forecast.map((p) => ({
                    day: new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' }),
                    aqi: p.predicted_aqi,
                    risk: p.risk_level,
                  }));

                  const lineColor =
                    forecastData.trend === 'increasing' ? '#f87171'
                    : forecastData.trend === 'decreasing' ? '#34d399'
                    : '#818cf8';

                  const CustomTooltip = ({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-xl font-black text-white">{payload[0].value} <span className="text-xs text-gray-500">AQI</span></p>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: lineColor }}>
                          {payload[0].payload.risk}
                        </p>
                      </div>
                    );
                  };

                  return (
                    <>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={lineColor} stopOpacity={0.4}/>
                              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }}
                            axisLine={{ stroke: '#374151' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine
                            y={100}
                            stroke="#fbbf24"
                            strokeDasharray="4 3"
                            label={{ value: 'Moderate', fill: '#fbbf24', fontSize: 10, fontWeight: 700, position: 'insideTopLeft' }}
                          />
                          <ReferenceLine
                            y={200}
                            stroke="#f87171"
                            strokeDasharray="4 3"
                            label={{ value: 'Poor', fill: '#f87171', fontSize: 10, fontWeight: 700, position: 'insideTopLeft' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="aqi"
                            stroke={lineColor}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorAqi)"
                            dot={{ fill: lineColor, r: 5, strokeWidth: 2, stroke: '#111827' }}
                            activeDot={{ r: 7, stroke: lineColor, strokeWidth: 2, fill: '#111827' }}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      </ResponsiveContainer>

                      {/* Forecast summary stat cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800">
                        <div className="bg-gray-800/40 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Peak AQI</div>
                          <div className="text-lg font-black text-white">{forecastData.peak_aqi ?? '—'}</div>
                          <div className="text-[9px] text-gray-500">Day {forecastData.peak_day ?? '—'}</div>
                        </div>
                        <div className="bg-gray-800/40 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">7-Day Trend</div>
                          <div className={`text-sm font-black ${forecastData.trend === 'increasing' ? 'text-red-400' : forecastData.trend === 'decreasing' ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {forecastData.trend === 'increasing' ? '↑ Rising' : forecastData.trend === 'decreasing' ? '↓ Falling' : '→ Stable'}
                          </div>
                        </div>
                        <div className="bg-gray-800/40 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Days &gt; 200</div>
                          <div className={`text-lg font-black ${(forecastData.days_above_200 ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {forecastData.days_above_200 ?? 0}
                          </div>
                          <div className="text-[9px] text-gray-500">Poor+</div>
                        </div>
                        <div className="bg-gray-800/40 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Days &gt; 300</div>
                          <div className={`text-lg font-black ${(forecastData.days_above_300 ?? 0) > 0 ? 'text-purple-400' : 'text-emerald-400'}`}>
                            {forecastData.days_above_300 ?? 0}
                          </div>
                          <div className="text-[9px] text-gray-500">Hazardous</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* SECTION C — Health Advisory + RL Strategy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Health Advisory */}
              <div className="bg-[#111827] rounded-2xl md:rounded-[2rem] p-4 md:p-8 border-y border-r border-gray-700 shadow-xl" style={{ borderLeftWidth: '8px', borderLeftStyle: 'solid', borderLeftColor: getAQIColor(cityData.aqi_score) }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">
                    {cityData.aqi_score <= 100 ? '😊' : cityData.aqi_score <= 200 ? '😷' : '🚨'}
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Health Protocol</h3>
                </div>
                <p className="text-gray-300 text-lg font-medium leading-relaxed mb-6">
                  {cityData.aqi_score <= 100 ? 'Air quality is good. Safe for all activities.' :
                    cityData.aqi_score <= 200 ? 'Sensitive groups should limit outdoor time. Consider wearing a cloth mask in high traffic areas.' :
                      'Hazardous! Avoid outdoor activities. Use N95 mask and activate indoor air purifiers immediately.'}
                </p>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: 'Outdoor Exercise', safe: cityData.aqi_score <= 100 },
                    { label: 'Window Opening',   safe: cityData.aqi_score <= 100 },
                    { label: 'Mask Usage',       safe: cityData.aqi_score > 100  },
                  ].map((item, idx) => (
                    <div key={idx} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${item.safe ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.safe ? 'bg-emerald-500' : 'bg-red-400'}`}></span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* RL Agent Strategy */}
              <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl">
                    🤖
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Agent Inference</h3>
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Reinforcement Learning Strategy</div>
                  </div>
                  {/* Urgency badge */}
                  {rlStrategy?.urgency && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border flex-shrink-0 ${
                      rlStrategy.urgency === 'immediate'
                        ? 'bg-red-500/15 border-red-500/40 text-red-400'
                        : rlStrategy.urgency === 'warning'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    }`}>
                      {rlStrategy.urgency === 'immediate' ? 'ACT NOW'
                        : rlStrategy.urgency === 'warning' ? 'WARNING'
                        : 'ADVISORY'}
                    </span>
                  )}
                </div>

                {rlStrategy && (
                  <>
                    <div className="text-2xl font-black text-white mb-2 leading-tight uppercase tracking-tighter">
                      {rlStrategy.strategy}
                    </div>
                    <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                      {rlStrategy.description}
                    </p>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Inference Confidence</span>
                        <span className="text-xl font-black text-blue-500 tabular-nums">{rlStrategy.confidence}%</span>
                      </div>
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-700">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000"
                          style={{ width: `${rlStrategy.confidence}%` }}
                        ></div>
                      </div>
                      {rlStrategy.trigger_reason && (
                        <p className="text-[10px] text-gray-500 italic leading-relaxed border-l-2 border-gray-700 pl-3">
                          {rlStrategy.trigger_reason}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedCity && !loading && (
          <div className="bg-[#111827] rounded-3xl p-20 text-center border border-dashed border-gray-700">
            <div className="text-6xl mb-6">🌍</div>
            <h3 className="text-2xl font-black text-white mb-2">Select a city to view AQI data</h3>
            <p className="text-gray-500">Choose from the monitoring stations dropdown above to see detailed insights</p>
          </div>
        )}
      </div>
    </div >
  );
}
