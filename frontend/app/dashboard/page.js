'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient, { getAllCitiesAQI } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, Label, LabelList
} from 'recharts';

/* ── Trend arrow helper ───────────────────────────────────────────── */
const getTrendArrow = (diff) => {
  if (diff > 5)  return { arrow: '↑', color: 'text-red-400',   label: 'Rising'  };
  if (diff < -5) return { arrow: '↓', color: 'text-green-400', label: 'Falling' };
  return           { arrow: '→', color: 'text-gray-400',   label: 'Stable'  };
};

/* ── AQI color helper ─────────────────────────────────────────────── */
const getAQIColor = (aqi) => {
  if (aqi === null || aqi === undefined) return { bg: '#6b7280', text: '#ffffff', label: 'Unknown' };
  if (aqi <= 50) return { bg: '#22c55e', text: '#ffffff', label: 'Good' };
  if (aqi <= 100) return { bg: '#eab308', text: '#ffffff', label: 'Satisfactory' };
  if (aqi <= 200) return { bg: '#f97316', text: '#ffffff', label: 'Moderate' };
  if (aqi <= 300) return { bg: '#ef4444', text: '#ffffff', label: 'Poor' };
  if (aqi <= 400) return { bg: '#a855f7', text: '#ffffff', label: 'Very Poor' };
  return { bg: '#78716c', text: '#ffffff', label: 'Hazardous' };
};

/* ── Stat Card Icon Components ────────────────────────────────────── */
const CityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 22h20M6 22V6l6-4 6 4v16M10 10h.01M14 10h.01M10 14h.01M14 14h.01M10 18h4" />
  </svg>
);
const ThermometerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9V3m0 6a3 3 0 100 6 3 3 0 000-6zm0 6v6M8 17a4 4 0 108 0" />
  </svg>
);
const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);
const LeafIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4-4-8-7.5-8-12a8 8 0 0116 0c0 4.5-4 8-8 12z" />
  </svg>
);

/* ── Custom Tooltip for Bar Chart ──────────────────────────────────── */
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const aqi = payload[0].value;
  const info = getAQIColor(aqi);
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      <p className="text-sm" style={{ color: info.bg }}>
        AQI: <span className="font-bold">{aqi}</span> — {info.label}
      </p>
    </div>
  );
};

/* ── Custom Tooltip for Pie Chart ──────────────────────────────────── */
const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-white text-sm font-semibold">
        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: payload[0].payload.color }}></span>
        {payload[0].name}: <span className="font-bold">{payload[0].value}</span> {payload[0].value === 1 ? 'city' : 'cities'}
      </p>
    </div>
  );
};

