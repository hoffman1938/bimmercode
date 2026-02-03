// Хешируем пароль с помощью SHA-256 (для скорости на Edge)
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Проверка пароля (сравниваем хеши)
export async function verifyPassword(password, storedHash) {
  const newHash = await hashPassword(password);
  return newHash === storedHash;
}
