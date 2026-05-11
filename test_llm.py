import urllib.request
import json

url = "http://localhost:8081/proxy?url=https%3A%2F%2Fapi-inference.huggingface.co%2Fmodels%2Fmicrosoft%2FPhi-3-mini-4k-instruct"
headers = {"Content-Type": "application/json"}
data = {
    "inputs": "Describe a robot."
}

try:
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}")
        print(resp.read().decode())
except Exception as e:
    print(f"Error: {e}")
