import { jwtVerify, SignJWT } from "jose";

const ADMIN_ROLE = "admin";
const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "bwm-attendance";
const JWT_AUDIENCE = "bwm-attendance-admin";

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(jwtSecret);
}

export async function createAdminToken() {
  return new SignJWT({ role: ADMIN_ROLE })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(ADMIN_ROLE)
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getJwtSecret());
}

export async function isValidAdminToken(token: string | undefined) {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: ADMIN_ROLE,
    });

    return payload.role === ADMIN_ROLE;
  } catch {
    return false;
  }
}
