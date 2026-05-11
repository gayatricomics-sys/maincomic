import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://localhost:8082"

def test_flow():
    print("1. Testing Login...")
    try:
        login_data = json.dumps({
            "email": "test@example.com",
            "password": "password123"
        }).encode('utf-8')
        
        req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as res:
            print(f"Login Status: {res.status}")
            body = res.read().decode('utf-8')
            print(f"Login Response: {body}")
            
            data = json.loads(body)
            token = data['token']
            print(f"Token: {token}")

        print("\n2. Testing /api/user/me...")
        req = urllib.request.Request(f"{BASE_URL}/api/user/me", headers={
            "Authorization": f"Bearer {token}"
        })
        with urllib.request.urlopen(req) as res:
            print(f"Profile Status: {res.status}")
            print(f"Profile Response: {res.read().decode('utf-8')}")

        print("\n3. Testing /api/comics/list...")
        req = urllib.request.Request(f"{BASE_URL}/api/comics/list", headers={
            "Authorization": f"Bearer {token}"
        })
        with urllib.request.urlopen(req) as res:
            print(f"Comics List Status: {res.status}")
            print(f"Comics List Response: {res.read().decode('utf-8')}")

    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_flow()

