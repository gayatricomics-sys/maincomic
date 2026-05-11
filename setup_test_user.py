import sqlite3
import hashlib
import secrets
import time

DB_FILE = 'comic.db'

def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def setup_user():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    email = "test@example.com"
    password = "password123"
    salt = secrets.token_hex(16)
    pw_hash = hash_password(password, salt)
    
    # Check if exists
    c.execute("SELECT * FROM users WHERE email = ?", (email,))
    if c.fetchone():
        print("Updating existing user...")
        c.execute("UPDATE users SET password_hash = ?, salt = ?, credits = 100 WHERE email = ?", (pw_hash, salt, email))
    else:
        print("Creating new user...")
        c.execute("INSERT INTO users (email, password_hash, salt, role, credits, created_at) VALUES (?, ?, ?, 'user', 100, ?)",
                  (email, pw_hash, salt, time.time()))
    
    conn.commit()
    conn.close()
    print("Test user 'test@example.com' setup with 100 credits.")

if __name__ == "__main__":
    setup_user()
