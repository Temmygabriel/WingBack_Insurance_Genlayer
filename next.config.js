const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("genlayer-js", "genlayer-js/chains", "genlayer-js/types");
    }
    return config;
  },
}
module.exports = nextConfig
