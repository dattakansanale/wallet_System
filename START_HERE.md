# 🚀 Quick Start Guide

## Step 1: Setup Database

```bash
mysql -u root -p < wallet_system_complete.sql
```

Then enable events:
```sql
SET GLOBAL event_scheduler = ON;
```

## Step 2: Configure Backend

1. Go to `wallet-backend` folder
2. Create `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=WalletSystem
PORT=5000
JWT_SECRET=my_secret_key
```

3. Install dependencies:
```bash
npm install
```

## Step 3: Create Test User

Open `wallet-backend/src/controllers/authController.js`

Uncomment line 85:
```javascript
sampleSignup(); // Uncomment this line
```

Run once:
```bash
cd wallet-backend
node src/controllers/authController.js
```

Then comment the line back.

## Step 4: Start Backend

```bash
cd wallet-backend
npm start
```

## Step 5: Open Frontend

Open `wallet-frontend/login.html` in your browser

**Login credentials:**
- Phone: `1234567890`
- Password: `password123`
- PIN: `123456`

## Test Payment

- Receiver Type: **Merchant**
- Receiver ID: `1` (Amazon)
- Amount: `100`
- PIN: `123456`

---

That's it! 🎉
