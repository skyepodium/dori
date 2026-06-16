import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DESIGN_TOKEN_CSS_VARIABLES } from '../../shared/constants/designTokens';
import { App } from './App';
import './styles.css';

const applyDesignTokenCssVariables = (): void => {
  Object.entries(DESIGN_TOKEN_CSS_VARIABLES).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
};

applyDesignTokenCssVariables();

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