/* ── AQI Legend Band Bar ──────────────────────────────────────────── */
const AQILegendBar = () => {
  const bands = [
    { label: 'Good', range: '0-50', color: '#22c55e' },
    { label: 'Satisfactory', range: '51-100', color: '#eab308' },
    { label: 'Moderate', range: '101-200', color: '#f97316' },
    { label: 'Poor', range: '201-300', color: '#ef4444' },
    { label: 'Very Poor', range: '301-400', color: '#a855f7' },
    { label: 'Hazardous', range: '400+', color: '#78716c' },
  ];
  return (
    <div className="mb-10">
      <div className="flex rounded-full overflow-hidden h-2">
        {bands.map((b, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: b.color }} />
        ))}
      </div>
      <div className="flex mt-2">
        {bands.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[10px] font-semibold text-gray-300">{b.label}</p>
            <p className="text-[9px] text-gray-500">{b.range}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Stat Card Component ──────────────────────────────────────────── */
const StatCard = ({ icon: Icon, iconBg, value, label, trend, valueColor = 'text-white' }) => (
  <div className="group bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-gray-700">
    {/* Subtle gradient overlay on hover */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className={`text-4xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">{label}</p>
        {trend && (
          <p className="text-xs text-gray-500 mt-2">{trend}</p>
        )}
      </div>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg + '33', color: iconBg }}>
        <Icon />
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [citiesData, setCitiesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trendMap, setTrendMap] = useState({});
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
    fetchCitiesAQI();
  }, []);

  const fetchCitiesAQI = async () => {
    try {
      setLoading(true);
      const data = await getAllCitiesAQI();
      setCitiesData(data);
      setLastUpdated(new Date());

      const trendEntries = await Promise.all(
        data.map(async (city) => {
          try {
            const res = await apiClient.get(`/aqi/history/${city.id}`);
            const hist = res.data;
            if (hist.length >= 2) {
              const diff = hist[hist.length - 1].avg_aqi - hist[hist.length - 2].avg_aqi;
              return [city.id, getTrendArrow(diff)];
            }
          } catch (_) {}
          return [city.id, getTrendArrow(0)];
        })
      );
      setTrendMap(Object.fromEntries(trendEntries));
    } catch (error) {
      setError('Failed to load AQI data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /* Alert check */
  useEffect(() => {
    if (citiesData.length > 0) {
      const saved = localStorage.getItem('aqi_alert_config');
      if (saved) {
        const config = JSON.parse(saved);
        const cityData = citiesData.find(c => c.name === config.city);
        if (cityData && cityData.aqi_value > config.threshold) {
          toast.error(`⚠️ Alert: ${config.city} AQI is ${cityData.aqi_value}, exceeding your threshold of ${config.threshold}`, {
            duration: 10000,
            icon: '🚨',
            id: 'aqi-alert'
          });
        }
      }
    }
  }, [citiesData]);

  /* ── Derived data ────────────────────────────────────────────────── */
  const avgAQI = citiesData.length > 0
    ? Math.round(citiesData.reduce((acc, city) => acc + (city.aqi_value || 0), 0) / citiesData.length)
    : 0;
  const highRiskCount = citiesData.filter(c => (c.aqi_value || 0) > 200).length;
  const goodAQICount = citiesData.filter(c => (c.aqi_value || 0) <= 100).length;
  const chartData = [...citiesData].sort((a, b) => (b.aqi_value || 0) - (a.aqi_value || 0));

  const distributionData = [
    { name: 'Good', value: citiesData.filter(c => (c.aqi_value || 0) <= 50).length, color: '#22c55e' },
    { name: 'Satisfactory', value: citiesData.filter(c => (c.aqi_value || 0) > 50 && (c.aqi_value || 0) <= 100).length, color: '#eab308' },
    { name: 'Moderate', value: citiesData.filter(c => (c.aqi_value || 0) > 100 && (c.aqi_value || 0) <= 200).length, color: '#f97316' },
    { name: 'Poor', value: citiesData.filter(c => (c.aqi_value || 0) > 200 && (c.aqi_value || 0) <= 300).length, color: '#ef4444' },
    { name: 'Very Poor', value: citiesData.filter(c => (c.aqi_value || 0) > 300 && (c.aqi_value || 0) <= 400).length, color: '#a855f7' },
    { name: 'Hazardous', value: citiesData.filter(c => (c.aqi_value || 0) > 400).length, color: '#78716c' },
  ].filter(d => d.value > 0);

  /* ── Loading state (Skeletons) ───────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white">
        <Navbar />
        <main className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 xl:px-16 py-8 lg:py-12 space-y-6">
          {/* Skeleton stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-800 rounded-2xl p-6 h-32 animate-pulse"></div>
            ))}
          </div>

          <div className="h-2 bg-gray-800 rounded-full w-full animate-pulse"></div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-gray-800 rounded-2xl h-[400px] animate-pulse"></div>
            <div className="xl:col-span-1 bg-gray-800 rounded-2xl h-[400px] animate-pulse"></div>
          </div>

          <div className="h-8 bg-gray-800 rounded w-1/4 animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-gray-800 rounded-2xl h-64 animate-pulse"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  /* ── Main render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans selection:bg-blue-500/30 animate-fadeIn">
      <Navbar />

      <main className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 xl:px-16 py-8 lg:py-12 space-y-6">

        {/* ── STAT CARDS (4 across) ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            icon={CityIcon}
            iconBg="#3b82f6"
            value={citiesData.length}
            label="Cities Monitored"
            trend="+2% this hour"
          />
          <StatCard
            icon={ThermometerIcon}
            iconBg={getAQIColor(avgAQI).bg}
            value={avgAQI}
            label="Avg AQI Today"
            trend={getAQIColor(avgAQI).label}
            valueColor="text-white"
          />
          <StatCard
            icon={AlertIcon}
            iconBg="#ef4444"
            value={highRiskCount}
            label="High Risk Cities"
            trend="AQI > 200"
          />
          <StatCard
            icon={LeafIcon}
            iconBg="#22c55e"
            value={goodAQICount}
            label="Good Air Quality"
            trend="AQI ≤ 100"
          />
        </div>

        {/* ── AQI LEGEND BAR ────────────────────────────────────────── */}
        <AQILegendBar />

        {/* ── CHARTS SECTION ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Bar Chart — City AQI Comparison */}
          <div className="xl:col-span-2 bg-gray-900 rounded-2xl p-6 lg:p-8 border border-gray-800">
            <h3 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              City AQI Comparison
            </h3>
            <div className="h-[350px] lg:h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" domain={[0, 500]} stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} />
                  <YAxis dataKey="name" type="category" stroke="#374151" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} axisLine={{ stroke: '#1f2937' }} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(31,41,55,0.5)' }} />
                  <ReferenceLine x={100} stroke="#eab308" strokeDasharray="5 5" label={{ value: 'Satisfactory limit', position: 'top', fill: '#eab308', fontSize: 10 }} />
                  <ReferenceLine x={200} stroke="#f97316" strokeDasharray="5 5" label={{ value: 'Moderate limit', position: 'top', fill: '#f97316', fontSize: 10 }} />
                  <Bar dataKey="aqi_value" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={true} animationDuration={1200}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getAQIColor(entry.aqi_value).bg} />
                    ))}
                    <LabelList dataKey="aqi_value" position="right" fill="#9ca3af" fontSize={11} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart — Air Quality Distribution */}
          <div className="xl:col-span-1 bg-gray-900 rounded-2xl p-6 lg:p-8 border border-gray-800 flex flex-col">
            <h3 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-purple-500 rounded-full"></span>
              Air Quality Distribution
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={1000}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                    <Label
                      value={citiesData.length}
                      position="center"
                      fill="white"
                      style={{ fontSize: '36px', fontWeight: '700' }}
                    />
                    <Label
                      value="CITIES"
                      position="center"
                      dy={24}
                      fill="#6b7280"
                      style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.1em' }}
                    />
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Horizontal legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
              {distributionData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-xs text-gray-400">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CITY CARDS GRID ───────────────────────────────────────── */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
            Detailed Air Quality Index
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {citiesData.map((city) => {
              const aqiInfo = getAQIColor(city.aqi_value);
              return (
                <div
                  key={city.id}
                  onClick={() => router.push(`/aqi?city=${city.id}`)}
                  className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10"
                >
                  {/* Top row: city name + AQI badge */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-semibold text-sm truncate mr-2">{city.name}</h4>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: aqiInfo.bg }}
                    >
                      {aqiInfo.label}
                    </span>
                  </div>

                  {/* Large AQI number + trend arrow */}
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-5xl font-black" style={{ color: aqiInfo.bg }}>
                      {city.aqi_value ?? '--'}
                    </p>
                    {trendMap[city.id] && (
                      <span
                        className={`text-2xl font-bold ${trendMap[city.id].color}`}
                        title={trendMap[city.id].label}
                      >
                        {trendMap[city.id].arrow}
                      </span>
                    )}
                  </div>

                  {/* 2×2 Pollutant pills grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { l: 'PM2.5', v: city.pm25 },
                      { l: 'PM10', v: city.pm10 },
                      { l: 'NO₂', v: city.no2 },
                      { l: 'O₃', v: city.o3 },
                    ].map((p, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg px-2 py-1 text-xs">
                        <span className="text-gray-400">{p.l}</span>{' '}
                        <span className="text-white font-medium">{p.v ?? 'N/A'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Risk level + last updated */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Risk: {aqiInfo.label}</span>
                    <span>{lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {citiesData.length === 0 && !loading && (
          <div className="bg-gray-900 rounded-2xl p-16 text-center border border-dashed border-gray-800">
            <div className="text-5xl mb-4">🏜️</div>
            <h3 className="text-xl font-bold text-white mb-2">No data available</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Our sensors are currently being recalibrated. Please check back shortly for real-time environmental data.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-16 py-8">
        <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 xl:px-16 text-center">
          <p className="text-gray-600 text-xs tracking-wider">
            &copy; {new Date().getFullYear()} Carbon AQI Monitoring System
          </p>
        </div>
      </footer>
    </div>
  );
}
