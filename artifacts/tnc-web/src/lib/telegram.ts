export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  ready(): void;
  expand(): void;
  close(): void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  version: string;
  platform: string;
  MainButton: {
    text: string;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramUser(): TelegramUser | null {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

export function getTelegramInitData(): string | null {
  try {
    return window.Telegram?.WebApp?.initData ?? null;
  } catch {
    return null;
  }
}

export function isTelegramWebApp(): boolean {
  try {
    return !!(window.Telegram?.WebApp?.initData);
  } catch {
    return false;
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function expandTelegramApp(): void {
  try {
    window.Telegram?.WebApp?.expand();
  } catch {
    // not in Telegram
  }
}

export function readyTelegramApp(): void {
  try {
    window.Telegram?.WebApp?.ready();
  } catch {
    // not in Telegram
  }
}

export function openExternalLink(url: string): void {
  try {
    const tg = window.Telegram?.WebApp as (TelegramWebApp & { openLink?: (url: string) => void }) | undefined;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
