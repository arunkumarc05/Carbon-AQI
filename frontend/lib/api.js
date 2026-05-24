import axios from 'axios';
import { auth } from './firebase';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Firebase JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;

      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
        console.log('JWT Token attached to request:', config.url);
      } else {
        console.log('No user found, no token attached for:', config.url);
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — retry once with a fresh token on 401, then pass through
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && !error.config._retry) {
      error.config._retry = true;
      try {
        const user = auth.currentUser;
        if (user) {
          const freshToken = await user.getIdToken(true); // force refresh
          error.config.headers.Authorization = `Bearer ${freshToken}`;
          return api(error.config);
        }
      } catch (refreshErr) {
        console.warn('Token refresh failed:', refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

// AQI API functions
export const recordAQI = async (data) => {
  try {
    const response = await api.post('/aqi/record', data);
    return response.data;
  } catch (error) {
    console.error('Error recording AQI:', error);
    throw error;
  }
};

export const getCityAQI = async (cityId) => {
  try {
    const response = await api.get(`/aqi/city/${cityId}`);
    return response.data; // returns array of records
  } catch (error) {
    console.error('Error getting city AQI:', error);
    throw error;
  }
};

// Returns a single latest record object (used by AQI page)
export const getCityAQILatest = async (cityId) => {
  try {
    const response = await api.get(`/aqi/city/${cityId}/latest`);
    return response.data;
  } catch (error) {
    console.error('Error getting latest city AQI:', error);
    throw error;
  }
};

export const getStrategy = async (recordId) => {
  try {
    const response = await api.get(`/strategy/strategies/${recordId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting RL strategy:', error);
    return null;
  }
};

export const getAllCitiesAQI = async () => {
  try {
    const response = await api.get('/aqi/cities');
    return response.data;
  } catch (error) {
    console.error('Error getting all cities AQI:', error);
    throw error;
  }
};

export const getSmartAnalysis = async (cityId) => {
  try {
    const response = await api.get(`/predict/smart-analysis/${cityId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting smart analysis:', error);
    throw error;
  }
};

// Carbon API functions
export const calculateCarbon = async (data) => {
  try {
    // Map frontend field names to what the backend expects
    const payload = {
      transport_km: parseFloat(data.km_travelled) || 0,
      transport_type: data.transport_type,
      energy_kwh: parseFloat(data.electricity_kwh) || 0,
      diet_type: data.diet_type,
    };
    const response = await api.post('/carbon/calculate', payload);
    // Map backend response field names to what the frontend uses
    const d = response.data;
    return {
      ...d,
      transport_footprint: d.transport_emission,
      electricity_footprint: d.energy_emission,
      diet_footprint: d.diet_emission,
      total_footprint: d.total_emission,
    };
  } catch (error) {
    console.error('Error calculating carbon:', error);
    throw error;
  }
};

export const getCarbonHistory = async () => {
  try {
    const response = await api.get('/carbon/history');
    // Map total_emission -> total_footprint for frontend charts
    return response.data.map(item => ({
      ...item,
      total_footprint: item.total_emission,
    }));
  } catch (error) {
    console.error('Error getting carbon history:', error);
    throw error;
  }
};

export const getCarbonAverage = async () => {
  try {
    const response = await api.get('/carbon/average');
    const d = response.data;
    // Map average_monthly_emission_kg -> average_footprint for frontend
    return {
      ...d,
      average_footprint: d.average_monthly_emission_kg,
    };
  } catch (error) {
    console.error('Error getting carbon average:', error);
    throw error;
  }
};

// Cities API functions
export const getCities = async () => {
  try {
    const response = await api.get('/cities/list');
    // Map backend city_name to name for frontend consistency
    return response.data.map(city => ({
      ...city,
      name: city.city_name,
      id: city.city_id
    }));
  } catch (error) {
    console.error('Error getting cities:', error);
    throw error;
  }
};

export const getCityHistoryByName = async (cityName, days = 7) => {
  try {
    const response = await api.get(`/aqi/history_by_name/${cityName}`, {
      params: { days }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting city history:', error);
    throw error;
  }
};

export const compareCities = async (city1Id, city2Id) => {
  try {
    const response = await api.get('/cities/compare', {
      params: {
        city1_id: city1Id,
        city2_id: city2Id,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error comparing cities:', error);
    throw error;
  }
};

// Chatbot API functions
export const sendChatMessage = async (message, language) => {
  try {
    const response = await api.post('/chatbot/message', {
      message,
      language,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
};

// Feedback API functions
export const submitFeedback = async (data) => {
  try {
    const response = await api.post('/feedback/submit', data);
    return response.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};

export const getMyFeedback = async () => {
  try {
    const response = await api.get('/feedback/my');
    return response.data;
  } catch (error) {
    console.error('Error getting feedback:', error);
    throw error;
  }
};

// Translation API functions
export const getTranslations = async (langCode) => {
  try {
    const response = await api.get(`/translation/${langCode}`);
    return response.data;
  } catch (error) {
    console.error('Error getting translations:', error);
    throw error;
  }
};

// Leaderboard API functions
export const getLeaderboard = async () => {
  try {
    const response = await api.get('/leaderboard/');
    return response.data;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
};

// Auth API functions
export const registerUser = async (data) => {
  try {
    const response = await api.post('/auth/register', data);
    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

export const getMe = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
};

export default api;
