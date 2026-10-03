-- wallet_system_complete.sql
-- Single-file SQL for WalletSystem: schema, procedures, triggers, events and sample data
-- Run as a user with privileges to create databases, events, triggers, procedures, etc.

-- ======================================================================
-- 0. Clean up (DROP DB if you want to start fresh). *Optional*
-- ======================================================================
DROP DATABASE IF EXISTS WalletSystem;

-- ======================================================================
-- 1. CREATE DATABASE & USE
-- ======================================================================
CREATE DATABASE IF NOT EXISTS WalletSystem
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE WalletSystem;

-- ======================================================================
-- 2. TABLE DEFINITIONS
-- ======================================================================

-- 2.1 USER table (with auth fields)
CREATE TABLE IF NOT EXISTS USER (
    User_ID INT PRIMARY KEY AUTO_INCREMENT,
    F_Name VARCHAR(50),
    M_Name VARCHAR(50),
    L_Name VARCHAR(50),
    Phn_No VARCHAR(15) UNIQUE,
    Email VARCHAR(100) UNIQUE,
    Address VARCHAR(255),
    PasswordHash VARCHAR(255),
    Wallet_PIN_Hash VARCHAR(255),
    Is_Verified TINYINT(1) DEFAULT 0,
    Login_Identifier VARCHAR(100) NULL,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2.2 WALLET table
CREATE TABLE IF NOT EXISTS WALLET (
    Wallet_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT UNIQUE,
    Balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_user FOREIGN KEY (User_ID) REFERENCES USER(User_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2.3 MERCHANT table (merchants have wallets)
CREATE TABLE IF NOT EXISTS MERCHANT (
    Merchant_ID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100),
    Business_Type VARCHAR(100),
    Email VARCHAR(100) UNIQUE,
    Phn_No VARCHAR(15),
    Address VARCHAR(255),
    Wallet_ID INT,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_merchant_wallet FOREIGN KEY (Wallet_ID) REFERENCES WALLET(Wallet_ID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2.4 PAYMENT_METHOD
CREATE TABLE IF NOT EXISTS PAYMENT_METHOD (
    Method_ID INT PRIMARY KEY AUTO_INCREMENT,
    Method_Name VARCHAR(50),
    Details VARCHAR(255)
) ENGINE=InnoDB;

-- 2.5 PAYMENT table
CREATE TABLE IF NOT EXISTS PAYMENT (
    Transaction_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT,
    Receiver_Type ENUM('USER','MERCHANT') NOT NULL DEFAULT 'MERCHANT',
    Receiver_Entity_ID INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Platform_Fee DECIMAL(18,2) DEFAULT 0.00,
    Status ENUM('Pending','Success','Failed','Refunded') DEFAULT 'Pending',
    Transaction_Hash VARCHAR(128) UNIQUE NULL,
    Method_ID INT NULL,
    Date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_user FOREIGN KEY (User_ID) REFERENCES USER(User_ID) ON DELETE SET NULL,
    CONSTRAINT fk_payment_method FOREIGN KEY (Method_ID) REFERENCES PAYMENT_METHOD(Method_ID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2.6 PAYMENT_HISTORY table
CREATE TABLE IF NOT EXISTS PAYMENT_HISTORY (
    Transaction_ID INT PRIMARY KEY,
    Description VARCHAR(255),
    CONSTRAINT fk_ph_payment FOREIGN KEY (Transaction_ID) REFERENCES PAYMENT(Transaction_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2.7 NOTIFICATION table
CREATE TABLE IF NOT EXISTS NOTIFICATION (
    Notification_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT,
    Message VARCHAR(255),
    Status ENUM('Unread','Read') DEFAULT 'Unread',
    Date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (User_ID) REFERENCES USER(User_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2.8 REFUND_TICKET table
CREATE TABLE IF NOT EXISTS REFUND_TICKET (
    Refund_ID INT PRIMARY KEY AUTO_INCREMENT,
    Transaction_ID INT,
    Merchant_ID INT,
    Reason VARCHAR(255),
    Req_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Process_Date TIMESTAMP NULL,
    Status ENUM('Pending','Processing','Resolved','Failed') DEFAULT 'Pending',
    Attempts INT DEFAULT 0,
    CONSTRAINT fk_refund_payment FOREIGN KEY (Transaction_ID) REFERENCES PAYMENT(Transaction_ID) ON DELETE SET NULL,
    CONSTRAINT fk_refund_merchant FOREIGN KEY (Merchant_ID) REFERENCES MERCHANT(Merchant_ID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2.9 REWARDS table
CREATE TABLE IF NOT EXISTS REWARDS (
    Reward_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT,
    Points INT DEFAULT 0,
    Expiry_Date DATE,
    Description VARCHAR(255),
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Is_Expired TINYINT(1) DEFAULT 0,
    CONSTRAINT fk_rewards_user FOREIGN KEY (User_ID) REFERENCES USER(User_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2.10 WALLET_AUDIT table
CREATE TABLE IF NOT EXISTS WALLET_AUDIT (
    Audit_ID INT PRIMARY KEY AUTO_INCREMENT,
    Wallet_ID INT,
    Old_Balance DECIMAL(18,2),
    New_Balance DECIMAL(18,2),
    Change_Type ENUM('DEBIT','CREDIT'),
    Transaction_ID INT NULL,
    Change_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_wallet FOREIGN KEY (Wallet_ID) REFERENCES WALLET(Wallet_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2.11 WALLET_TRANSACTIONS table
CREATE TABLE IF NOT EXISTS WALLET_TRANSACTIONS (
    Txn_ID INT PRIMARY KEY AUTO_INCREMENT,
    Wallet_ID INT,
    Txn_Type ENUM('DEBIT','CREDIT'),
    Amount DECIMAL(18,2),
    Related_Payment_ID INT NULL,
    Related_Refund_ID INT NULL,
    Remarks VARCHAR(255),
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wt_wallet FOREIGN KEY (Wallet_ID) REFERENCES WALLET(Wallet_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ======================================================================
-- 3. INDEXES / PERFORMANCE
-- ======================================================================
DROP INDEX IF EXISTS idx_wallet_user ON WALLET;
CREATE INDEX idx_wallet_user ON WALLET(User_ID);

DROP INDEX IF EXISTS idx_payment_user ON PAYMENT;
CREATE INDEX idx_payment_user ON PAYMENT(User_ID);

DROP INDEX IF EXISTS idx_payment_receiver ON PAYMENT;
CREATE INDEX idx_payment_receiver ON PAYMENT(Receiver_Entity_ID);

DROP INDEX IF EXISTS idx_payment_hash ON PAYMENT;
CREATE INDEX idx_payment_hash ON PAYMENT(Transaction_Hash);

DROP INDEX IF EXISTS idx_refund_status ON REFUND_TICKET;
CREATE INDEX idx_refund_status ON REFUND_TICKET(Status);

DROP INDEX IF EXISTS idx_rewards_user ON REWARDS;
CREATE INDEX idx_rewards_user ON REWARDS(User_ID);

-- ======================================================================
-- 4. SAMPLE DATA (seed) - Keep this minimal if you use sampleSignup
-- ======================================================================

-- Payment methods
INSERT INTO PAYMENT_METHOD (Method_Name, Details) VALUES
('WALLET','In-app wallet balance'),
('UPI', 'Unified Payments Interface (legacy)'),
('CREDIT_CARD','Card - legacy');

-- ======================================================================
-- 5. FUNCTIONS
-- ======================================================================

DROP FUNCTION IF EXISTS GetTotalSpendByUser;
DELIMITER $$
CREATE FUNCTION GetTotalSpendByUser (p_user_id INT)
RETURNS DECIMAL(18,2)
DETERMINISTIC
READS SQL DATAgive
BEGIN
    DECLARE total_spent DECIMAL(18,2);
    SELECT COALESCE(SUM(Amount),0.00) INTO total_spent
    FROM PAYMENT
    WHERE User_ID = p_user_id
      AND Status = 'Success';
    RETURN total_spent;
END$$
DELIMITER ;

DROP FUNCTION IF EXISTS GetUserRewardPoints;
DELIMITER $$
CREATE FUNCTION GetUserRewardPoints (p_user_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total_points INT;
    SELECT COALESCE(SUM(Points),0) INTO total_points
    FROM REWARDS
    WHERE User_ID = p_user_id
      AND (Is_Expired = 0)
      AND (Expiry_Date IS NULL OR Expiry_Date >= CURRENT_DATE());
    RETURN total_points;
END$$
DELIMITER ;

-- ======================================================================
-- 6. TRIGGERS
-- ======================================================================

DROP TRIGGER IF EXISTS WalletBalanceAudit;
DELIMITER $$
CREATE TRIGGER WalletBalanceAudit
BEFORE UPDATE ON WALLET
FOR EACH ROW
BEGIN
    IF OLD.Balance <> NEW.Balance THEN
        INSERT INTO WALLET_AUDIT (Wallet_ID, Old_Balance, New_Balance, Change_Type, Transaction_ID)
        VALUES (
            NEW.Wallet_ID,
            OLD.Balance,
            NEW.Balance,
            CASE WHEN NEW.Balance > OLD.Balance THEN 'CREDIT' ELSE 'DEBIT' END,
            NULL -- Ideally, capture related payment/refund ID if possible
        );
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS AfterPaymentAddReward;
DELIMITER $$
CREATE TRIGGER AfterPaymentAddReward
AFTER INSERT ON PAYMENT
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Success' THEN
        INSERT INTO REWARDS (User_ID, Points, Expiry_Date, Description)
        VALUES (NEW.User_ID, FLOOR(NEW.Amount / 100), DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH), CONCAT('Auto reward for txn ', NEW.Transaction_ID));
    END IF;
END$$
DELIMITER ;

-- If payments are inserted as 'Pending' and later updated to 'Success' by stored
-- procedures, the above AFTER INSERT trigger will not fire (because INSERT
-- happened with Status='Pending'). To handle those cases, add an AFTER UPDATE
-- trigger that grants rewards when a payment's status transitions to 'Success'.
DROP TRIGGER IF EXISTS AfterPaymentUpdateAddReward;
DELIMITER $$
CREATE TRIGGER AfterPaymentUpdateAddReward
AFTER UPDATE ON PAYMENT
FOR EACH ROW
BEGIN
    -- Only act when status changes from non-Success to Success
    IF (OLD.Status <> 'Success' OR OLD.Status IS NULL) AND NEW.Status = 'Success' THEN
        INSERT INTO REWARDS (User_ID, Points, Expiry_Date, Description)
        VALUES (NEW.User_ID, FLOOR(NEW.Amount / 100), DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH), CONCAT('Auto reward for txn ', NEW.Transaction_ID));
    END IF;
END$$
DELIMITER ;

-- ======================================================================
-- 7. STORED PROCEDURES
-- ======================================================================

-- *** THIS IS THE CORRECTED MakePayment PROCEDURE ***
DROP PROCEDURE IF EXISTS MakePayment;
DELIMITER $$
CREATE PROCEDURE MakePayment (
    IN p_from_user_id INT,
    IN p_receiver_type VARCHAR(10),
    IN p_receiver_entity_id INT,
    IN p_amount DECIMAL(18,2),
    IN p_txn_hash VARCHAR(128),
    IN p_description VARCHAR(255)
)
MakePayment: BEGIN
    DECLARE payer_wallet_id INT;
    DECLARE payee_wallet_id INT;
    DECLARE payer_balance DECIMAL(18,2);
    DECLARE new_txn_id INT;
    DECLARE existing_txn INT;
    DECLARE v_method_id INT DEFAULT 1;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        -- Optional: Add a SELECT here to return error on general SQL exception
        SELECT -1 AS Transaction_ID, 'Failed' AS Status, 'SQLException Occurred' AS Note;
    END;

    START TRANSACTION;

    IF p_txn_hash IS NOT NULL THEN
        SELECT Transaction_ID INTO existing_txn FROM PAYMENT WHERE Transaction_Hash = p_txn_hash LIMIT 1;
        IF existing_txn IS NOT NULL THEN
            SELECT existing_txn AS Transaction_ID, 'ALREADY_EXISTS' AS Note;
            COMMIT;
            -- Need to exit the procedure after COMMIT in this specific check
            LEAVE MakePayment;
        END IF;
    END IF;

    SELECT Wallet_ID, Balance INTO payer_wallet_id, payer_balance
    FROM WALLET
    WHERE User_ID = p_from_user_id
    FOR UPDATE;

    -- This is the fixed logic that always returns a SELECT
    IF payer_wallet_id IS NULL THEN
        -- Payer wallet not found, insert failure and exit
        INSERT INTO PAYMENT (User_ID, Receiver_Type, Receiver_Entity_ID, Amount, Status, Transaction_Hash, Method_ID)
        VALUES (p_from_user_id, p_receiver_type, p_receiver_entity_id, p_amount, 'Failed', p_txn_hash, v_method_id);
        SET new_txn_id = LAST_INSERT_ID();
        INSERT INTO PAYMENT_HISTORY (Transaction_ID, Description) VALUES (new_txn_id, p_description);
        COMMIT;
        SELECT new_txn_id AS Transaction_ID, 'Failed' AS Status, 'Payer Wallet Not Found' AS Note;
    ELSE
        -- Payer wallet found, now check payee
        IF p_receiver_type = 'USER' THEN
            SELECT Wallet_ID INTO payee_wallet_id FROM WALLET WHERE User_ID = p_receiver_entity_id FOR UPDATE;
        ELSE
            SELECT Wallet_ID INTO payee_wallet_id FROM MERCHANT WHERE Merchant_ID = p_receiver_entity_id FOR UPDATE;
        END IF;

        IF payee_wallet_id IS NULL THEN
            -- Payee wallet not found, insert failure and exit
            INSERT INTO PAYMENT (User_ID, Receiver_Type, Receiver_Entity_ID, Amount, Status, Transaction_Hash, Method_ID)
            VALUES (p_from_user_id, p_receiver_type, p_receiver_entity_id, p_amount, 'Failed', p_txn_hash, v_method_id);
            SET new_txn_id = LAST_INSERT_ID();
            INSERT INTO PAYMENT_HISTORY (Transaction_ID, Description) VALUES (new_txn_id, p_description);
            COMMIT;
            SELECT new_txn_id AS Transaction_ID, 'Failed' AS Status, 'Payee Wallet Not Found' AS Note;
        ELSE
            -- Both wallets found, now check balance
            IF payer_balance >= p_amount THEN
                -- Success case
                INSERT INTO PAYMENT (User_ID, Receiver_Type, Receiver_Entity_ID, Amount, Status, Transaction_Hash, Method_ID)
                VALUES (p_from_user_id, p_receiver_type, p_receiver_entity_id, p_amount, 'Pending', p_txn_hash, v_method_id);
                SET new_txn_id = LAST_INSERT_ID();

                UPDATE WALLET SET Balance = Balance - p_amount, Last_update = CURRENT_TIMESTAMP WHERE Wallet_ID = payer_wallet_id;
                INSERT INTO WALLET_TRANSACTIONS (Wallet_ID, Txn_Type, Amount, Related_Payment_ID, Remarks)
                VALUES (payer_wallet_id, 'DEBIT', p_amount, new_txn_id, CONCAT('Payment Txn ', new_txn_id));

                UPDATE WALLET SET Balance = Balance + p_amount, Last_update = CURRENT_TIMESTAMP WHERE Wallet_ID = payee_wallet_id;
                INSERT INTO WALLET_TRANSACTIONS (Wallet_ID, Txn_Type, Amount, Related_Payment_ID, Remarks)
                VALUES (payee_wallet_id, 'CREDIT', p_amount, new_txn_id, CONCAT('Payment Txn ', new_txn_id));

                UPDATE PAYMENT SET Status = 'Success' WHERE Transaction_ID = new_txn_id;
                INSERT INTO PAYMENT_HISTORY (Transaction_ID, Description) VALUES (new_txn_id, p_description);
                INSERT INTO NOTIFICATION (User_ID, Message, Status) VALUES (p_from_user_id, CONCAT('Payment of ₹', p_amount, ' was successful. Txn ID: ', new_txn_id), 'Unread');

                COMMIT;
                SELECT new_txn_id AS Transaction_ID, 'Success' AS Status;
            ELSE
                -- Insufficient funds case
                INSERT INTO PAYMENT (User_ID, Receiver_Type, Receiver_Entity_ID, Amount, Status, Transaction_Hash, Method_ID)
                VALUES (p_from_user_id, p_receiver_type, p_receiver_entity_id, p_amount, 'Failed', p_txn_hash, v_method_id);
                SET new_txn_id = LAST_INSERT_ID();
                INSERT INTO PAYMENT_HISTORY (Transaction_ID, Description) VALUES (new_txn_id, p_description);
                COMMIT;
                SELECT new_txn_id AS Transaction_ID, 'Failed' AS Status;
            END IF;
        END IF;
    END IF;

END$$
DELIMITER ;
-- *** END OF CORRECTED MakePayment PROCEDURE ***


DROP PROCEDURE IF EXISTS ProcessRefund;
DELIMITER $$
CREATE PROCEDURE ProcessRefund (
    IN p_refund_id INT
)
BEGIN
    DECLARE v_txn_id INT;
    DECLARE v_merchant_id INT;
    DECLARE v_refund_amount DECIMAL(18,2);
    DECLARE v_user_id INT;
    DECLARE v_user_wallet_id INT;
    DECLARE v_merchant_wallet_id INT;
    DECLARE v_payment_status VARCHAR(20);
    DECLARE v_merchant_balance DECIMAL(18,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        UPDATE REFUND_TICKET SET Status = 'Failed', Attempts = Attempts + 1 WHERE Refund_ID = p_refund_id;
    END;

    START TRANSACTION;

    SELECT Transaction_ID, Merchant_ID INTO v_txn_id, v_merchant_id
    FROM REFUND_TICKET WHERE Refund_ID = p_refund_id FOR UPDATE;

    IF v_txn_id IS NULL THEN
        ROLLBACK;
        LEAVE ProcessRefund; -- Exit if refund ticket doesn't exist
    END IF;

    SELECT Amount, User_ID INTO v_refund_amount, v_user_id
    FROM PAYMENT WHERE Transaction_ID = v_txn_id FOR UPDATE;

    SELECT Wallet_ID INTO v_user_wallet_id FROM WALLET WHERE User_ID = v_user_id FOR UPDATE;
    SELECT Wallet_ID INTO v_merchant_wallet_id FROM MERCHANT WHERE Merchant_ID = v_merchant_id FOR UPDATE;

    IF v_user_wallet_id IS NULL OR v_merchant_wallet_id IS NULL THEN
        UPDATE REFUND_TICKET SET Status='Failed', Attempts = Attempts + 1 WHERE Refund_ID = p_refund_id;
        COMMIT;
        LEAVE ProcessRefund; -- Exit if wallets don't exist
    END IF;

    SELECT Balance INTO v_merchant_balance FROM WALLET WHERE Wallet_ID = v_merchant_wallet_id FOR UPDATE;

    IF v_merchant_balance >= v_refund_amount THEN
        UPDATE WALLET SET Balance = Balance - v_refund_amount, Last_update = CURRENT_TIMESTAMP WHERE Wallet_ID = v_merchant_wallet_id;
        INSERT INTO WALLET_TRANSACTIONS (Wallet_ID, Txn_Type, Amount, Related_Refund_ID, Remarks)
        VALUES (v_merchant_wallet_id, 'DEBIT', v_refund_amount, p_refund_id, CONCAT('Refund Refund_ID ', p_refund_id));

        UPDATE PAYMENT SET Status = 'Refunded' WHERE Transaction_ID = v_txn_id;

        UPDATE WALLET SET Balance = Balance + v_refund_amount, Last_update = CURRENT_TIMESTAMP WHERE Wallet_ID = v_user_wallet_id;
        INSERT INTO WALLET_TRANSACTIONS (Wallet_ID, Txn_Type, Amount, Related_Refund_ID, Remarks)
        VALUES (v_user_wallet_id, 'CREDIT', v_refund_amount, p_refund_id, CONCAT('Refund Refund_ID ', p_refund_id));

        UPDATE REFUND_TICKET SET Status = 'Resolved', Process_Date = CURRENT_TIMESTAMP WHERE Refund_ID = p_refund_id;

        INSERT INTO NOTIFICATION (User_ID, Message, Status)
        VALUES (v_user_id, CONCAT('Refund of ₹', v_refund_amount, ' for Txn ', v_txn_id, ' has been credited.'), 'Unread');

        COMMIT;
        SELECT 'OK' AS Result, p_refund_id AS Refund_ID;
    ELSE
        UPDATE REFUND_TICKET SET Status = 'Processing', Attempts = Attempts + 1 WHERE Refund_ID = p_refund_id;
        COMMIT;
        SELECT 'RETRY' AS Result, p_refund_id AS Refund_ID, v_merchant_balance AS Merchant_Balance;
    END IF;

END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS CreateRefundTicketAndProcess;
DELIMITER $$
CREATE PROCEDURE CreateRefundTicketAndProcess (
    IN p_transaction_id INT,
    IN p_merchant_id INT,
    IN p_reason VARCHAR(255)
)
BEGIN
    DECLARE v_new_refund_id INT;

    START TRANSACTION;
    INSERT INTO REFUND_TICKET (Transaction_ID, Merchant_ID, Reason, Status, Attempts)
    VALUES (p_transaction_id, p_merchant_id, p_reason, 'Pending', 0);
    SET v_new_refund_id = LAST_INSERT_ID();
    COMMIT;

    CALL ProcessRefund(v_new_refund_id);
END$$
DELIMITER ;

-- ======================================================================
-- 8. SCHEDULED EVENTS
-- ======================================================================

DROP EVENT IF EXISTS ExpireRewardsEvent;
DELIMITER $$
CREATE EVENT ExpireRewardsEvent
ON SCHEDULE EVERY 1 DAY STARTS CURRENT_TIMESTAMP
DO
BEGIN
    UPDATE REWARDS
    SET Is_Expired = 1
    WHERE Expiry_Date IS NOT NULL AND Expiry_Date < CURRENT_DATE() AND Is_Expired = 0;
END$$
DELIMITER ;

DROP EVENT IF EXISTS RetryPendingRefundsEvent;
DELIMITER $$
CREATE EVENT RetryPendingRefundsEvent
ON SCHEDULE EVERY 1 HOUR STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE r_refund_id INT;
    DECLARE cur CURSOR FOR SELECT Refund_ID FROM REFUND_TICKET WHERE Status IN ('Processing','Pending') AND Attempts < 5;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO r_refund_id;
        IF done = 1 THEN
            LEAVE read_loop;
        END IF;
        CALL ProcessRefund(r_refund_id);
    END LOOP;
    CLOSE cur;
END$$
DELIMITER ;

-- Enable the Event Scheduler if it's not already enabled
SET GLOBAL event_scheduler = ON;

-- ======================================================================
-- END OF FILE
-- ======================================================================
```

**After saving the new `.sql` file:**

1.  **Drop** your `WalletSystem` database in Workbench.
2.  Run the **entire new** `wallet_system_complete.sql` script (File > Run SQL Script...).
3.  Run the **`sampleSignup` command** again to add your Test User:
    ```bash
    cd path/to/wallet-backend
    node src/controllers/authController.js
    ```
4.  Run the **Add Merchants SQL script** again to add the sample merchants:
    ```sql
    -- In Workbench:
    USE WalletSystem;
    INSERT INTO WALLET (User_ID, Balance) VALUES (NULL, 10000.00), (NULL, 8000.00), (NULL, 4000.00), (NULL, 3000.00), (NULL, 5000.00);
    INSERT INTO MERCHANT (Name, Business_Type, Email, Phn_No, Address, Wallet_ID) VALUES
    ('Amazon India','E-Commerce','support@amazon.in','01123456789','Bangalore, India', (SELECT Wallet_ID FROM WALLET WHERE User_ID IS NULL ORDER BY Wallet_ID DESC LIMIT 1 OFFSET 4)),
    ('Flipkart','Retail','care@flipkart.com','02233445566','Mumbai, India', (SELECT Wallet_ID FROM WALLET WHERE User_ID IS NULL ORDER BY Wallet_ID DESC LIMIT 1 OFFSET 3)),
    ('Zomato','Food Delivery','help@zomato.com','0801234567','Gurgaon, India', (SELECT Wallet_ID FROM WALLET WHERE User_ID IS NULL ORDER BY Wallet_ID DESC LIMIT 1 OFFSET 2)),
    ('Swiggy','Food Delivery','support@swiggy.com','0807654321','Bangalore, India', (SELECT Wallet_ID FROM WALLET WHERE User_ID IS NULL ORDER BY Wallet_ID DESC LIMIT 1 OFFSET 1)),
    ('Myntra','Fashion','care@myntra.com','08033445577','Bangalore, India', (SELECT Wallet_ID FROM WALLET WHERE User_ID IS NULL ORDER BY Wallet_ID DESC LIMIT 1 OFFSET 0));
    

