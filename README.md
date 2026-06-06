# ProximaX — Consent-Based Real-Time Location Radar

ProximaX is a consent-based geolocation tracking web application featuring a military-grade retro-cyber radar HUD interface, real-time sync via Firebase Realtime Database, proximity tracking using geodesic (Haversine) computations, AI-assisted tactical reports, and push notifications via the Web Push API.

---

## 🚀 Core Features

1. **Radar Dashboard**: Multi-layered SVG concentric alert bounds with animated sweep scan.
2. **Proximity Alerts**: Client-side geodesic distance threshold triggers real-time visual banners and background OS push notifications.
3. **Session-Only Movement Trails**: Live client-side trail history of the last 20 peer coordinates using opacity-scaled (10% to 100%) and size-scaled (30% to 100%) dots with a HUD toggle.
4. **Density Heatmap Overlay**: Identifies clusters of 3+ peers within 100m, rendering a density-scaled midpoint circle with a HUD toggle.
5. **AI Sitrep Analyst**: Generates real-time tactical intelligence summaries and anomaly flags every 30 seconds using Google Gemini API.
6. **Natural Language Command Bar**: Controls the radar panel (focus peer, broadcast message, set alert radius) using natural language command interpretation.
7. **SOS Emergency Triage**: Broadcasts priority push alerts to all room members and triggers an AI disaster response plan when a peer signals emergency SOS.
8. **No App Installs**: Works entirely in standard mobile/desktop browsers using `navigator.geolocation.watchPosition` (PWA support included).

---

## 🛠️ Technical Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS (custom colors and animations)
- **Real-Time Data**: Firebase Realtime Database
- **Geographic Utilities**: Leaflet.js + React-Leaflet
- **AI Engine**: Google Gemini AI (`gemini-1.5-flash`)
- **Push Services**: Service Workers + `web-push` (VAPID)

---

## 📦 Setup & Local Installation

### 1. Clone & Install Dependencies
First, install the packages. Make sure to use `--legacy-peer-deps` to handle standard React-Leaflet peer overrides:
```bash
npm install --legacy-peer-deps
```

### 2. Configure Firebase Realtime Database
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Under "Build", click **Realtime Database** and click **Create Database**.
3. Select your database location and start in **Locked Mode**.
4. Go to the **Rules** tab and paste the security rules located in `firebase.rules.json`:
   ```json
   {
     "rules": {
       ".read": false,
       ".write": false,
       "rooms": {
         "$code": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
5. Go to **Project Settings** (gear icon) -> **General** -> scroll down to "Your apps" and add a **Web App**. Copy the config object containing API Keys and Database URL.

### 3. Generate VAPID Keys for Push Notifications
Run the following command to generate the required VAPID public/private key pair:
```bash
npx web-push generate-vapid-keys
```
Save the generated keys for the environment configuration.

### 4. Setup Environment Variables
Create a file named `.env.local` in the root of the project:
```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com/
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Web Push Configuration (VAPID)
VAPID_PUBLIC_KEY=your_generated_vapid_public_key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_generated_vapid_public_key
VAPID_PRIVATE_KEY=your_generated_vapid_private_key
VAPID_MAILTO=mailto:admin@yourdomain.com

# Cleanup Room Secret (API protection)
CLEANUP_SECRET=your_secure_cleanup_token

# Google Gemini AI API Configuration
GEMINI_API_KEY=your_google_gemini_api_key
```
*Note: We expose the public key to the browser client with the `NEXT_PUBLIC_` prefix so the client can initialize the subscription object.*

---

## 📡 API Routes

### 1. `POST /api/ai-analyst`
* Every 30 seconds, sends peers coordinates + admin coordinates + alert radius to Google Gemini.
* Returns situation summaries, anomaly logs, and dynamic threat levels (`LOW`, `MEDIUM`, `HIGH`).

### 2. `POST /api/ai-command`
* Accepts natural language command strings (e.g. `"zoom on Bob"`, `"set alert radius to 200 meters"`).
* Returns interpreted structured actions (`FOCUS_PEER`, `SET_RADIUS`, `BROADCAST_MESSAGE`) to control the radar HUD.

### 3. `POST /api/ai-sos-triage`
* Evaluates active coordinates when an SOS trigger occurs.
* Computes the nearest peer to the emergency coordinate and produces an instant disaster triage plan.

### 4. `POST /api/cleanup-rooms`
* Checks all active database rooms.
* Deletes any room where `meta.lastActivity` is older than 24 hours.
* **Security**: Must pass `Authorization: <CLEANUP_SECRET>` header.

---

## 💻 Running Locally

1. Start the Next.js development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` to access the application.

### Mobile & Push Testing
- **Service Worker / Push API**: Requires `localhost` or an HTTPS connection to register service workers.
- **Mobile Testing**: To test the location share link on a physical mobile device, run a local tunnel like `ngrok`:
  ```bash
  ngrok http 3000
  ```

---

## ☁️ Vercel Deployment

When deploying to Vercel, make sure to add all variables listed in your `.env.local` to **Settings** -> **Environment Variables** in the Vercel dashboard.
