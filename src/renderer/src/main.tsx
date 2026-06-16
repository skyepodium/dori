import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DESIGN_TOKEN_CSS_VARIABLES } from '../../shared/constants/designTokens';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguage, translate, type Language } from './i18n';
import './styles.css';

const applyDesignTokenCssVariables = (): void => {
  Object.entries(DESIGN_TOKEN_CSS_VARIABLES).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
};

applyDesignTokenCssVariables();

const readRendererLanguage = (): Language => {
  try {
    const language = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    return isLanguage(language) ? language : DEFAULT_LANGUAGE;
  } catch (error: unknown) {
    return DEFAULT_LANGUAGE;
  }
};

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  const language = readRendererLanguage();

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary
        labels={{
          title: translate(language, 'errorRendererCrashed'),
          detail: translate(language, 'errorRendererCrashedDetail')
        }}
      >
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
