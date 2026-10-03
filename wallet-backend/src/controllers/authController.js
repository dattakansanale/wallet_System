// src/controllers/authController.js
const pool = require('../services/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper function to hash
const hashData = async (data) => {
  return bcrypt.hash(data, 10);
};

// --- THIS IS A HELPER FOR YOU TO ADD USERS ---
// In a real app, you'd get this from req.body
const sampleSignup = async () => {
  console.log('Running sample signup to create a user...');
  const fName = 'Test';
  const lName = 'User';
  const phone = '1234567890';
  const email = 'test@example.com';
  const password = 'password123';
  const pin = '123456'; // 6-digit PIN

  const passwordHash = await hashData(password);
  const pinHash = await hashData(pin);

  try {
    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT User_ID FROM USER WHERE Phn_No = ?',
      [phone]
    );

    if (existing.length > 0) {
      console.log('User already exists, skipping creation.');
      process.exit(0);
    }

    // 1. Create User
    const [userResult] = await pool.query(
      `INSERT INTO USER (F_Name, L_Name, Phn_No, Email, PasswordHash, Wallet_PIN_Hash, Login_Identifier, Is_Verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [fName, lName, phone, email, passwordHash, pinHash, phone]
    );
    const newUserId = userResult.insertId;

    // 2. Create Wallet for User
    const [walletResult] = await pool.query(
      'INSERT INTO WALLET (User_ID, Balance) VALUES (?, 10000.00)', // Give 10k balance for testing
      [newUserId]
    );
    
    console.log(`✅ User ${newUserId} created successfully!`);
    console.log(`✅ Wallet ${walletResult.insertId} created with balance ₹10,000`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Phone: ${phone}`);
    console.log(`   Password: ${password}`);
    console.log(`   PIN: ${pin}\n`);

  } catch (error) {
    console.error('❌ Error during sample signup:', error.message);
    process.exit(1);
  }
};
// --- END HELPER ---


