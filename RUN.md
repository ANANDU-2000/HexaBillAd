# How to Run HexaBill

## Why "Failed to load data" / ERR_CONNECTION_REFUSED?

The frontend talks to the API at **http://localhost:5000**. If you see `net::ERR_CONNECTION_REFUSED` or "Server connection unavailable", the **backend is not running**. Start it first (see below).

---

## 1. Start the backend (API)

From the project root:

```powershell
cd backend\HexaBill.Api
dotnet run
```

Or from anywhere:

```powershell
cd C:\Users\anand\Downloads\HexaBil-App\HexaBil-App\backend\HexaBill.Api
dotnet run
```

- API will be at **http://localhost:5000**
- Ensure PostgreSQL is running and connection string in `backend\HexaBill.Api\.env` (or `appsettings.Development.json`) is correct.

---

## 2. Start the frontend

In a **second** terminal:

```powershell
cd frontend\hexabill-ui
npm install
npm run dev
```

- App will be at **http://localhost:5173**
- Optional: create `frontend\hexabill-ui\.env` with `VITE_API_BASE_URL=http://localhost:5000/api` if you need to override the API URL.

---

## Summary

| Service   | Command              | URL                  |
|----------|----------------------|----------------------|
| Backend   | `dotnet run` in `backend\HexaBill.Api` | http://localhost:5000  |
| Frontend  | `npm run dev` in `frontend\hexabill-ui` | http://localhost:5173  |

Run **both**; then open http://localhost:5173 in your browser.
