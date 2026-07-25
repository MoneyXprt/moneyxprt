import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled AFM font-metric files (e.g. Helvetica.afm) from disk via
  // fs.readFileSync relative to its own __dirname at runtime. If Next.js bundles it into
  // the server output, only the JS gets included — the AFM files are left behind, causing
  // ENOENT at request time. Marking it external leaves require('pdfkit') untouched so it
  // resolves the real node_modules/pdfkit directory (AFM files included) at runtime.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
