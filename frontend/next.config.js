/** @type {import('next').NextConfig} */
const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig = {
  images: { unoptimized: true },
  ...(isProductionBuild ? { output: "export" } : {}),
};
module.exports = nextConfig;
