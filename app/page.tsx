import type { Metadata } from "next";
import Link from "next/link";
import Aquarium from "./Aquarium";

export const metadata: Metadata = {
  title: "Altbot Aquarium",
  description: "A live field notebook for the autonomous inhabitants of Azeroth.",
};

export default function Home() {
  return (
    <>
      <Link
        href="/runs"
        style={{
          position: "fixed",
          zIndex: 50,
          right: 24,
          bottom: 24,
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid rgba(130,183,173,.35)",
          background: "rgba(10,24,27,.94)",
          color: "#d8eee9",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 8px 30px rgba(0,0,0,.3)",
        }}
      >
        Runs →
      </Link>
      <Aquarium />
    </>
  );
}
