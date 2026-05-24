'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getMe } from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [feedbackData, setFeedbackData] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    resolvedSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const auth = getAuth();

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    in_review: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  const categoryColors = {
    general: 'bg-gray-700 text-gray-300',
    bug: 'bg-red-900/40 text-red-300',
    feature: 'bg-purple-900/40 text-purple-300',
    aqi: 'bg-blue-900/40 text-blue-300',
    carbon: 'bg-emerald-900/40 text-emerald-300',
    ui: 'bg-yellow-900/40 text-yellow-300',
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        router.push('/');
      } else {
        checkAdminRole(currentUser);
      }
    });
    return unsubscribe;
  }, [auth, router]);

  const checkAdminRole = async (currentUser) => {
    try {
      const userData = await getMe();
      if (userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setUser(userData);
      fetchAdminData();
    } catch (error) {
      setError('Failed to verify admin access');
      router.push('/dashboard');
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // Mock data - replace with actual API calls
      const mockFeedback = [
        {
          id: 1,
          subject: 'Great app!',
          message: 'This application is very helpful for monitoring air quality.',
          category: 'general',
          status: 'pending',
          created_at: new Date('2024-01-20'),
          user_email: 'user1@example.com',
          user_name: 'John Doe',
          response: null
        },
        {
          id: 2,
          subject: 'AQI data accuracy issue',
          message: 'The AQI data for Delhi seems to be outdated by 2 days.',
          category: 'aqi',
          status: 'in_review',
          created_at: new Date('2024-01-19'),
          user_email: 'user2@example.com',
          user_name: 'Jane Smith',
          response: null
        },
        {
          id: 3,
          subject: 'Add more cities',
          message: 'Please add support for more tier-2 cities in India.',
          category: 'feature',
          status: 'resolved',
          created_at: new Date('2024-01-18'),
          user_email: 'user3@example.com',
          user_name: 'Mike Johnson',
          response: 'Thanks for the suggestion! We\'ll add more cities in the next update.'
        },
        {
          id: 4,
          subject: 'Carbon calculator bug',
          message: 'The carbon calculator gives wrong results for train transport.',
          category: 'bug',
          status: 'pending',
          created_at: new Date('2024-01-17'),
          user_email: 'user4@example.com',
          user_name: 'Sarah Wilson',
          response: null
        },
      ];

      setFeedbackData(mockFeedback);

      setStats({
        totalUsers: 1247,
        totalSubmissions: mockFeedback.length,
        pendingSubmissions: mockFeedback.filter(f => f.status === 'pending').length,
        resolvedSubmissions: mockFeedback.filter(f => f.status === 'resolved').length,
      });
    } catch (error) {
      setError('Failed to load admin data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (feedbackId, newStatus) => {
    try {
      setUpdating(true);

      // Mock API call - replace with actual API
      setFeedbackData(prev => prev.map(feedback =>
        feedback.id === feedbackId
          ? { ...feedback, status: newStatus, response: responseText || feedback.response }
          : feedback
      ));

      setSelectedFeedback(null);
      setResponseText('');

      // Update stats
      setStats(prev => ({
        ...prev,
        pendingSubmissions: newStatus === 'pending' ? prev.pendingSubmissions + 1 : prev.pendingSubmissions - 1,
        resolvedSubmissions: newStatus === 'resolved' ? prev.resolvedSubmissions + 1 : prev.resolvedSubmissions - 1,
      }));

    } catch (error) {
      setError('Failed to update feedback');
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-400 uppercase font-black tracking-widest text-xs">Loading Admin Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">Manage feedback and monitor system performance</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
          <div className="bg-[#111827] rounded-2xl shadow-xl p-4 md:p-6 border border-gray-700 hover:border-blue-500/50 transition-all">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500/10 rounded-xl p-3">
                <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-black text-white">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Users</div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] rounded-2xl shadow-xl p-4 md:p-6 border border-gray-700 hover:border-purple-500/50 transition-all">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500/10 rounded-xl p-3">
                <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v12H6V4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-black text-white">{stats.totalSubmissions}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Submissions</div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] rounded-2xl shadow-xl p-4 md:p-6 border border-gray-700 hover:border-yellow-500/50 transition-all">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500/10 rounded-xl p-3">
                <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-black text-white">{stats.pendingSubmissions}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pending Task</div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] rounded-2xl shadow-xl p-4 md:p-6 border border-gray-700 hover:border-emerald-500/50 transition-all">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-emerald-500/10 rounded-xl p-3">
                <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-black text-white">{stats.resolvedSubmissions}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resolved</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Table */}
        <div className="bg-[#111827] rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-800 bg-[#1f2937]/50">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Feedback Management</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-[#1f2937]">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    User Identity
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Request Details
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Class
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Control
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-gray-800">
                {feedbackData.map((feedback) => (
                  <tr key={feedback.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-bold text-white">{feedback.user_name}</div>
                        <div className="text-[11px] text-gray-500 font-medium">{feedback.user_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white font-bold">{feedback.subject}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs">{feedback.message}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${categoryColors[feedback.category]}`}>
                        {feedback.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${statusColors[feedback.status]}`}>
                        {feedback.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(feedback.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      <button
                        onClick={() => setSelectedFeedback(feedback)}
                        className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
                      >
                        View
                      </button>
                      {feedback.status !== 'resolved' && (
                        <button
                          onClick={() => handleStatusUpdate(feedback.id, 'resolved')}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feedback Detail Modal */}
        {selectedFeedback && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#111827] border border-gray-700 w-full max-w-2xl shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-[#1f2937]/50">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Feedback Details</h3>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Source User</label>
                    <p className="text-sm font-bold text-white">{selectedFeedback.user_name}</p>
                    <p className="text-[11px] text-gray-500">{selectedFeedback.user_email}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Subject</label>
                    <p className="text-sm font-bold text-white">{selectedFeedback.subject}</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Original Message</label>
                  <p className="text-gray-300 text-sm bg-[#1f2937] p-5 rounded-2xl border border-gray-700 leading-relaxed">{selectedFeedback.message}</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Admin Response</label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    className="w-full px-5 py-4 bg-[#1f2937] border border-gray-700 text-white rounded-2xl focus:ring-2 focus:ring-blue-500 placeholder-gray-600 text-sm"
                    placeholder="Input response message..."
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    className="px-6 py-2.5 border border-gray-700 rounded-xl text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:bg-gray-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'resolved')}
                    disabled={updating}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Save Resolution'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
