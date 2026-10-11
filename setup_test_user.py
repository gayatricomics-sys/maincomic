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
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                 email TEXT PRIMARY KEY,
                 username TEXT,
                 password_hash TEXT,
                 salt TEXT,
                 role TEXT DEFAULT "user",
                 credits INTEGER DEFAULT 0,
                 created_at REAL
                 )''')
    try: c.execute("ALTER TABLE users ADD COLUMN username TEXT")
    except: pass
    
    # 1. Admin user: gayatricomics-sys
    admin_uname = "gayatricomics-sys"
    admin_email = "gayathri5670@gmail.com"
    admin_pass = "admin123"
    salt = secrets.token_hex(16)
    pw_hash = hash_password(admin_pass, salt)
    
    c.execute("SELECT * FROM users WHERE username = ? OR email = ?", (admin_uname, admin_email))
    if c.fetchone():
        print("Updating gayatricomics-sys admin user...")
        c.execute("UPDATE users SET username = ?, password_hash = ?, salt = ?, role = 'admin', credits = 9999 WHERE username = ? OR email = ?",
                  (admin_uname, pw_hash, salt, admin_uname, admin_email))
    else:
        print("Creating gayatricomics-sys admin user...")
        c.execute("INSERT INTO users (email, username, password_hash, salt, role, credits, created_at) VALUES (?, ?, ?, ?, 'admin', 9999, ?)",
                  (admin_email, admin_uname, pw_hash, salt, time.time()))

    # 2. Test user: test@example.com
    email = "test@example.com"
    password = "password123"
    test_uname = "testuser"
    salt2 = secrets.token_hex(16)
    pw_hash2 = hash_password(password, salt2)
    c.execute("SELECT * FROM users WHERE email = ?", (email,))
    if c.fetchone():
        c.execute("UPDATE users SET username = ?, password_hash = ?, salt = ?, credits = 100 WHERE email = ?", (test_uname, pw_hash2, salt2, email))
    else:
        c.execute("INSERT INTO users (email, username, password_hash, salt, role, credits, created_at) VALUES (?, ?, ?, ?, 'user', 100, ?)",
                  (email, test_uname, pw_hash2, salt2, time.time()))
    
    conn.commit()
    conn.close()
    print("Users setup complete: 'gayatricomics-sys' (admin) and 'testuser' (user).")

if __name__ == '__main__':
    setup_user()
