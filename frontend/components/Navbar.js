'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getTranslations } from '@/lib/api';
import { auth } from '@/lib/firebase';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [translations, setTranslations] = useState({});
  const [currentLang, setCurrentLang] = useState('en');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const primaryNavItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/aqi', label: 'AQI Monitor' },
    { href: '/carbon', label: 'Carbon Footprint' },
    { href: '/compare', label: 'Compare Cities' },
    { href: '/alerts', label: 'Alerts' },
    { href: '/chatbot', label: 'AI Assistant' },
    { href: '/feedback', label: 'Feedback' },
  ];

  const secondaryNavItems = [
    { href: '/journal', label: 'AQI Journal' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'ta', name: 'தமிழ்' },
  ];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    loadTranslations(currentLang);
  }, [currentLang]);

  const loadTranslations = async (langCode) => {
    try {
      const data = await getTranslations(langCode);
      setTranslations(data);
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  };

  const handleLanguageChange = (langCode) => {
    setCurrentLang(langCode);
    setLangDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (href) => pathname === href;

  return (
    <nav className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 mr-6 cursor-pointer" onClick={() => router.push('/')}>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Carbon AQI</h1>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1 ml-0 overflow-x-auto flex-1">
            {primaryNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
              >
                {translations[item.label] || item.label}
              </a>
            ))}

            {/* Always show these on large screens, hide on tablets/small laptops */}
            {secondaryNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`hidden lg:block whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
              >
                {translations[item.label] || item.label}
              </a>
            ))}

            {/* More Dropdown for secondary items on screens < 1024px */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span>{translations['More'] || 'More'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {moreDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
                  <div className="py-1">
                    {secondaryNavItems.map((item) => (
                      <button
                        key={item.href}
                        onClick={() => {
                          router.push(item.href);
                          setMoreDropdownOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-blue-600 ${isActive(item.href) ? 'bg-blue-600 text-white' : 'text-gray-300'
                          }`}
                      >
                        {translations[item.label] || item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: language + avatar */}
          <div className="ml-auto flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                style={{ color: 'white', backgroundColor: '#1f2937' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="hidden sm:inline">{languages.find(lang => lang.code === currentLang)?.name || 'English'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
                  <div className="py-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-blue-600 ${currentLang === lang.code ? 'bg-blue-600 text-white' : 'text-gray-300'
                          }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
                    <div className="py-1">
                      <div className="px-4 py-2 border-b border-gray-700">
                        <p className="text-sm font-medium text-white">{user.displayName || 'User'}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                      <button
                        onClick={() => router.push('/admin')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-blue-600 hover:text-white"
                      >
                        Admin Panel
                      </button>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-blue-600 hover:text-white"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hamburger Menu Button — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — toggled by hamburger */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {[...primaryNavItems, ...secondaryNavItems].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${isActive(item.href)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
                  }`}
              >
                {translations[item.label] || item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
