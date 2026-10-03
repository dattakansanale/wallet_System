# 🏦 Wallet Management System

A full-stack wallet management system with Node.js backend and vanilla JavaScript frontend.
##  System Architecture

![Architecture Diagram](https://github.com/hariomkhonde108/Wallet_System/blob/main/SmartWallet%20Full-Stack%20Architecture%20%26%20Money%20Flows%20(1).png) 


## 📋 Features

- ✅ User Authentication (JWT-based)
- 💰 Wallet Balance Management
- 💳 Payment Processing (P2P & Merchant)
- 📊 Transaction History
- 🎫 Reward Points System
- 🔄 Refund Management
- 🔔 Notifications
- 📈 Audit Trail

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- MySQL with Stored Procedures
- JWT Authentication
- bcryptjs for password hashing

### Frontend
- Vanilla JavaScript
- Bootstrap 5
- Fetch API

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MySQL (v8+)
- Git

### 1. Database Setup

First, create the database and tables:

```bash
# 🏦 SmartWallet — Wallet Management System

This repository contains a full-stack wallet management system: a Node.js + Express backend connected to a MySQL database, and a lightweight vanilla-JavaScript frontend. The app supports P2P and merchant payments, rewards, refunds, notifications, profile management (including profile pictures), and analytics reports.

This README documents how to set up the project, what has been implemented, the database schema (tables, triggers, stored procedures, functions, and events), the API surface, and how to test features locally.

---

## 🚀 Quick overview
- Backend: Node.js + Express, MySQL (mysql2/promise), JWT-based auth
- Frontend: Static vanilla JavaScript pages in `wallet-frontend`
- Database: single-file DB schema and logic in `wallet_system_complete.sql` (tables, triggers, stored procedures, functions, and scheduled events)

---

## Table of contents
- Prerequisites
- Installation & setup
- Running the app
- Implemented features (what's done)
- Database schema (tables and purpose)
- Triggers, functions, stored procedures, events
- API endpoints (summary)
- Frontend pages
- Migration: ALTER TABLE to add profile picture column
- Troubleshooting
- Next steps & suggestions

---

## Prerequisites
- Node.js (v14+ recommended)
- MySQL (v8+ recommended) with privileges to create events/triggers/procedures
- Git

---

## Installation & setup

1. Clone the repo and open it:

```powershell
cd C:\Users\hario\coding\DBMS_PROJECT
```

2. Create the database schema (runs tables, triggers, procs, events):

```powershell
mysql -u <db_user> -p < wallet_system_complete.sql
```

3. Configure the backend environment

Create a `.env` file inside `wallet-backend/` with these variables (example):

```ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=WalletSystem
PORT=5000
JWT_SECRET=change_this_to_a_strong_secret
```

4. Install backend dependencies and start the server:

```powershell
cd wallet-backend
npm install
npm start
```

5. Serve the frontend (optional simple server):

```powershell
cd wallet-frontend\main
# Option A: Python http server
python -m http.server 8000
# Option B: use VS Code Live Server or any static server
```

Open `http://localhost:8000` (or open the `main` HTML files directly) and login.

Note: backend runs on `http://localhost:5000` by default and expects the frontend to call /api endpoints there.

---

## What has been implemented (features)

This project implements the following features (major items):

- Authentication and Account Management
    - JWT-based login and registration
    - Profile view & edit (including PIN rotation which requires the current PIN)
    - Profile picture upload (server stores file and saves URL in DB)

- Wallet & Payments
    - User wallets and merchant wallets
    - Payments (P2P and to merchants) using the `MakePayment` stored procedure (atomic)
    - Transaction history (includes incoming and outgoing payments and sender/receiver names)

- Rewards
    - Reward points awarded automatically when payments transition to Success (triggers)
    - Redeem reward points endpoint which credits wallet and expires used rewards

- Notifications
    - Notification table and endpoints (Unread/Read) to inform users about payments/refunds

- Refunds
    - Refund request workflow: users create REFUND_TICKET; merchants receive notifications
    - Merchant endpoints to approve/decline refunds; approval calls `ProcessRefund` stored proc
    - Scheduled retry event to re-attempt refunds if merchant balance insufficient

- Auditing & Ledger
    - Wallet audit entries and wallet transactions ledger on balance changes

- Analytics
    - Monthly analysis report endpoints and a frontend `reports.html` with charts (daily trend, top counterparties) and CSV export

---

## Database schema (tables) — short reference

The main tables created in `wallet_system_complete.sql`:

- `USER` — stores users (names, phone, email, address, password hash, wallet PIN hash, created_at)
- `WALLET` — wallet balance per user (Wallet_ID, User_ID, Balance)
- `MERCHANT` — merchants (Name, Business_Type, Email, Phn_No, Wallet_ID)
- `PAYMENT_METHOD` — payment methods (WALLET, UPI, CREDIT_CARD)
- `PAYMENT` — payments ledger (Transaction_ID, User_ID (payer), Receiver_Type, Receiver_Entity_ID, Amount, Status, Transaction_Hash, Date_time)
- `PAYMENT_HISTORY` — optional extended description per payment (Transaction_ID → Description)
- `NOTIFICATION` — user notifications (Notification_ID, User_ID, Message, Status)
- `REFUND_TICKET` — refund requests (Refund_ID, Transaction_ID, Merchant_ID, Reason, Status, Attempts)
- `REWARDS` — reward points rows for users (Reward_ID, User_ID, Points, Expiry_Date, Is_Expired)
- `WALLET_AUDIT` — audit trail of balance changes (Audit_ID, Wallet_ID, Old_Balance, New_Balance, Change_Type)
- `WALLET_TRANSACTIONS` — ledger entries for wallet debits/credits (Txn_ID, Wallet_ID, Txn_Type, Amount, Remarks)

Indexes are defined for common queries (payment user/receiver indexes, indexes for refunds and rewards).

---

## Triggers, Functions, Stored Procedures & Events

This project uses several DB-level automation pieces (in `wallet_system_complete.sql`):

- Functions
    - `GetTotalSpendByUser(p_user_id)` — returns total successful spend for a user.
    - `GetUserRewardPoints(p_user_id)` — returns total non-expired reward points for a user.

- Triggers
    - `WalletBalanceAudit` — BEFORE UPDATE on `WALLET` inserts a row into `WALLET_AUDIT` when balance changes.
    - `AfterPaymentAddReward` — AFTER INSERT on `PAYMENT` adds a reward when Status = 'Success'.
    - `AfterPaymentUpdateAddReward` — AFTER UPDATE on `PAYMENT` awards rewards when status transitions to 'Success' (handles updates from Pending to Success).

- Stored Procedures
    - `MakePayment(p_from_user_id, p_receiver_type, p_receiver_entity_id, p_amount, p_txn_hash, p_description)` — core payment procedure; performs wallet balance updates, ledger entries and returns status (Success/Failed/ALREADY_EXISTS). It includes idempotency via Transaction_Hash.
    - `ProcessRefund(p_refund_id)` — processes an existing refund ticket by attempting to debit the merchant wallet and credit the user's wallet; updates `REFUND_TICKET` status accordingly.
    - `CreateRefundTicketAndProcess(p_transaction_id, p_merchant_id, p_reason)` — creates a refund ticket then triggers `ProcessRefund` for immediate processing.

- Scheduled Events
    - `ExpireRewardsEvent` — daily job to mark expired rewards.
    - `RetryPendingRefundsEvent` — hourly job that retries processing refunds with limited attempts.

These DB-level constructs allow financial operations to be atomic and auditable.

---

## API endpoints (summary)

Authentication
- `POST /api/auth/login` — login, returns JWT token
- `POST /api/auth/register` — register (supports merchant registration fields)
- `GET /api/auth/profile` — get current user's profile (protected)
- `PUT /api/auth/profile` — update profile (protected)
- `POST /api/auth/profile/picture` — upload profile picture (protected; multipart/form-data `picture` field)

Payments & Wallet (protected routes)
- `GET /api/payments/dashboard` — wallet info, ledger, history, rewards summary
- `GET /api/payments/contacts` — list users & merchants for quick send
- `POST /api/payments` — make a payment (body: receiverType, receiverId, amount, pin, txnHash, description)
- `GET /api/payments/:id` — get payment details

Rewards
- `GET /api/payments/rewards` — list rewards & total points
- `POST /api/payments/rewards/redeem` — redeem available points into wallet

Refunds & Merchant actions
- `POST /api/payments/refund` — request a refund (creates REFUND_TICKET)
- `GET /api/refunds/merchant` — merchant: list refund tickets for merchant(s) owned by user
- `POST /api/refunds/:id/approve` — merchant approves refund (calls `ProcessRefund`)
- `POST /api/refunds/:id/decline` — merchant declines refund

Notifications
- `GET /api/notifications` — (not shown in detail here) list notifications for user

Reports
- `GET /api/reports/monthly` — monthly analysis JSON (user by default; supports `type=merchant&merchantId=` with authorization check)
- `GET /api/reports/monthly/csv` — CSV export for user monthly report

All protected routes expect an `Authorization: Bearer <token>` header with a valid JWT.

---

## Frontend pages (main files)

- `wallet-frontend/main/index.html` — Dashboard
- `wallet-frontend/main/login.html` — Login page
- `wallet-frontend/main/profile.html` — Profile view/edit (with profile picture upload)
- `wallet-frontend/main/reports.html` — Monthly reports UI (charts + CSV export)
- `wallet-frontend/main/history.html` — Transaction history
- `wallet-frontend/main/send.html` — Send funds to a user
- `wallet-frontend/main/pay-merchant.html` — Pay merchant flow

Main JS files live in `wallet-frontend/js/` and manage API calls and UI interactions.

---

## ALTER TABLE: add Profile_Pic column (migration)

If your database doesn't have the `Profile_Pic` column in `USER`, run this ALTER:

```sql
ALTER TABLE `USER`
ADD COLUMN `Profile_Pic` VARCHAR(255) NULL;
```

Optional: place it after `Address`:

```sql
ALTER TABLE `USER`
ADD COLUMN `Profile_Pic` VARCHAR(255) NULL
AFTER `Address`;
```

Rollback (remove column):

```sql
ALTER TABLE `USER` DROP COLUMN `Profile_Pic`;
```

Notes: the backend expects `Profile_Pic` to contain a path like `/uploads/user-<id>-<ts>.png`. The server serves uploaded images from `/uploads`.

---

## How to test the main flows

1. Register or run `sampleSignup()` (one-time helper) to seed a test user.
2. Login via frontend to get JWT stored in `localStorage.walletToken`.
3. Make a payment from the Send UI (provide correct 6-digit PIN).
4. Check dashboard and history — incoming payments should be visible for recipients.
5. Request a refund from the transaction detail; check merchant's `refunds` UI (merchant must be registered and matched to a user account to approve).
6. Redeem rewards from the Rewards page; check wallet balance updates.
7. Visit Reports → load monthly report; download CSV.

---

## Troubleshooting — common issues

- 404 Cannot GET /api/reports/monthly: ensure backend is running and that routes are registered. Restart backend and check logs.
- 401 Unauthorized: token missing or expired — log in again to get a fresh JWT.
- Database errors: check `.env` DB connection values and that `WalletSystem` schema was imported.
- Event scheduler: to enable scheduled events run `SET GLOBAL event_scheduler = ON;` as a user with SUPER privileges.

If something fails, check the backend console log (where `npm start` runs) for stack traces — controllers log errors with context.

---

## Files changed / feature ownership (what work was done in this branch)

This README reflects the features implemented in this workspace. Major changes include:

- Backend
    - `src/controllers/paymentController.js` — payments, dashboard (incoming + outgoing history), rewards endpoints, redeem logic
    - `src/controllers/authController.js` — register/login, profile GET/PUT, upload picture handler (multer)
    - `src/controllers/refundController.js` — merchant refund listing, approve/decline endpoints
    - `src/controllers/reportsController.js` — monthly JSON and CSV report endpoints
    - `src/routes/*` — routes for auth, payments, refunds, notifications, and new `reportsRoutes.js`
    - `src/index.js` — route registration and a debug helper for routes

- Frontend
    - `wallet-frontend/main/reports.html` + `wallet-frontend/js/reports.js` — monthly reports UI and CSV download
    - `wallet-frontend/main/profile.html` + `wallet-frontend/js/profile.js` — profile page and client-side upload/preview logic
    - `wallet-frontend/js/app.js` — dashboard wiring (avatar, profile link, reports button)

- Database
    - `wallet_system_complete.sql` — schema, triggers, stored procedures, functions, and scheduled events. (Includes `MakePayment`, `ProcessRefund`, reward triggers, audit triggers, and scheduled events.)

If you need a changelog-style per-commit attribution, we can generate one from Git history.

---

## Next improvements I recommend (prioritized)

1. Merchant ownership mapping table (`MERCHANT_USER`) to handle merchant permissions robustly (instead of simple email/phone match).
2. Server-side image resizing + validation for profile pictures.
3. Background worker to produce PDF reports and email them (opt-in scheduled reports).
4. Auto-categorization of transactions and budgeting features for users.
5. Unit/integration tests for stored procedures and endpoints.

---

## Contributions

If you'd like me to add an OpenAPI spec, structured migration files, or implement any of the next improvements above, tell me which item to start with and I will implement it next.

---

© Project — Educational use
