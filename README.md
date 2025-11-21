# Kid Commute - Transportation Service Management System

> A comprehensive transportation management platform for student transportation services with real-time GPS tracking, route management, and mobile apps for iOS and Android.

## 🚀 Features

### For Administrators
- **Fleet Management**: Real-time vehicle tracking on interactive maps
- **Route Planning**: Create and manage routes with reusable stops
- **Driver Management**: Assign drivers, track attendance, manage shifts
- **Student Tracking**: Monitor student attendance and ride events
- **Analytics & Reporting**: Route health monitoring, audit logs, and operational insights
- **Payroll Integration**: BambooHR integration with automated overtime calculations
- **Incident Management**: Track and resolve incidents reported by drivers

### For Drivers
- **Mobile-First Interface**: Optimized for smartphones and tablets
- **Route Navigation**: Step-by-step route guidance with student lists
- **Attendance Tracking**: Mark students as riding/absent with board/deboard tracking
- **Vehicle Inspections**: Pre-trip and post-trip safety checklists
- **Messaging**: Direct communication with parents and dispatch
- **Time Management**: Clock in/out with automatic shift tracking

### For Parents
- **Real-Time Tracking**: Live GPS tracking of student's bus
- **ETA Updates**: Countdown to pickup with stop-by-stop progress
- **Notifications**: Push notifications for pickups, delays, and updates
- **Student Management**: View and update student information
- **Messaging**: Direct communication with drivers

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds and HMR
- **TailwindCSS** for styling
- **shadcn/ui** component library
- **TanStack Query** for data fetching
- **Wouter** for routing
- **Leaflet.js** for maps

### Backend
- **Node.js** with Express
- **TypeScript** with ESM
- **PostgreSQL** (Neon serverless)
- **Drizzle ORM** for type-safe database queries
- **Passport.js** with OpenID Connect authentication
- **WebSocket** for real-time updates

### Mobile
- **Capacitor 7** for iOS and Android
- **Firebase Cloud Messaging** for push notifications
- **Native splash screens** and app icons

## 📋 Prerequisites

- **Node.js** 20.x or higher
- **PostgreSQL** database (or use Replit's built-in database)
- **Firebase** account (for push notifications)
- For iOS builds: macOS with Xcode 14+
- For Android builds: Android Studio with JDK 17+

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd kid-commute
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Session
SESSION_SECRET=your-random-secret-key

# GPS Integration (Samsara)
SAMSARA_API_TOKEN=your-samsara-api-token
SAMSARA_WEBHOOK_SECRET=your-webhook-secret
GPS_WEBHOOK_SECRET=your-gps-webhook-secret

# Push Notifications
FIREBASE_SERVICE_ACCOUNT_JSON={"your":"firebase-service-account-json"}

# Payroll Integration (Optional)
BAMBOOHR_API_TOKEN=your-bamboohr-api-token
BAMBOOHR_SUBDOMAIN=your-subdomain

# Billing Portals (Optional)
QUICKBOOKS_PORTAL_URL=https://your-quickbooks-portal
CLASSWALLET_PORTAL_URL=https://your-classwallet-portal
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📱 Building Mobile Apps

See the comprehensive [Mobile Build Guide](./MOBILE_BUILD_GUIDE.md) for detailed instructions on building iOS and Android apps.

### Quick Commands

```bash
# Build web app
npm run build

# Sync to mobile platforms
npx cap sync

# Open in IDE
npx cap open android
npx cap open ios
```

## 🏗️ Project Structure

```
kid-commute/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and helpers
│   │   └── hooks/         # Custom React hooks
├── server/                # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   ├── auth.ts            # Authentication logic
│   └── index.ts           # Server entry point
├── shared/                # Shared code between client/server
│   └── schema.ts          # Database schema and types
├── android/               # Android native project
├── ios/                   # iOS native project
├── attached_assets/       # Static assets
└── dist/                  # Build output
```

## 🔐 Authentication

The app uses **OpenID Connect (OIDC)** via Replit Auth for secure authentication. Users are automatically assigned roles (admin, driver, parent) based on their profile data.

### Role-Based Access Control

- **Admin**: Full system access
- **Driver**: Route management, attendance, messaging
- **Parent**: Student tracking, messaging, account management

## 🗄️ Database Schema

The application uses PostgreSQL with the following key tables:

- `users` - User accounts with role-based access
- `vehicles` - Fleet vehicle information
- `routes` - Transportation routes
- `stops` - Pickup/dropoff locations
- `students` - Student information
- `shifts` - Driver shift schedules
- `clock_events` - Time tracking
- `ride_events` - Student board/deboard events
- `messages` - Parent-driver communication
- `incidents` - Incident reports
- `vehicle_checklists` - Safety inspections
- `geofences` - Location-based triggers
- `gps_events` - Vehicle location history

See `shared/schema.ts` for the complete schema definition.

## 🔄 Real-Time Features

### WebSocket Integration

The app includes a WebSocket server for real-time updates:

- Live vehicle location updates
- Instant messaging
- Push notifications
- Route progress updates

### GPS Tracking

Supports multiple GPS providers:
- **Samsara** (primary integration)
- Generic webhook-based GPS providers
- Automatic geofence detection
- ETA calculations using Haversine formula

## 📊 External Integrations

### BambooHR Payroll

Automated driver payroll export with:
- Federal and Arizona overtime rules
- Per-shift hour calculations
- Comprehensive audit trail
- Duplicate detection

### Firebase Cloud Messaging

Push notifications for:
- Student pickup alerts
- Route delays
- Driver messages
- System announcements

### Payment Portals

Configurable billing portals:
- QuickBooks
- ClassWallet
- Custom portal integration

## 🧪 Testing

```bash
# Type checking
npm run check

# Build for production
npm run build

# Database migrations
npm run db:push
```

## 📝 Environment Configuration

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Session encryption key | Yes |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SAMSARA_API_TOKEN` | Samsara GPS API token | - |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase credentials | - |
| `BAMBOOHR_API_TOKEN` | BambooHR API token | - |
| `QUICKBOOKS_PORTAL_URL` | QuickBooks billing portal | - |
| `CLASSWALLET_PORTAL_URL` | ClassWallet billing portal | - |

## 🚢 Deployment

### Web Application

The web app can be deployed to any Node.js hosting platform:

1. Build the application: `npm run build`
2. Set environment variables on your hosting platform
3. Run: `npm start`

### Mobile Apps

Follow the [Mobile Build Guide](./MOBILE_BUILD_GUIDE.md) to:
1. Build signed APK/AAB for Android
2. Archive and submit to App Store for iOS
3. Configure push notifications
4. Set up Firebase

## 🔒 Security

- All API endpoints require authentication
- Role-based access control
- Secure session management with PostgreSQL storage
- Environment variables for sensitive data
- HTTPS enforcement in production
- Input validation with Zod schemas

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

This is a private transportation management system. For support or questions, contact your system administrator.

## 📞 Support

For technical support or questions:
- Check the [Mobile Build Guide](./MOBILE_BUILD_GUIDE.md) for mobile app issues
- Review `replit.md` for system architecture details
- Contact your system administrator

---

**Built with ❤️ for safer student transportation**
