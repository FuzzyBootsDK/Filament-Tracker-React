import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const login = async (username, password) => {
    const u = await auth.login(username, password);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
