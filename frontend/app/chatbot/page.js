'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { sendChatMessage } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { IoSend, IoPersonSharp, IoLanguageOutline } from 'react-icons/io5';
import { RiRobot2Fill } from 'react-icons/ri';
import { BsStars } from 'react-icons/bs';

export default function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const router = useRouter();
  const auth = getAuth();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'ta', name: 'தமிழ்' },
  ];

  const quickQuestions = [
    'What is AQI?',
    'How to reduce carbon footprint?',
    'Health effects of PM2.5?',
    'What is PM10?',
    'Best cities for air quality?',
    'What causes air pollution?',
    'Indoor air quality tips?',
    'Is the air safe today?',
  ];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return unsubscribe;
  }, [auth, router]);

  const getWelcomeMessage = (lang) => {
    const welcomes = {
      'en': 'Hello! I\'m your AQI assistant. I can answer questions about AQI levels, health advice, carbon footprint reduction, and PM2.5. How can I help you?',
      'hi': 'नमस्ते! मैं आपका AQI सहायक हूँ। मैं AQI स्तर, स्वास्थ्य सलाह, कार्बन फुटप्रिंट कमी और PM2.5 के बारे में सवालों का जवाब दे सकता हूँ। मैं आपकी कैसे मदद कर सकता हूँ?',
      'ta': 'வணக்கம்! நான் உங்கள் AQI உதவியாளர். AQI நிலைகள், ஆரோக்க ஆலோசனை, கார்பன் தடம் குறைப்பு மற்றும் PM2.5 பற்றிய கேள்விகளுக்கு நான் பதிலளிக்க முடியும். நான் உங்களுக்கு எப்படி உதவ முடியும்?',
      'bn': 'হ্যালো! আমি আপনার AQI সহকারী। AQI স্তর, স্বাস্থ্য পরামর্শ, কার্বন ফুটপ্রিন্ট হ্রাস এবং PM2.5 সম্পর্কে প্রশ্নের উত্তর দিতে পারি। আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
      'te': 'నమస్కారం! నేను మీ AQI సహాయకుడిని. AQI స్థాయిలు, ఆరోగ్య సలహా, కార్బన్ ఫుట్‌ప్రింట్ తగ్గింపు మరియు PM2.5 గురించి ప్రశ్నలకు సమాధానం ఇవ్వగలను. నేను మీకు ఎలా సహాయపడగలను?'
    };
    return welcomes[lang] || welcomes['en'];
  };

  useEffect(() => {
    setMessages([
      {
        id: 1,
        type: 'bot',
        text: getWelcomeMessage(selectedLanguage),
        timestamp: new Date(),
      }
    ]);
  }, [selectedLanguage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError('');

    try {
      const response = await sendChatMessage(messageText, selectedLanguage);

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.response || 'Sorry, I couldn\'t process your request. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setError('Failed to send message');
      console.error(error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: 'Sorry, I\'m having trouble connecting. Please try again later.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0f1e] text-white animate-fadeIn">
      <Navbar />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">

        {/* Chat Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BsStars className="text-xl text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none tracking-tight">Environmental AI</h1>

            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#111827] border border-gray-700 rounded-xl px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500">
            <IoLanguageOutline className="text-gray-400" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer uppercase tracking-tighter"
              style={{ color: 'white' }}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#1f2937]">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Questions */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 pb-2">
            {quickQuestions.map((q, idx) => (
              <button key={idx} onClick={() => handleSendMessage(q)} className="px-4 py-2 bg-[#1f2937] hover:bg-blue-600 border border-gray-700 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all h-9">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-[#111827] rounded-[2rem] border border-gray-700 overflow-hidden flex flex-col shadow-2xl relative">

          {/* Background Decorative */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar relative z-10">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-end gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${message.type === 'user' ? 'bg-blue-600' : 'bg-[#1f2937] border border-gray-700'
                  }`}>
                  {message.type === 'user' ? <IoPersonSharp className="text-sm" /> : <RiRobot2Fill className="text-lg text-blue-400" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] px-5 py-4 rounded-3xl ${message.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/10'
                  : 'bg-[#1f2937] text-gray-100 rounded-bl-none border border-gray-700 shadow-xl'
                  }`}>
                  <div className="text-sm leading-relaxed font-medium">{message.text}</div>
                  <div className={`text-[9px] mt-2 font-black uppercase tracking-[0.1em] opacity-50 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#1f2937] border border-gray-700 flex items-center justify-center shrink-0">
                  <RiRobot2Fill className="text-lg text-blue-400 animate-bounce" />
                </div>
                <div className="bg-[#1f2937] px-6 py-4 rounded-3xl rounded-bl-none border border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-[#0a0f1e]/40 border-t border-gray-800 relative z-20">
            {error && (
              <div className="mb-4 bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest animate-shake">
                Network Error: {error}
              </div>
            )}

            <div className="relative flex items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Synchronize with system AI..."
                disabled={loading}
                className="w-full pl-6 pr-16 py-4 bg-gray-800/80 border border-gray-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={loading || !inputMessage.trim()}
                className="absolute right-2 p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:bg-gray-700 disabled:opacity-50 active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <IoSend className="text-lg" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Footer info */}
        <div className="mt-4 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.4em]">Atmospheric Neural Network — Active Terminal</p>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
