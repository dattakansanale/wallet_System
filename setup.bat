@echo off
echo ========================================
echo Wallet System Setup
echo ========================================

REM Create .env file
echo Creating .env file...
(
echo DB_HOST=localhost
echo DB_USER=root
echo DB_PASSWORD=
echo DB_NAME=WalletSystem
echo PORT=5000
echo JWT_SECRET=my_secret_jwt_key_12345
) > wallet-backend\.env

echo.
echo .env file created!

REM Create test user
echo.
echo Creating test user...
cd wallet-backend
call node src/controllers/authController.js

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Test Credentials:
echo   Phone: 1234567890
echo   Password: password123
echo   PIN: 123456
echo.
pause
