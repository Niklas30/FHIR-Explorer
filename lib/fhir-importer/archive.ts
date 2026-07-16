/**
 * Archive container detection for FHIR package imports.
 *
 * Packages arrive in different containers depending on where they were
 * downloaded: registries serve npm-style .tgz, browsers sometimes store
 * those pre-decompressed as plain .tar (transparent Content-Encoding
 * handling), and Simplifier/GitHub downloads are .zip. Detection is based
 * on magic bytes, never on file names — names lie ("*.tgz" holding a bare
 * tar is exactly the bug this guards against).
 */

export type ArchiveFormat = "gzip" | "zip" | "tar" | "unknown";

const GZIP_MAGIC = [0x1f, 0x8b] as const;

/** "PK" followed by one of the valid zip record signatures. */
const isZip = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[2] === 0x07 && bytes[3] === 0x08));

/** "ustar" magic at offset 257 (POSIX "ustar\0" or GNU "ustar "). */
const isTar = (bytes: Uint8Array) => {
  if (bytes.length < 512) return false;
  return (
    bytes[257] === 0x75 && // u
    bytes[258] === 0x73 && // s
    bytes[259] === 0x74 && // t
    bytes[260] === 0x61 && // a
    bytes[261] === 0x72 // r
  );
};

export const detectArchiveFormat = (bytes: Uint8Array): ArchiveFormat => {
  if (bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
    return "gzip";
  }
  if (isZip(bytes)) return "zip";
  if (isTar(bytes)) return "tar";
  return "unknown";
};