// Real Login Function
exports.login = async (req, res) => {
  const { loginIdentifier, password } = req.body; // e.g., phone or email

  try {
    const [rows] = await pool.query(
      'SELECT User_ID, PasswordHash FROM USER WHERE Login_Identifier = ?',
      [loginIdentifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Success! Create JWT
    const token = jwt.sign(
      { userId: user.User_ID },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token expires in 1 hour
    );

    res.json({ message: 'Login successful', token });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Register Function
exports.register = async (req, res) => {
  const { fName, lName, phone, email, password, pin, isMerchant, businessName, businessType, businessAddress } = req.body;

  // Validation
  if (!fName || !lName || !phone || !email || !password || !pin) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
  }

  try {
    // Check if user already exists
    const [existingPhone] = await pool.query('SELECT User_ID FROM USER WHERE Phn_No = ?', [phone]);
    const [existingEmail] = await pool.query('SELECT User_ID FROM USER WHERE Email = ?', [email]);

    if (existingPhone.length > 0) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password and PIN
    const passwordHash = await hashData(password);
    const pinHash = await hashData(pin);

    // Create User
    const [userResult] = await pool.query(
      `INSERT INTO USER (F_Name, L_Name, Phn_No, Email, PasswordHash, Wallet_PIN_Hash, Login_Identifier, Is_Verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [fName, lName, phone, email, passwordHash, pinHash, phone]
    );

    const newUserId = userResult.insertId;

    // Create Wallet for User with initial balance of 1000
    const [walletResult] = await pool.query(
      'INSERT INTO WALLET (User_ID, Balance) VALUES (?, 1000.00)',
      [newUserId]
    );

    // If registering as merchant, create a merchant record and a separate merchant wallet
    if (isMerchant) {
      try {
        // Create a wallet for the merchant (not tied to a user)
        const [mWallet] = await pool.query('INSERT INTO WALLET (User_ID, Balance) VALUES (NULL, 0.00)');
        const mWalletId = mWallet.insertId;

        // Insert merchant record
        await pool.query(
          `INSERT INTO MERCHANT (Name, Business_Type, Email, Phn_No, Address, Wallet_ID)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [businessName || `${fName} ${lName}`, businessType || 'Retail', email, phone, businessAddress || '', mWalletId]
        );
      } catch (mErr) {
        console.error('Merchant creation error:', mErr);
        // non-fatal for registration — return success but log merchant creation failure
      }
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: newUserId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({ 
      message: 'Registration successful', 
      token,
      userId: newUserId 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current user's profile
exports.getProfile = async (req, res) => {
  const userId = req.userId;
  try {
    const [rows] = await pool.query(
      `SELECT User_ID, F_Name, M_Name, L_Name, Phn_No, Email, Address, Created_At
       FROM USER WHERE User_ID = ? LIMIT 1`,
      [userId]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('GetProfile error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update current user's profile
exports.updateProfile = async (req, res) => {
  const userId = req.userId;
  // Accept newPin and oldPin for PIN rotation; other profile fields as before
  const { fName, mName, lName, phone, email, address, newPin, oldPin } = req.body;

  // Basic validation: require at least one field
  if (!fName && !mName && !lName && !phone && !email && !address && !newPin) {
    return res.status(400).json({ message: 'No profile fields provided to update' });
  }

  try {
    // Check uniqueness for phone/email if provided
    if (phone) {
      const [pRows] = await pool.query('SELECT User_ID FROM USER WHERE Phn_No = ? AND User_ID != ?', [phone, userId]);
      if (pRows.length > 0) return res.status(400).json({ message: 'Phone number already in use' });
    }
    if (email) {
      const [eRows] = await pool.query('SELECT User_ID FROM USER WHERE Email = ? AND User_ID != ?', [email, userId]);
      if (eRows.length > 0) return res.status(400).json({ message: 'Email already in use' });
    }

    const updates = [];
    const params = [];
    if (fName) { updates.push('F_Name = ?'); params.push(fName); }
    if (mName) { updates.push('M_Name = ?'); params.push(mName); }
    if (lName) { updates.push('L_Name = ?'); params.push(lName); }
    if (phone) { updates.push('Phn_No = ?'); params.push(phone); updates.push('Login_Identifier = ?'); params.push(phone); }
    if (email) { updates.push('Email = ?'); params.push(email); }
    if (address) { updates.push('Address = ?'); params.push(address); }

    // Handle PIN change: require both oldPin and newPin
    if (newPin) {
      if (!/^[0-9]{6}$/.test(newPin)) return res.status(400).json({ message: 'New PIN must be exactly 6 digits' });
      if (!oldPin) return res.status(400).json({ message: 'Current PIN is required to change PIN' });

      // Verify old pin
      const [uRows] = await pool.query('SELECT Wallet_PIN_Hash FROM USER WHERE User_ID = ? LIMIT 1', [userId]);
      if (!uRows || uRows.length === 0) return res.status(404).json({ message: 'User not found' });
      const currentHash = uRows[0].Wallet_PIN_Hash;
      const match = await bcrypt.compare(oldPin, currentHash);
      if (!match) return res.status(403).json({ message: 'Current PIN is incorrect' });

      const newPinHash = await hashData(newPin);
      updates.push('Wallet_PIN_Hash = ?'); params.push(newPinHash);
    }

    if (updates.length === 0) return res.status(400).json({ message: 'No valid fields to update' });

    const sql = `UPDATE USER SET ${updates.join(', ')} WHERE User_ID = ?`;
    params.push(userId);

    await pool.query(sql, params);

    // Return updated profile
    const [updatedRows] = await pool.query('SELECT User_ID, F_Name, M_Name, L_Name, Phn_No, Email, Address FROM USER WHERE User_ID = ?', [userId]);
    res.json({ message: 'Profile updated', user: updatedRows[0] });
  } catch (err) {
    console.error('UpdateProfile error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// --- RUN THE HELPER ONCE (Optional) ---
if (require.main === module) {
  // This means the file is being run directly (not imported)
  sampleSignup().then(() => {
    process.exit(0);
  });
}