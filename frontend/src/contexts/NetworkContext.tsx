import React, { createContext, useContext, useEffect, useState } from 'react';

interface NetworkContextValue {
  isOnline: boolean;
  simulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  simulatedOffline: false,
  toggleSimulatedOffline: () => {},
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOnline = browserOnline && !simulatedOffline;

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        simulatedOffline,
        toggleSimulatedOffline: () => setSimulatedOffline((prev) => !prev),
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
