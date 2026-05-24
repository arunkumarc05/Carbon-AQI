'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { submitFeedback, getMyFeedback } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { IoStar, IoStarOutline, IoSend, IoFolderOpenOutline, IoCheckmarkCircle } from 'react-icons/io5';
import { HiOutlineChatAlt2 } from 'react-icons/hi';

export default function FeedbackPage() {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'general',
    rating: 0,
  });
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const auth = getAuth();

  const categories = [
    { value: 'general', label: 'General Feedback' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'aqi', label: 'AQI Data Issue' },
    { value: 'carbon', label: 'Carbon Calculator' },
    { value: 'ui', label: 'User Interface' },
  ];

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    in_review: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
      }
    });
    return unsubscribe;
  }, [auth, router]);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        if (!auth.currentUser) return;
        const data = await getMyFeedback();
        // data comes back with feedback_id, subject, status, created_at
        // API doesn't store category/rating/message in the My list so we adapt it.
        const mapped = data.map(item => ({
          id: item.feedback_id,
          subject: item.subject,
          message: item.message || 'No description provided',
          category: 'general',
          status: item.status,
          created_at: new Date(item.created_at),
          response: null,
          rating: 0
        }));
        setSubmissions(mapped);
      } catch (error) {
        console.error('Failed to load feedback', error);
      }
    };
    
    if (auth.currentUser) {
      fetchFeedback();
    } else {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) fetchFeedback();
      });
      return () => unsubscribe && unsubscribe();
    }
  }, [auth]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRating = (val) => {
    setFormData(prev => ({ ...prev, rating: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data = await submitFeedback(formData);

      const newSubmission = {
        id: data.id || Date.now(),
        subject: formData.subject,
        message: formData.message,
        category: formData.category,
        status: 'pending',
        created_at: new Date(),
        response: null,
        rating: formData.rating
      };

      setSubmissions(prev => [newSubmission, ...prev]);
      setFormData({ subject: '', message: '', category: 'general', rating: 0 });
      setSuccess('Feedback submitted successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (error) {
      setError('Failed to submit feedback');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white animate-fadeIn">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="mb-6 md:mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <HiOutlineChatAlt2 className="text-2xl text-blue-500" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase">Feedback Portal</h1>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px] ml-1">Help Us Improve Carbon AQI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 items-start">

          {/* Feedback Form */}
          <div className="bg-[#111827] rounded-2xl md:rounded-[2.5rem] shadow-2xl p-4 md:p-10 border border-gray-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>

            <h2 className="text-xl font-black text-white mb-10 flex items-center gap-3 uppercase tracking-tighter">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              Submit Feedback
            </h2>

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">

              {/* Star Rating Component */}
              <div className="p-6 bg-[#1f2937]/30 border border-gray-800 rounded-[2rem] text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Quality of Experience</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRating(star)}
                      className={`text-3xl transition-all duration-300 transform hover:scale-125 ${star <= formData.rating ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]' : 'text-gray-700 hover:text-gray-500'
                        }`}
                    >
                      {star <= formData.rating ? <IoStar /> : <IoStarOutline />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-3 uppercase tracking-widest ml-1">
                    Report Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3 bg-[#1f2937] border border-gray-700 rounded-2xl text-white font-bold focus:ring-2 focus:outline-none focus:ring-blue-500/50 appearance-none cursor-pointer"
                    style={{ colorScheme:'dark' }}
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value} className="bg-gray-800 text-white">
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-3 uppercase tracking-widest ml-1">
                    Primary Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    placeholder="Report header..."
                    className="w-full px-5 py-3 bg-[#1f2937] border border-gray-700 rounded-2xl text-white font-medium focus:ring-2 focus:outline-none focus:ring-blue-500/50 placeholder-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 mb-3 uppercase tracking-widest ml-1">
                  Description
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={5}
                  placeholder="Provide comprehensive details about your findings..."
                  className="w-full px-5 py-4 bg-[#1f2937] border border-gray-700 rounded-3xl text-white font-medium focus:ring-2 focus:outline-none focus:ring-blue-500/50 placeholder-gray-600 resize-none leading-relaxed"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                  ⚠️ Validation Error: {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <IoCheckmarkCircle className="text-lg" /> {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[1.5rem] px-4 py-5 font-black uppercase tracking-[0.2em] text-xs hover:from-blue-500 hover:to-indigo-600 transition-all disabled:opacity-50 shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 group"
              >
                {loading ? 'Submitting...' : (
                  <>
                    Submit Feedback
                    <IoSend className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Past Submissions */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                Past Submissions
              </h2>
              <div className="bg-[#111827] px-3 py-1 rounded-full border border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                {submissions.length} Records
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="bg-[#111827] rounded-[2.5rem] p-20 text-center border border-dashed border-gray-800 shadow-inner">
                <IoFolderOpenOutline className="text-5xl text-gray-800 mx-auto mb-6" />
                <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">No Feedback Yet</p>
                <p className="text-[11px] text-gray-700 mt-2 uppercase">Submit a report to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {submissions.map((submission) => (
                  <div key={submission.id} className="bg-[#111827] border border-gray-800 rounded-[2rem] p-8 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-black text-white text-lg tracking-tight uppercase">{submission.subject}</h3>
                          <div className="flex text-yellow-500 text-xs">
                            {[...Array(5)].map((_, i) => (
                              i < (submission.rating || 0) ? <IoStar key={i} /> : <IoStarOutline key={i} className="text-gray-800" />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded-md">
                            {categories.find(c => c.value === submission.category)?.label}
                          </span>
                          <span className="text-gray-800">•</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">
                            {formatDate(submission.created_at)}
                          </span>
                        </div>
                      </div>
                      <span className={`inline-block px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg ${statusColors[submission.status]}`}>
                        {submission.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mb-6 leading-relaxed font-medium">
                      {submission.message}
                    </p>

                    {submission.response && (
                      <div className="bg-blue-500/5 border-l-4 border-blue-600 p-5 rounded-r-2xl">
                        <p className="text-[11px] text-blue-100 italic leading-relaxed">
                          <span className="font-black uppercase tracking-tighter mr-3 not-italic text-blue-400">Admin Response:</span>
                          "{submission.response}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System info Card */}
        <div className="mt-8 md:mt-16 bg-gradient-to-r from-blue-900/10 to-transparent border border-blue-500/20 rounded-2xl md:rounded-[2.5rem] p-4 md:p-10 flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="shrink-0 w-20 h-20 bg-blue-500/20 rounded-[2rem] flex items-center justify-center border border-blue-500/30">
            <HiOutlineChatAlt2 className="text-4xl text-blue-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Community Feedback Network</h3>
            <p className="text-gray-400 text-xs font-medium max-w-2xl leading-relaxed uppercase tracking-widest opacity-80">
              Your input helps us improve the platform. Every piece of feedback is reviewed by our team to maintain a high-quality environmental monitoring tool.
            </p>
          </div>
          <div className="md:ml-auto">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0a0f1e] bg-gray-800 flex items-center justify-center text-[10px] font-black">U{i}</div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#0a0f1e] bg-blue-600 flex items-center justify-center text-[10px] font-black">+2k</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
