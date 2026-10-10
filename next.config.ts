import type { NextConfig } from "next";

// What the browser may receive: the project URL and the PUBLISHABLE key (public by design,
// limited by RLS). Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to
// use the standard names; otherwise the existing server variables are reused, so no new
// environment variable has to be configured.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

/** Stops the build if the value that would reach the browser is a secret/service-role key. */
function assertNotSecret(value: string | undefined) {
  if (!value) return;
  let isSecret = value.startsWith("sb_secret_");
  const parts = value.split(".");
  if (parts.length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      isSecret ||= claims.role === "service_role";
    } catch {
      // not a JWT: nothing more to check
    }
  }
  if (isSecret) {
    throw new Error("Refusing to build: a secret/service-role key was mapped to the browser.");
  }
}
assertNotSecret(url);
assertNotSecret(key);

/**
 * Content-Security-Policy in REPORT-ONLY mode: the browser lists what it would block in the console
 * (and sends nothing anywhere), so it can be tightened from real traffic before it is enforced.
 * Images are open to https because offers come from many store CDNs.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://www.clarity.ms https://scripts.clarity.ms",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://*.clarity.ms https://api.pwnedpasswords.com",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

export default nextConfig;
