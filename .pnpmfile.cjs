// @ts-check

/**
 * `@prisma/client` declares the Prisma CLI as an optional peer. pnpm satisfies it
 * from the CLI we keep as a devDependency, which drags the whole CLI (Studio, PGlite,
 * Effect… ~300 MB) into the production dependency tree and the runtime image. The
 * generated client doesn't need the CLI at runtime, so the peer is dropped here.
 *
 * @param {Record<string, any>} pkg
 */
function readPackage(pkg) {
  if (pkg.name === '@prisma/client') {
    delete pkg.peerDependencies?.prisma
    delete pkg.peerDependenciesMeta?.prisma
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
