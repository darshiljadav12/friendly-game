import { ImageResponse } from "next/og";
import { HeartIcon } from "./icon";

// Home-screen icon for iPhone / iPad
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<HeartIcon size={180} />, size);
}
