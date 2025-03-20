import { prisma } from "@repo/db";
import { myTask } from "./api/actions";

export default async function Home() {
  const user = await prisma.user.findFirst();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
        textAlign: "center",
        backgroundColor: "#1a1a1a",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      <h2
        style={{
          marginBottom: "10px",
          color: "white",
          fontSize: "28px",
          fontWeight: "600",
          letterSpacing: "-0.025em",
        }}
      >
        Last user added
      </h2>
      <p
        style={{
          marginBottom: "30px",
          fontSize: "20px",
          color: "white",
          opacity: "0.9",
          fontWeight: "400",
        }}
      >
        {user?.name ?? "No user added yet"}
      </p>
      <button
        onClick={myTask}
        style={{
          padding: "12px 24px",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "500",
          fontSize: "16px",
          boxShadow: "0 4px 14px rgba(0,112,243,0.4)",
          transition: "all 0.2s ease",
          fontFamily: "inherit",
        }}
      >
        Add new user
      </button>
    </div>
  );
}
