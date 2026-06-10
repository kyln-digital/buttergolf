import Link from "next/link";

// Server component - must not import Tamagui (see project conventions).
export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        minHeight: "60vh",
        padding: 32,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 28, color: "#323232", margin: 0 }}>Page not found</h1>
      <p style={{ color: "#545454", margin: 0 }}>
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          backgroundColor: "#F45314",
          color: "#FFFFFF",
          padding: "12px 24px",
          borderRadius: 100,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
