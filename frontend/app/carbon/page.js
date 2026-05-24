'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateCarbon, getCarbonHistory, getCarbonAverage } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Navbar from '@/components/Navbar';
import { auth } from '@/lib/firebase';

export default function CarbonPage() {
  const [formData, setFormData] = useState({
    km_travelled: 0,
    transport_type: 'car_petrol',
    electricity_kwh: 0,
    cooking_fuel: 'lpg',
    cooking_hours: 0,
    diet_type: 'vegetarian',
    waste_kg: 0,
    recycling_percent: 0,
    water_litres: 0,
  });
  const [monthlyTarget, setMonthlyTarget] = useState(100);
  const [trendData, setTrendData] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [average, setAverage] = useState({ india: 112, world: 375 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      } else {
        fetchCarbonData();
      }
    });
    return unsubscribe;
  }, [router]);

  const fetchCarbonData = async () => {
    try {
      const [historyData, averageData] = await Promise.all([
        getCarbonHistory(),
        getCarbonAverage()
      ]);
      setHistory(historyData);
      setAverage(averageData);
    } catch (error) {
      console.error('Failed to fetch carbon data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('type') || name.includes('fuel') ? value : parseFloat(value) || 0
    }));
  };

  const emissionFactors = {
    car_petrol: 0.21,
    car_diesel: 0.17,
    motorcycle: 0.11,
    bus: 0.089,
    train: 0.041,
    auto: 0.13,
    grid_india: 0.82,
    lpg: 0.21,
    png: 0.18,
    electric_cook: 0,
    vegan: 1.5,
    vegetarian: 2.5,
    non_veg_occ: 3.8,
    non_veg_daily: 5.5
  };

  const calculateLiveTotal = () => {
    const transport = formData.km_travelled * emissionFactors[formData.transport_type];
    const energy = (formData.electricity_kwh * emissionFactors.grid_india) + (formData.cooking_hours * 30 * emissionFactors[formData.cooking_fuel]);
    const diet = emissionFactors[formData.diet_type] * 30;
    const waste = formData.waste_kg * 52 * (1 - formData.recycling_percent / 100) * 0.5;
    const water = formData.water_litres * 365 * 0.0003;

    return {
      total: transport + energy + diet + waste + water,
      transport,
      energy,
      diet,
      waste,
      water
    };
  };

  const liveStats = calculateLiveTotal();

  useEffect(() => {
    const saved = localStorage.getItem('weeklyTrend');
    const base = liveStats.total;
    let newTrend;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          newTrend = [...parsed];
          newTrend[3].value = base;
        } else {
          newTrend = [
            { name: 'Week 1', value: base },
            { name: 'Week 2', value: base },
            { name: 'Week 3', value: base },
            { name: 'This Week', value: base }
          ];
        }
      } catch (e) {
        newTrend = [
          { name: 'Week 1', value: base },
          { name: 'Week 2', value: base },
          { name: 'Week 3', value: base },
          { name: 'This Week', value: base }
        ];
      }
    } else {
      newTrend = [
        { name: 'Week 1', value: base },
        { name: 'Week 2', value: base },
        { name: 'Week 3', value: base },
        { name: 'This Week', value: base }
      ];
    }
    setTrendData(newTrend);
    localStorage.setItem('weeklyTrend', JSON.stringify(newTrend));
  }, [liveStats.total]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const data = await calculateCarbon(formData);
      setResult(data);
      fetchCarbonData(); // Refresh history and average
    } catch (error) {
      setError('Failed to calculate carbon footprint');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    const rows = [
      ["Category", "Emission (kg CO2/month)"],
      ["Transport", liveStats.transport.toFixed(2)],
      ["Energy", liveStats.energy.toFixed(2)],
      ["Diet", liveStats.diet.toFixed(2)],
      ["Waste", liveStats.waste.toFixed(2)],
      ["Water", liveStats.water.toFixed(2)],
      ["Total", liveStats.total.toFixed(2)],
      ["Average India", average.india],
      ["Your Score", scoreInfo.label]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "carbon_footprint.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const getScoreInfo = (total) => {
    if (total < 50) return { label: 'Excellent', color: 'text-emerald-400', badge: '🏆 Eco Champion' };
    if (total < 100) return { label: 'Average', color: 'text-yellow-400', badge: '🌱 Green Warrior' };
    if (total < 200) return { label: 'Above Average', color: 'text-orange-400', badge: '⚡ Average Joe' };
    return { label: 'High Impact', color: 'text-red-400', badge: '🏭 High Emitter' };
  };

  const scoreInfo = getScoreInfo(liveStats.total);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* LEFT COLUMN — Input Form */}
          <div className="w-full lg:w-[45%] space-y-8">
            <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700 shadow-2xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="text-4xl">🌍</div>
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">Calculate Your Carbon Footprint</h1>
              </div>

              <div className="space-y-12">
                {/* Section 1 — Transport */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🚗</span>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Section 1: Transport</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Distance per month (km)</label>
                      <input
                        type="number"
                        name="km_travelled"
                        value={formData.km_travelled}
                        onChange={handleInputChange}
                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Transport Type</label>
                      <select
                        name="transport_type"
                        value={formData.transport_type}
                        onChange={handleInputChange}
                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="car_petrol">Car (Petrol) — 0.21 kg CO₂</option>
                        <option value="car_diesel">Car (Diesel) — 0.17 kg CO₂</option>
                        <option value="motorcycle">Motorcycle — 0.11 kg CO₂</option>
                        <option value="bus">Bus — 0.089 kg CO₂</option>
                        <option value="train">Train — 0.041 kg CO₂</option>
                        <option value="auto">Auto Rickshaw — 0.13 kg CO₂</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 p-2 rounded-lg inline-block">
                    Est. transport emission: {liveStats.transport.toFixed(1)} kg CO₂/month
                  </div>
                </div>

                {/* Section 2 — Home Energy */}
                <div className="space-y-6 pt-8 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Section 2: Home Energy</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monthly Electricity (kWh)</label>
                      <input
                        type="number"
                        name="electricity_kwh"
                        value={formData.electricity_kwh}
                        onChange={handleInputChange}
                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="India grid factor applied"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cooking Fuel</label>
                        <select
                          name="cooking_fuel"
                          value={formData.cooking_fuel}
                          onChange={handleInputChange}
                          className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white"
                        >
                          <option value="lpg">LPG (0.21 kg/hr)</option>
                          <option value="png">PNG (0.18 kg/hr)</option>
                          <option value="electric_cook">Electric (0)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cooking Hrs/Day</label>
                        <input
                          type="number"
                          name="cooking_hours"
                          value={formData.cooking_hours}
                          onChange={handleInputChange}
                          className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 p-2 rounded-lg inline-block">
                    Est. energy emission: {liveStats.energy.toFixed(1)} kg CO₂/month
                  </div>
                </div>

                {/* Section 3 — Diet */}
                <div className="space-y-6 pt-8 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🍽️</span>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Section 3: Diet Preference</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'vegan', name: 'Vegan', icon: '🥗', val: '1.5' },
                      { id: 'vegetarian', name: 'Vegetarian', icon: '🥬', val: '2.5' },
                      { id: 'non_veg_occ', name: 'Occasional', icon: '🍗', val: '3.8' },
                      { id: 'non_veg_daily', name: 'Daily Meat', icon: '🥩', val: '5.5' },
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setFormData(p => ({ ...p, diet_type: type.id }))}
                        className={`p-4 rounded-2xl border transition-all text-left ${formData.diet_type === type.id ? 'bg-blue-600/20 border-blue-500' : 'bg-[#1f2937] border-gray-700'
                          }`}
                      >
                        <div className="text-2xl mb-2">{type.icon}</div>
                        <div className="text-xs font-black text-white uppercase">{type.name}</div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase mt-1">{type.val} kg/day</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 4 — Waste */}
                <div className="space-y-6 pt-8 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🗑️</span>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Section 4: Waste</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Waste per week (kg)</label>
                      <input
                        type="number"
                        name="waste_kg"
                        value={formData.waste_kg}
                        onChange={handleInputChange}
                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        <span>Recycling %</span>
                        <span className="text-white">{formData.recycling_percent}%</span>
                      </label>
                      <input
                        type="range"
                        name="recycling_percent"
                        min="0"
                        max="100"
                        value={formData.recycling_percent}
                        onChange={handleInputChange}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 p-2 rounded-lg inline-block">
                    Est. waste emission: {liveStats.waste.toFixed(1)} kg CO₂
                  </div>
                </div>

                {/* Section 5 — Water */}
                <div className="space-y-6 pt-8 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💧</span>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Section 5: Water</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Daily water use (litres)</label>
                      <input
                        type="number"
                        name="water_litres"
                        value={formData.water_litres}
                        onChange={handleInputChange}
                        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 p-2 rounded-lg inline-block">
                    Est. water emission: {liveStats.water.toFixed(1)} kg CO₂
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/30 hover:bg-blue-500 transition-all"
                >
                  {loading ? 'Processing...' : 'Sync with Database'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Results Dashboard */}
          <div className="w-full lg:w-[55%] space-y-8">
            {/* Result Hero */}
            <div className="bg-[#111827] rounded-[2rem] p-10 border border-gray-700 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                <div className="text-center md:text-left">
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Total Impact Analysis</div>
                  <div className={`text-6xl font-black tabular-nums transition-all ${scoreInfo.color}`}>
                    {liveStats.total.toFixed(1)}
                  </div>
                  <div className="text-gray-400 font-bold uppercase text-xs tracking-widest mt-2">kg CO₂ / Monthly Emission</div>
                </div>
                <div className="text-center">
                  <div className={`px-6 py-2 rounded-full border text-xs font-black uppercase tracking-widest mb-4 bg-gray-800/50 ${scoreInfo.color.replace('text', 'border')}`}>
                    {scoreInfo.label}
                  </div>
                  <div className="text-4xl">{scoreInfo.badge.split(' ')[0]}</div>
                  <div className="text-[9px] font-black text-white uppercase tracking-widest mt-2">{scoreInfo.badge.split(' ').slice(1).join(' ')}</div>
                </div>
              </div>

              {/* Donut Chart */}
              <div className="h-64 mt-12 bg-[#0a0f1e]/50 rounded-[2rem] p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Transport', value: liveStats.transport },
                        { name: 'Energy', value: liveStats.energy },
                        { name: 'Diet', value: liveStats.diet },
                        { name: 'Waste', value: liveStats.waste },
                        { name: 'Water', value: liveStats.water },
                      ]}
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={10}
                      dataKey="value"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Goal Tracker */}
            <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">🎯 Goal Tracker</h3>
                <div className="flex items-center gap-4 bg-[#1f2937] px-4 py-2 rounded-xl">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Set Target:</span>
                  <input
                    type="range" min="20" max="250"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(parseInt(e.target.value))}
                    className="w-32 accent-blue-500"
                  />
                  <span className="text-sm font-black text-white">{monthlyTarget}kg</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-700">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${liveStats.total > monthlyTarget ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`}
                    style={{ width: `${Math.min((liveStats.total / monthlyTarget) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                  {liveStats.total <= monthlyTarget ? (
                    <span className="text-emerald-400">🎯 You're hitting your goal!</span>
                  ) : (
                    <span className="text-red-400">⚠️ {(liveStats.total - monthlyTarget).toFixed(1)}kg above target</span>
                  )}
                  <span className="text-gray-500">Utilization: {Math.round((liveStats.total / monthlyTarget) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Comparison & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Global Comparative</h3>
                <div className="space-y-6">
                  {[
                    { label: 'Your Footprint', val: liveStats.total, color: 'bg-blue-500', max: 400 },
                    { label: 'India Average', val: 112, color: 'bg-gray-700', max: 400 },
                    { label: 'World Average', val: 375, color: 'bg-gray-700', max: 400 },
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                        <span>{item.label}</span>
                        <span className="text-white">{item.val}kg</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.val / item.max) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Actionable Insights</h3>
                <div className="space-y-4">
                  {liveStats.transport > liveStats.energy && liveStats.transport > liveStats.diet ? (
                    <div className="p-3 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-xl">
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Transport Tip</div>
                      <p className="text-[11px] text-gray-300 leading-relaxed font-medium">Switch to metro/bus 3 days/week to save ~{(liveStats.transport * 0.4).toFixed(1)} kg CO₂</p>
                    </div>
                  ) : liveStats.energy > liveStats.diet ? (
                    <div className="p-3 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-xl">
                      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Energy Saving</div>
                      <p className="text-[11px] text-gray-300 leading-relaxed font-medium">Use LED bulbs and optimize AC to reduce energy by 15%</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-orange-500/10 border-l-4 border-orange-500 rounded-r-xl">
                      <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Dietary Shift</div>
                      <p className="text-[11px] text-gray-300 leading-relaxed font-medium">One meat-free day per week saves ~22 kg CO₂/month</p>
                    </div>
                  )}
                  <div className="p-3 bg-gray-800/30 border-l-4 border-gray-600 rounded-r-xl">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Eco Recommendation</div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Consider tree plantation to offset {(liveStats.total / 20).toFixed(1)} months of impact.</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Weekly Trend Bar Chart */}
            <div className="bg-[#111827] rounded-[2rem] p-8 border border-gray-700">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Weekly Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}kg`} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      cursor={{ fill: '#1f2937' }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleDownloadCSV}
                className="flex-1 bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 rounded-2xl py-4 font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>📊</span> Download as CSV
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex-1 bg-purple-600/20 border border-purple-500/50 text-purple-400 rounded-2xl py-4 font-black uppercase tracking-widest text-[10px] hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>📄</span> Download as PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
