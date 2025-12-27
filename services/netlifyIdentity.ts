// Netlify Identity integration for velvet.run
// This provides authentication via Netlify's built-in identity service

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

export interface NetlifyUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
  app_metadata: {
    roles?: string[];
  };
  created_at: string;
}

let identityReady = false;
let currentUser: NetlifyUser | null = null;

// Initialize Netlify Identity widget
export function initNetlifyIdentity(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Check if already loaded
    if (window.netlifyIdentity) {
      window.netlifyIdentity.on('init', (user: NetlifyUser | null) => {
        currentUser = user;
        identityReady = true;
        resolve();
      });
      window.netlifyIdentity.init();
      return;
    }

    // Load Netlify Identity widget script
    const script = document.createElement('script');
    script.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    script.async = true;
    script.onload = () => {
      if (window.netlifyIdentity) {
        window.netlifyIdentity.on('init', (user: NetlifyUser | null) => {
          currentUser = user;
          identityReady = true;
          resolve();
        });
        window.netlifyIdentity.init();
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      console.warn('Failed to load Netlify Identity widget');
      resolve();
    };
    document.head.appendChild(script);
  });
}

// Open login modal
export function openLogin() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.open('login');
  }
}

// Open signup modal
export function openSignup() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.open('signup');
  }
}

// Logout
export function logout() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.logout();
    currentUser = null;
  }
}

// Get current user
export function getCurrentUser(): NetlifyUser | null {
  if (window.netlifyIdentity) {
    return window.netlifyIdentity.currentUser();
  }
  return currentUser;
}

// Check if user is logged in
export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

// Subscribe to auth state changes
export function onAuthStateChange(callback: (user: NetlifyUser | null) => void) {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.on('login', (user: NetlifyUser) => {
      currentUser = user;
      callback(user);
    });
    window.netlifyIdentity.on('logout', () => {
      currentUser = null;
      callback(null);
    });
  }
}

// Get user token for API calls
export async function getToken(): Promise<string | null> {
  const user = getCurrentUser();
  if (user && window.netlifyIdentity) {
    try {
      const token = await window.netlifyIdentity.currentUser()?.jwt();
      return token || null;
    } catch {
      return null;
    }
  }
  return null;
}
