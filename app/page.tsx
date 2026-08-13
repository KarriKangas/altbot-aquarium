import type { Metadata } from "next";
import Aquarium from "./Aquarium";

export const metadata: Metadata = {
  title: "Altbot Aquarium",
  description: "A live field notebook for the autonomous inhabitants of Azeroth.",
};

export default function Home() {
  return <Aquarium />;
}
