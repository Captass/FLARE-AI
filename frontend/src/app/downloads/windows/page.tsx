import type { Metadata } from "next";
import NativeReleaseRedirectPage from "../_components/NativeReleaseRedirectPage";

export const metadata: Metadata = {
  title: "Download Windows | FLARE AI",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WindowsDownloadPage() {
  return <NativeReleaseRedirectPage platform="windows" />;
}

