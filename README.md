# ProximaX — Real-Time Location Radar & Proximity Push Alerts

ProximaX is a production-ready, consent-based geolocation tracking web application featuring a military-grade retro-cyber radar HUD interface, real-time sync via Firebase Realtime Database, proximity tracking using geodesic (Haversine) computations, and push notifications via the Web Push API.

## Core Features
1. **Radar Dashboard**: Multi-layered SVG concentric alert bounds with animated sweep scan.
2. **Proximity Alerts**: Client-side geodesic distance threshold triggers real-time visual banners and background OS push notifications.
3. **No App Installs**: Works entirely in standard mobile/desktop browsers using `navigator.geolocation.watchPosition`.
4. **Decentralized Rooms**: 6-character alphanumeric room codes allow immediate tracking without any authentication.
5. **Broadcaster Consent Node**: Live location sharing requires explicit consent and provides a "Stop Sharing" panic button.

---

## Technical Stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS (custom colors and animations)
- **Real-Time Data**: Firebase Realtime Database
- **Geographic Utilities**: Leaflet.js + React-Leaflet
- **Push Services**: Service Workers + `web-push` npm package (VAPID)

---

## Setup & Local Installation

### 1. Clone & Install Dependencies
First, install the packages. Make sure to use `--legacy-peer-deps` to handle standard React-Leaflet peer overrides:
```bash
npm install --legacy-peer-deps
```

### 2. Configure Firebase Realtime Database
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Under "Build", click **Realtime Database** and click **Create Database**.
3. Select your database location and start in **Locked Mode**.
4. Go to **Rules** tab and paste the security rules located in `firebase.rules.json`:
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
```
*Note: We expose the public key to the browser client with the `NEXT_PUBLIC_` prefix so the client can initialize the subscription object.*

---

## Running Locally

1. Start the Next.js development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` to access the application.

### Important: Testing Geolocation and Service Workers
- **Service Worker / Push API**: Requires `localhost` or an HTTPS connection to load and register service workers.
- **Mobile Testing**: To test the share link on a physical mobile device, run a local tunnel like `ngrok` or serve the development server over HTTPS on your local network:
  ```bash
  ngrok http 3000
  ```
  Open the HTTPS tunnel URL on both devices to test real-time GPS synchronization.
