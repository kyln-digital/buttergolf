"use client";

import { useState, FormEvent } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email?.includes("@")) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (status === "success") {
    return (
      <div
        style={{
          marginTop: "32px",
          padding: "20px 32px",
          backgroundColor: "rgba(255, 250, 210, 0.15)",
          borderRadius: "12px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            display: "block",
            fontFamily:
              'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: "18px",
            fontWeight: 600,
            color: "#FFFAD2",
          }}
        >
          🎉 You&apos;re on the list!
        </span>
        <span
          style={{
            display: "block",
            fontFamily:
              'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: "14px",
            fontWeight: 400,
            color: "rgba(255, 250, 210, 0.85)",
          }}
        >
          We&apos;ll let you know when we launch.
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: "32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        maxWidth: "400px",
      }}
    >
      <p
        style={{
          fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "16px",
          fontWeight: 500,
          color: "#FFFAD2",
          margin: "0 0 4px 0",
          textAlign: "center",
        }}
      >
        Join the waitlist for early access
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "8px",
          width: "100%",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "submitting"}
          style={{
            flex: "1 1 240px",
            minWidth: "200px",
            maxWidth: "300px",
            padding: "14px 20px",
            fontSize: "16px",
            fontFamily:
              'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 500,
            color: "#3E3B2C", // Burnt Olive
            backgroundColor: "#FFFAD2", // Vanilla Cream
            border: "none",
            borderRadius: "9999px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={status === "submitting"}
          style={{
            padding: "14px 28px",
            fontSize: "16px",
            fontFamily:
              'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 600,
            color: "#F45314", // Spiced Clementine
            backgroundColor: "#FFFAD2", // Vanilla Cream
            border: "none",
            borderRadius: "9999px",
            cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.7 : 1,
            transition: "transform 0.15s ease, opacity 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          {status === "submitting" ? "Joining..." : "Join Waitlist"}
        </button>
      </div>

      {status === "error" && errorMessage && (
        <p
          style={{
            fontFamily:
              'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: "14px",
            fontWeight: 500,
            color: "#FFFAD2",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            padding: "8px 16px",
            borderRadius: "8px",
            margin: 0,
          }}
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}
