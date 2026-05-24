'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { registerUser } from './api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Sync with our PostgreSQL DB
      try {
        await registerUser({
          firebase_uid: result.user.uid,
          email: result.user.email,
          display_name: result.user.displayName || result.user.email.split('@')[0],
        });
      } catch (dbError) {
        console.warn('User already exists in database:', dbError.message);
      }
      
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password, name) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Sync with our PostgreSQL DB
      await registerUser({
        firebase_uid: result.user.uid,
        email: result.user.email,
        display_name: name || result.user.email.split('@')[0],
      });
      
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  return {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    register,
  };
}
