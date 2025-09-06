import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'remixicon/fonts/remixicon.css';
import App from './App.jsx';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
      <App />
    </GoogleReCaptchaProvider>
  </StrictMode>
);