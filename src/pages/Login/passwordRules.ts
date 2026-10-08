export const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export type PasswordStrength = { score: number; label: string; color: string };

export function checkPasswordStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Débil", color: "#dc2626" };
  if (score <= 2) return { score, label: "Media", color: "#ea580c" };
  if (score <= 3) return { score, label: "Buena", color: "#ca8a04" };
  if (score <= 4) return { score, label: "Fuerte", color: "#16a34a" };
  return { score, label: "Muy fuerte", color: "#15803d" };
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "La contraseña debe incluir mayúsculas y minúsculas";
  }
  if (!/\d/.test(password)) return "La contraseña debe incluir al menos un número";
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un carácter especial (!@#$%...)";
  }
  return null;
}