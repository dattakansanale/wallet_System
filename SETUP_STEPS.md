# 🔧 Setup Steps to Fix "Invalid Credentials"

The "invalid credentials" error happens because **no test user exists** in the database yet. Follow these steps:

## Step 1: Create the `.env` file

1. Go to the `wallet-backend` folder
2. Create a new file named `.env` (with the dot at the start)
3. Copy and paste this content:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=WalletSystem
PORT=5000
JWT_SECRET=my_secret_jwt_key_12345
```

> **Note:** Leave `DB_PASSWORD=` empty if you don't have a MySQL password, or add your password if you do.

## Step 2: Create the Test User

Run this command in the terminal:

```bash
cd wallet-backend
node src/controllers/authController.js
```

You should see output like:
```
✅ User 1 created successfully!
✅ Wallet 1 created with balance ₹10,000

📝 Login credentials:
   Phone: 1234567890
   Password: password123
   PIN: 123456
```

## Step 3: Start the Backend Server

```bash
cd wallet-backend
npm start
```

You should see:
```
Server running on port 5000
```

## Step 4: Login

1. Open `wallet-frontend/login.html` in your browser
2. Use these credentials:
   - **Phone:** `1234567890`
   - **Password:** `password123`

## Alternative: Use the Setup Script

I created a `setup.bat` file for Windows. Just **double-click it** and it will:
1. Create the `.env` file
2. Create the test user
3. Show you the credentials

---

## Quick Troubleshooting

**Still getting "Invalid credentials"?**

1. Make sure the database is running (MySQL server should be active)
2. Make sure the `.env` file exists in the `wallet-backend` folder
3. Make sure you ran the `node src/controllers/authController.js` command
4. Check that the backend server is running on port 5000
5. Try clearing your browser's localStorage (F12 → Application → Local Storage → Clear)

**Database connection error?**

Make sure:
- MySQL is installed and running
- You imported the SQL file: `mysql -u root -p < wallet_system_complete.sql`
- Your `.env` file has the correct MySQL credentials

---

That's it! 🎉
