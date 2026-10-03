# Recent Changes & Fixes

## 🔧 Fixed Issues

### 1. Payment Error - "Out of range value for column 'p_receiver_entity_id'"

**Problem:** Users were entering phone numbers (like `9988776655`) as receiver IDs, which exceeded the INT maximum value and caused database errors.

**Solution:** Added validation in `paymentController.js` to ensure receiver IDs are valid integers within acceptable range (1 to 2,147,483,647).

```javascript
// Validate receiverId is a valid integer and not too large
const receiverIdInt = parseInt(receiverId);
if (isNaN(receiverIdInt) || receiverIdInt <= 0 || receiverIdInt > 2147483647) {
  return res.status(400).json({ 
    message: 'Invalid receiver ID. Please use User_ID or Merchant_ID only (not phone numbers).' 
  });
}
```

**Important Note:** 
- For **Merchant payments**, use Merchant_ID (1-5 for test merchants)
- For **P2P (User) payments**, use User_ID (1, 2, 3, etc.), **NOT** phone numbers

## ✨ New Features

### 2. User Registration Page

**What's New:**
- Complete registration form at `register.html`
- Validates phone (10 digits), PIN (6 digits), and password
- Creates user with initial wallet balance of ₹1,000
- Auto-login after successful registration
- Link to registration from login page

**Files Created:**
- `wallet-frontend/register.html` - Registration form
- `wallet-frontend/js/register.js` - Registration logic
- Updated `wallet-backend/src/controllers/authController.js` - Added register function
- Updated `wallet-backend/src/routes/authRoutes.js` - Added register route

**API Endpoint:**
- `POST /api/auth/register`
- Required fields: `fName`, `lName`, `phone`, `email`, `password`, `pin`

## 📝 Usage Notes

### Making Payments

**Merchant Payments:**
- Receiver Type: **MERCHANT**
- Receiver ID: Use Merchant_ID (1-5)
  - 1 = Amazon India
  - 2 = Flipkart
  - 3 = Zomato
  - 4 = Swiggy
  - 5 = Myntra

**P2P (User to User) Payments:**
- Receiver Type: **USER**
- Receiver ID: Use User_ID (1, 2, 3, etc.)
- **Do NOT use phone numbers!**

To find a user's ID:
1. Check the database: `SELECT User_ID, F_Name, L_Name, Phn_No FROM USER;`
2. Or look at recent transactions to find sender/receiver IDs

### Registration

Users can now:
1. Go to `register.html`
2. Fill in their details
3. Get a wallet with ₹1,000 initial balance
4. Start making payments immediately

---

**All systems operational!** ✅
