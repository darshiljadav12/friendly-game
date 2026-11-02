import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// Next.js blocks dev-server requests from other origins. Allow this PC's own LAN
// addresses so a phone on the same Wi-Fi can open http://<pc-ip>:3001 during development.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

const nextConfig: NextConfig = {
  // plus common tunnel hosts, for testing on a phone that isn't on the same Wi-Fi
  allowedDevOrigins: [...lanAddresses, "*.devtunnels.ms", "*.trycloudflare.com", "*.ngrok-free.app"],
};

export default nextConfig;
