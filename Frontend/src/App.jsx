// Chooses between login and authenticated dashboard views while persisting session state.
import { useCallback, useEffect, useState } from "react";
import HomeView from "./views/HomeView";
import LoginView from "./views/LoginView";

const SAVED_USER_KEY = "league-companion-active-user";

function loadSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_USER_KEY));
  } catch {
    return null;
  }
}

function App() {
  const [activeUser, setActiveUser] = useState(null);

  useEffect(() => {
    const savedUser = loadSavedUser();

    if (savedUser) {
      setActiveUser(savedUser);
    }
  }, []);

  const handleAuthenticated = useCallback((user) => {
    localStorage.setItem(SAVED_USER_KEY, JSON.stringify(user));
    setActiveUser(user);
  }, []);

  const handleUserUpdated = useCallback((user) => {
    localStorage.setItem(SAVED_USER_KEY, JSON.stringify(user));
    setActiveUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(SAVED_USER_KEY);
    setActiveUser(null);
  }, []);

  if (activeUser) {
    return (
      <HomeView
        onLogout={handleLogout}
        onUserUpdated={handleUserUpdated}
        user={activeUser}
      />
    );
  }

  return <LoginView onAuthenticated={handleAuthenticated} />;
}

export default App;
