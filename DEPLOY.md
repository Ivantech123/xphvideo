# Deployment Guide: Velvet Cinema

This project is a React SPA built with Vite, designed to be deployed on **Netlify** with authentication handled by **Supabase**.

## 1. Prerequisites

- A [Netlify](https://www.netlify.com/) account.
- A [Supabase](https://supabase.com/) account.
- GitHub repository with this code.

## 2. Supabase Setup (Authentication)

1.  Create a new project on Supabase.
2.  Go to **Authentication** -> **Providers** and ensure **Email** is enabled.
3.  Go to **Project Settings** -> **API**.
4.  Copy the `Project URL` and `anon` / `public` API Key.

## 3. Netlify Deployment

1.  **Connect to GitHub**:
    *   Log in to Netlify.
    *   Click "Add new site" -> "Import from Git".
    *   Select your repository.

2.  **Build Settings**:
    *   **Base directory**: `/` (root)
    *   **Build command**: `npm run build`
    *   **Publish directory**: `dist`
    *   *(Note: The included `netlify.toml` file automatically handles these settings and SPA redirects).*

3.  **Environment Variables**:
    *   In Netlify Site Settings -> **Environment variables**, add the following:
        *   `VITE_SUPABASE_URL`: (Your Supabase Project URL)
        *   `VITE_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)

4.  **Deploy**:
    *   Click "Deploy site".

## 4. Admin Access

To access the Admin Dashboard:
1.  Sign up on the deployed site with the email: `abloko362@gmail.com`
2.  Once logged in, you will see the **Admin** shield icon in the sidebar.
3.  If you don't see it immediately, refresh the page.

## 5. Troubleshooting

*   **Page 404 on Refresh**: Ensure `netlify.toml` is present in the root. It handles the rewrite of `/*` to `/index.html`.
*   **Auth Errors**: Check that the Environment Variables are correctly set in Netlify.
*   **Video Loading Issues**: The app uses a public CORS proxy (`corsproxy.io`) to fetch content from Pornhub/XVideos. In a production environment, it is highly recommended to deploy your own proxy server to ensure reliability.

## 6. Features Overview

*   **Aggregation**: Live content from Pornhub, Eporner, and XVideos.
*   **Auth**: Real user management via Supabase.
*   **Localization**: Full Russian/English support.
*   **No Database Storage**: All video data is fetched live; no local metadata storage required.
