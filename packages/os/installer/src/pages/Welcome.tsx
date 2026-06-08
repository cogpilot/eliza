/**
 * Welcome page - Language and locale selection
 */

import type { Locale, KeyboardLayout } from '../backend/types';

interface WelcomeProps {
  locale: Locale;
  keyboard: KeyboardLayout;
  onLocaleChange: (locale: Locale) => void;
  onKeyboardChange: (keyboard: KeyboardLayout) => void;
  onNext: () => void;
}

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { value: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { value: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { value: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { value: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
];

const KEYBOARDS: { value: KeyboardLayout; label: string }[] = [
  { value: 'us', label: 'US English' },
  { value: 'gb', label: 'UK English' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'jp', label: 'Japanese' },
  { value: 'cn', label: 'Chinese' },
];

export function Welcome({
  locale,
  keyboard,
  onLocaleChange,
  onKeyboardChange,
  onNext,
}: WelcomeProps) {
  return (
    <div className="installer-page welcome-page">
      <div className="welcome-header">
        <div className="welcome-logo">
          <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" fill="#FF5800" />
            <path
              d="M30 50 L45 65 L70 35"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <h1>Welcome to elizaOS</h1>
        <p className="welcome-subtitle">
          Your personal AI operating system. Let's get you set up.
        </p>
      </div>

      <div className="settings-group">
        <label htmlFor="locale-select">Language</label>
        <select
          id="locale-select"
          value={locale}
          onChange={(e) => onLocaleChange(e.target.value as Locale)}
          className="installer-select"
        >
          {LOCALES.map(({ value, label, flag }) => (
            <option key={value} value={value}>
              {flag} {label}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-group">
        <label htmlFor="keyboard-select">Keyboard Layout</label>
        <select
          id="keyboard-select"
          value={keyboard}
          onChange={(e) => onKeyboardChange(e.target.value as KeyboardLayout)}
          className="installer-select"
        >
          {KEYBOARDS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="installer-actions">
        <button
          type="button"
          onClick={onNext}
          className="installer-button primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
