<div align="center">
    <img width="820" height="312" alt="SIST (Ship Intelligence & Suspicion Tracker) Banner" src="https://github.com/user-attachments/assets/d48bd8c6-626b-4203-b7c8-bef979ee805d" />
</div>

# SIST (Ship Intelligence & Suspicion Tracker)

![](https://img.shields.io/github/stars/tristanbudd/sist.svg)
![](https://img.shields.io/github/watchers/tristanbudd/sist.svg)
![](https://img.shields.io/github/license/tristanbudd/sist.svg)

![](https://img.shields.io/github/issues-raw/tristanbudd/sist.svg)
![](https://img.shields.io/github/issues-closed-raw/tristanbudd/sist.svg)
![](https://img.shields.io/github/issues-pr-raw/tristanbudd/sist.svg)
![](https://img.shields.io/github/issues-pr-closed-raw/tristanbudd/sist.svg)

SIST (Ship Intelligence & Suspicion Tracker) - A modern AIS monitoring and analysis platform designed to detect suspicious vessel activity, anomalies, and patterns in maritime data.

---

## Project Description

SIST provides a powerful interface for tracking, analysing, and flagging vessel behaviour using AIS (Automatic Identification System) data.

The platform is built with a Laravel backend and a React + Inertia.js frontend, offering a fast, responsive, and scalable architecture for real-time maritime intelligence.

It currently supports:

- Monitoring vessel movement and behaviour in real time.
- Detecting anomalies and suspicious activity through external data source integrations.
- Visualising maritime data in a clear, actionable way.
- Providing a foundation for further intelligence tooling.

### System Disclosures

**AIS Coverage Limits** - SIST's AIS tracking is subject to terrestrial and satellite reception limits. Coverage is not 100% global, and vessel data may experience latency or intermittent gaps depending on region.

**Data Integrity** - Information is aggregated from public, open-source maritime feeds. SIST provides this for tracking and research purposes, but absolute data integrity depends on external source accuracy.

**Developmental Status** - SIST is a new platform undergoing active testing. Features, analytics, and data accuracy are currently under evaluation.

---

## Documentation

Hosted docs: [https://sist.tristanbudd.com/docs](https://sist.tristanbudd.com/docs)

Local docs: Available under `http://127.0.0.1:8000/docs` or `http://127.0.0.1:8000/documentation` after running the development server.

---

## Features

### Completed

- Real Time Fleet Tracking: View active vessels on a dynamic, high performance map.
- Hybrid Search System: Search for active and offline vessels with a highly responsive search bar.
- Detailed Vessel Profiles: Access deep insights into a ship's current status, voyage details, and historical route data.
- Sanctions Compliance Verification: Automatically check vessel identifiers against official sanction lists and dark fleet networks.
- Historical Trajectory Analysis: Select custom time windows to analyse past movement and waypoints.

### Planned Updates

- Suspicion Scoring: Vessel analysis to assess a proprietary suspicion score and track strange behaviour. Will consider implementing AI to assist with anomaly detection.
- Ships of Interest Panel: A dedicated interface for managing flagged or closely watched vessels.
- Analysis Tooling: Additional slide out panels on the left to provide further map and analysis capabilities.

---

## Preview Images

### World Maritime Overview
<img width="1920" height="945" alt="World Maritime Overview" src="https://github.com/user-attachments/assets/72e961e7-a249-42c8-8b95-4f31950da2f7" />

### Viewing Vessel
<img width="1920" height="945" alt="Viewing Vessel" src="https://github.com/user-attachments/assets/6c7f4f46-3e57-4a61-a918-b2f55d77f7ef" />

### Vessel Sanctions & Information Panel
<img width="1920" height="945" alt="Vessel Sanctions & Information Panel" src="https://github.com/user-attachments/assets/d2465e32-a788-4876-ac43-3979fbb27291" />

### Environmental Snapshot
<img width="1920" height="945" alt="Environmental Snapshot" src="https://github.com/user-attachments/assets/5af3065b-399e-4d0b-9a7b-7609acea7e51" />

### Trajectory Analysis
<img width="1920" height="945" alt="Trajectory Analysis" src="https://github.com/user-attachments/assets/da6a3880-356f-4d9b-8ab9-7135832f39e1" />

### Map Tools
<img width="1920" height="945" alt="Map Tools" src="https://github.com/user-attachments/assets/02eee798-b091-4467-88c1-1fd4cf026c9c" />

---

## Tech Stack

- **Backend:** Laravel (PHP ≥ 8.3)
- **Frontend:** React 18 + Inertia.js
- **Build Tooling:** Vite
- **Styling:** Tailwind CSS
- **Linting & Formatting:** ESLint, Prettier, Laravel Pint
- **Git Hooks:** Husky + lint-staged

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/tristanbudd/sist.git
cd sist
```

### 2. Install dependencies

#### PHP dependencies

```bash
composer install
```

#### Node dependencies (pnpm)

```bash
pnpm install
```

### 3. Environment setup

```bash
cp .env.example .env

Update your .env file:

APP_NAME=SIST
APP_ENV=local

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sist
DB_USERNAME=root
DB_PASSWORD=
```

### 4. Generate app key

```bash
php artisan key:generate
```

### 5. Run migrations

```bash
php artisan migrate
```

### 6. Start development servers

# Laravel backend

```bash
php artisan serve
```

# Frontend (Vite)

```bash
pnpm dev
```

---

## Scripts

```bash
pnpm dev             # Start Vite dev server
pnpm build           # Build frontend assets

pnpm lint            # Run ESLint
pnpm lint:fix        # Fix lint issues

pnpm format          # Format frontend files
pnpm format:check    # Check formatting

pnpm format:php      # Format PHP (Laravel Pint)
pnpm format:php:test # Check PHP formatting
```

---

## Development Notes

- Uses modern Laravel + Inertia architecture (SPA without full API separation)
- Frontend is located in resources/js
- Tailwind CSS is configured via Vite
- Husky + lint-staged enforce code quality on commits

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Ensure linting and formatting pass
5. Open a pull request

Please read [CONTRIBUTING.md](https://github.com/tristanbudd/sist/blob/main/CONTRIBUTING.md) for more details.

---

## Security

If you discover a vulnerability, please open a private issue or follow [SECURITY.md](https://github.com/tristanbudd/sist/blob/main/SECURITY.md).

---

## License

[MIT](LICENSE)
