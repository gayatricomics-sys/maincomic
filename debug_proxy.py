import urllib.request
import urllib.parse
import json
import ssl

BASE_URL = "http://localhost:8081"

def test_proxy():
    print("1. Testing Proxy for LLM (Text)...")
    target_url = "https://text.pollinations.ai/Describe%20a%20cute%20robot"
    proxy_url = f"{BASE_URL}/proxy?url={urllib.parse.quote(target_url)}"
    
    try:
        req = urllib.request.Request(proxy_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            print(f"LLM Status: {res.status}")
            print(f"LLM Content: {res.read().decode('utf-8')[:100]}...")
    except Exception as e:
        print(f"LLM Failed: {e}")

    print("\n2. Testing Proxy for Image (Validation)...")
    # Pollinations image URL (using specific prompt to get a real image)
    target_img_url = "https://image.pollinations.ai/prompt/robot?nologo=true"
    proxy_img_url = f"{BASE_URL}/proxy?url={urllib.parse.quote(target_img_url)}"
    
    try:
        req = urllib.request.Request(proxy_img_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            print(f"Image Status: {res.status}")
            print(f"Image Content-Type: {res.headers.get('Content-Type')}")
            # We don't print binary body
    except Exception as e:
        print(f"Image Failed: {e}")

if __name__ == "__main__":
    test_proxy()
