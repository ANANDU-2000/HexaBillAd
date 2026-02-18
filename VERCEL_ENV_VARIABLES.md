# Vercel Environment Variables Guide

## Required Environment Variables

### 1. **VITE_API_BASE_URL** (Required for Production)

**Value:** `https://hexabill.onrender.com/api`

**What it does:** Tells your frontend where to connect to your backend API.

**How to add:**
1. In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Click **"Add Environment Variable"**
3. **Key:** `VITE_API_BASE_URL`
4. **Value:** `https://hexabill.onrender.com/api`
5. **Environments:** Select all three:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
6. Click **Save**

---

## Optional Environment Variables

### 2. **VITE_SUPPORT_WHATSAPP** (Optional)

**Value:** Your WhatsApp number (e.g., `971501234567`)

**What it does:** Shows WhatsApp contact option in the Updates/Support page.

**How to add:**
- **Key:** `VITE_SUPPORT_WHATSAPP`
- **Value:** Your WhatsApp number (country code + number, no + or spaces)
- **Environments:** Production (or all if you want it in preview/dev too)

### 3. **VITE_SUPPORT_EMAIL** (Optional)

**Value:** Your support email (default: `support@hexabill.com`)

**What it does:** Shows support email in the Updates/Support page.

**How to add:**
- **Key:** `VITE_SUPPORT_EMAIL`
- **Value:** `support@hexabill.com` (or your custom email)
- **Environments:** Production (or all)

### 4. **VITE_GROQ_API_KEY** (Optional - for AI features)

**Value:** Your Groq API key from https://console.groq.com/

**What it does:** Enables AI-powered features (smart CSV mapping, insights, etc.)

**How to add:**
- **Key:** `VITE_GROQ_API_KEY`
- **Value:** Your Groq API key
- **Environments:** Production (or all)

### 5. **VITE_GEMINI_API_KEY** (Optional - for AI features)

**Value:** Your Google Gemini API key from https://aistudio.google.com/apikey

**What it does:** Alternative AI provider for smart features.

**How to add:**
- **Key:** `VITE_GEMINI_API_KEY`
- **Value:** Your Gemini API key
- **Environments:** Production (or all)

### 6. **VITE_HUGGINGFACE_TOKEN** (Optional - for AI features)

**Value:** Your HuggingFace token from https://huggingface.co/settings/tokens

**What it does:** Enables HuggingFace AI models.

**How to add:**
- **Key:** `VITE_HUGGINGFACE_TOKEN`
- **Value:** Your HuggingFace token
- **Environments:** Production (or all)

---

## Quick Steps to Add in Vercel

1. **Go to Vercel Dashboard** → Your Project (e.g., `hexa-bill-sw` or `hexabill-ui`)
2. **Click "Settings"** (left sidebar)
3. **Click "Environment Variables"**
4. **Click "Add Environment Variable"** (black button, top right)
5. **Fill in:**
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://hexabill.onrender.com/api`
   - **Environments:** Check all three (Production, Preview, Development)
6. **Click "Save"**
7. **Redeploy** your project (or wait for next auto-deploy) for changes to take effect

---

## Important Notes

- ✅ **VITE_API_BASE_URL** is **required** for production to work correctly
- ✅ After adding variables, you need to **redeploy** (or wait for next push) for them to take effect
- ✅ Variables starting with `VITE_` are exposed to the browser (safe for API URLs, but don't put secrets here)
- ✅ Never commit `.env` files with real API keys to Git
- ✅ For secrets (backend API keys, database URLs), use backend environment variables (Render), not Vercel

---

## Current Status Check

To see what environment variables are currently set:
1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Check the list - you should see `VITE_API_BASE_URL` if it's already added

If `VITE_API_BASE_URL` is missing or wrong, add/update it using the steps above.
