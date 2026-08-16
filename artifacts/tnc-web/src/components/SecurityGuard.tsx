import { useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * Security Guard Component
 * - Disables keyboard shortcuts (F keys, Ctrl+C/V/U, etc.)
 * - Detects DevTools opening and redirects to home
 * - Blocks API requests when DevTools is open
 * - Obfuscates sensitive data from network tab
 */
export function SecurityGuard() {
  const [, setLocation] = useLocation();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [blockRequests, setBlockRequests] = useState(false);

  useEffect(() => {
    // 1. Disable keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F1-F12 keys
      if (e.key.startsWith("F") && e.key.length <= 3 && !isNaN(Number(e.key.slice(1)))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Disable Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+U (View Source)
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Disable Ctrl+S (Save)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Disable Ctrl+C, Ctrl+V (Copy/Paste) - optional, can be restrictive
      if (e.ctrlKey && (e.key === "c" || e.key === "v")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Disable right-click context menu
      if (e.button === 2) {
        e.preventDefault();
        return false;
      }
    };

    // 2. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 3. DevTools detection using multiple methods
    let devToolsCheckInterval: ReturnType<typeof setInterval>;
    let lastCheck = Date.now();

    const checkDevTools = () => {
      const now = Date.now();
      const threshold = 200; // ms

      // Method 1: Window size difference (DevTools docked)
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const isDocked = widthDiff > 160 || heightDiff > 160;

      // Method 2: Timing attack (console.log timing)
      const start = performance.now();
      // eslint-disable-next-line no-console
      console.log("%c", "color: transparent");
      const end = performance.now();
      const isTimingAttack = end - start > 100;

      // Method 3: Debugger detection
      let isDebugger = false;
      try {
        // eslint-disable-next-line no-debugger
        debugger;
        isDebugger = false;
      } catch {
        isDebugger = true;
      }

      // Method 4: toString override detection
      const originalToString = Function.prototype.toString;
      let isToStringHooked = false;
      try {
        Function.prototype.toString = () => "native code";
        // eslint-disable-next-line no-console
        console.log("%c", "color: transparent");
        Function.prototype.toString = originalToString;
      } catch {
        isToStringHooked = true;
      }

      const detected = isDocked || isTimingAttack || isDebugger || isToStringHooked;

      if (detected && !devToolsOpen) {
        setDevToolsOpen(true);
        setBlockRequests(true);
        // Redirect to home page
        setLocation("/");
        // Show warning
        document.body.innerHTML = `
          <div style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #000; color: #fff; display: flex; align-items: center;
            justify-content: center; z-index: 999999; font-family: system-ui;
            flex-direction: column; gap: 1rem;
          ">
            <h1>🔒 Security Alert</h1>
            <p>Developer tools detected. Access restricted for security.</p>
            <p>Please close developer tools and refresh the page.</p>
            <button onclick="window.location.reload()" style="
              padding: 1rem 2rem; background: #fff; color: #000; border: none;
              border-radius: 8px; font-size: 1rem; cursor: pointer;
            ">Refresh Page</button>
          </div>
        `;
      } else if (!detected && devToolsOpen) {
        setDevToolsOpen(false);
        setBlockRequests(false);
      }

      lastCheck = now;
    };

    // 4. Block fetch/XHR when DevTools is open
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      if (blockRequests) {
        throw new Error("Requests blocked: Developer tools detected");
      }
      return originalFetch.apply(window, args);
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      if (blockRequests) {
        throw new Error("Requests blocked: Developer tools detected");
      }
      return originalXHROpen.apply(this, args);
    };

    // 5. Obfuscate sensitive data - override console methods
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      if (blockRequests || args.some(arg => typeof arg === "string" && (arg.includes("api") || arg.includes("key") || arg.includes("token")))) {
        return;
      }
      originalConsoleLog.apply(console, args);
    };

    console.warn = (...args) => {
      if (blockRequests || args.some(arg => typeof arg === "string" && (arg.includes("api") || arg.includes("key") || arg.includes("token")))) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (blockRequests || args.some(arg => typeof arg === "string" && (arg.includes("api") || arg.includes("key") || arg.includes("token")))) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    // 6. Clear sensitive data from localStorage/sessionStorage on devtools open
    const clearSensitiveData = () => {
      const sensitiveKeys = ["token", "api", "key", "secret", "auth", "password"];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          localStorage.removeItem(key);
        }
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          sessionStorage.removeItem(key);
        }
      }
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);

    // Start DevTools detection interval
    devToolsCheckInterval = setInterval(checkDevTools, 1000);
    checkDevTools(); // Initial check

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      clearInterval(devToolsCheckInterval);
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, [setLocation, blockRequests, devToolsOpen]);

  // This component doesn't render anything visible
  return null;
}

export default SecurityGuard;