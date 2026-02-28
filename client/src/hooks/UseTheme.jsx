// src/hooks/useTheme.jsx
import { useContext, useEffect } from "react";
import { ThemeContext } from "../context/ThemeContext";

const useTheme = () => {
  const { theme, setTheme } = useContext(ThemeContext);

  // Toggle between 'light' and 'dark'
  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", newTheme);
      return newTheme;
    });
  };

  // Load theme from localStorage on first mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) setTheme(stored);
  }, [setTheme]);

  return { theme, toggleTheme };
};

export default useTheme;
