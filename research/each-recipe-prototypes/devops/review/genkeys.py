import base64, hashlib, json
from cryptography.hazmat.primitives.asymmetric import ed25519, ec, rsa
from cryptography.hazmat.primitives import serialization as s
keys = []
seed = bytes(range(32))
keys.append(ed25519.Ed25519PrivateKey.from_private_bytes(seed))
for curve, d in [(ec.SECP256R1(), 12345), (ec.SECP384R1(), 67890), (ec.SECP521R1(), 13579)]:
    keys.append(ec.derive_private_key(d, curve))
keys.append(rsa.generate_private_key(65537, 4096))
keys.append(rsa.generate_private_key(3, 1024))
out = []
for k in keys:
    line = k.public_key().public_bytes(s.Encoding.OpenSSH, s.PublicFormat.OpenSSH).decode()
    blob = base64.b64decode(line.split()[1])
    fp = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
    out.append({'line': line, 'fp': fp})
# RFC4716 (PuTTY export) of the ed25519
r = keys[0].public_key().public_bytes(s.Encoding.OpenSSH, s.PublicFormat.OpenSSH).decode().split()[1]
rfc = '---- BEGIN SSH2 PUBLIC KEY ----\nComment: "eddsa-key-20261007"\n' + '\n'.join(r[i:i+70] for i in range(0, len(r), 70)) + '\n---- END SSH2 PUBLIC KEY ----\n'
json.dump({'keys': out, 'rfc4716': rfc}, open('keys.json', 'w'), indent=1)
print(json.dumps(out, indent=1)[:3000])
