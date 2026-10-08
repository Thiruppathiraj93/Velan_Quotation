import React, { useEffect } from 'react';
import companyDetails from '../data/companyDetails';
import '../styles/splash.css';

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash">
      <img src={companyDetails.logo} alt="Velan Concast" className="splash-logo" />
    </div>
  );
}
