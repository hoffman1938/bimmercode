// functions/lib/jwt.js - Simple JWT implementation without external libraries

async function sign(text, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verify(text, signature, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    
    // Decode base64url signature back to raw bytes
    const binaryString = atob(signature.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return await crypto.subtle.verify(
        "HMAC", 
        key, 
        bytes, 
        encoder.encode(text)
    );
}

export async function generateToken(payload, secret, options = {}) {
  // Default to 24 hours if not specified
  const expiresIn = options.expiresIn || 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
    
  const encodedPayload = btoa(JSON.stringify(fullPayload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyToken(token, secret) {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const isValid = await verify(`${header}.${payload}`, signature, secret);
    
    if (!isValid) return null;
    
    try {
        const decodedPayload = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (decodedPayload.exp && decodedPayload.exp < now) {
            return null; // Expired
        }
        
        return decodedPayload;
    } catch (e) {
        return null;
    }
}
