import type { Metadata } from "next";
import NativeReleaseRedirectPage from "../_components/NativeReleaseRedirectPage";

export const metadata: Metadata = {
  title: "Download Android | FLARE AI",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AndroidDownloadPage() {
  return <NativeReleaseRedirectPage platform="android" />;
}

