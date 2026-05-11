import urllib.request
import urllib.parse

# Pollinations uses GET: https://text.pollinations.ai/{prompt}
prompt = "Describe a futuristic city in 1 sentence."
# Double encode the prompt because it goes into a query param which goes into another query param
encoded_prompt = urllib.parse.quote(prompt)
target_url = f"https://text.pollinations.ai/{encoded_prompt}"
encoded_target = urllib.parse.quote(target_url)

url = f"http://localhost:8081/proxy?url={encoded_target}"

print(f"Testing URL: {url}")

try:
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}")
        print(resp.read().decode())
except Exception as e:
    print(f"Error: {e}")
