# Harmonic Salon POS System

A point of sale system for salon management with staff commission tracking.

## Features

- Staff Management
  - Add/edit staff with commission rates
  - Track staff commissions (0.5% for products, 40% for services)
  - Monthly salary reports

- Product Management
  - Inventory tracking
  - Product sales with staff commission

- Service Management
  - Service sales with staff commission
  - Section-based service assignment (MANICURE, PEDICURE, BARBER)

- Reports
  - Daily/Monthly/Yearly reports
  - Staff commission reports
  - Salon profit reports
  - Export to CSV/PDF

## Installation

### From DMG (macOS)

1. Download the latest DMG file from releases
2. Double click the DMG file
3. Drag the app to Applications folder
4. Launch from Applications

### For Development

```bash
# Clone the repository
git clone [your-repo-url]

# Install dependencies
npm install

# Start the app
npm start

# Build the app
npm run dist
```

## Usage

1. Login with default credentials:
   - Username: HARMONICSALON
   - Password: harmonic4

2. Use the different panels to:
   - Manage staff
   - Add/edit products
   - Sell products
   - Record services
   - View reports

## Data Storage

- All data is stored locally in `data.json`
- Automatic backups are created
- Export functionality for reports and data

## License

ISC