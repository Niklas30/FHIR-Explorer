export type TarEntry = {
  name: string;
  size: number;
  typeflag: string;
  data: Uint8Array;
};

type TarParseOptions = {
  onEntry: (entry: TarEntry) => void;
  onProgress?: (progress: number) => void;
};

const textDecoder = new TextDecoder();

const readString = (buffer: Uint8Array, start: number, length: number) => {
  const slice = buffer.subarray(start, start + length);
  const text = textDecoder.decode(slice);
  return text.replace(/\0.*$/, "").trim();
};

const parseOctal = (value: string) => {
  const trimmed = value.replace(/\0/g, "").trim();
  return trimmed ? parseInt(trimmed, 8) : 0;
};

export const gunzip = async (buffer: ArrayBuffer | Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser does not support gzip decompression.");
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const stream = new DecompressionStream("gzip");
  const decompressedStream = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
};

/** Extracts the `path=` override from a PAX extended header payload. */
const readPaxPath = (data: Uint8Array): string | undefined => {
  const text = textDecoder.decode(data);
  let offset = 0;
  while (offset < text.length) {
    const spaceIndex = text.indexOf(" ", offset);
    if (spaceIndex === -1) return undefined;
    const recordLength = Number(text.slice(offset, spaceIndex));
    if (!Number.isFinite(recordLength) || recordLength <= 0) return undefined;
    const record = text.slice(spaceIndex + 1, offset + recordLength);
    if (record.startsWith("path=")) {
      return record.slice("path=".length).replace(/\n$/, "");
    }
    offset += recordLength;
  }
  return undefined;
};

/**
 * Minimal USTAR/PAX/GNU tar reader. Handles the header variants real-world
 * FHIR packages use: USTAR prefix fields for long paths, GNU "L" long-name
 * entries and PAX extended headers (path override; other records ignored).
 */
export const parseTar = (buffer: Uint8Array, options: TarParseOptions) => {
  const { onEntry, onProgress } = options;
  let offset = 0;
  // Name override from a preceding GNU longname / PAX header entry.
  let pendingName: string | undefined;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const name = readString(header, 0, 100);
    if (!name) break;

    const size = parseOctal(readString(header, 124, 12));
    const typeflag = readString(header, 156, 1);
    const prefix = readString(header, 345, 155);

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (dataEnd > buffer.length) {
      throw new Error("Corrupt tar archive (unexpected end of file).");
    }

    const data = buffer.subarray(dataStart, dataEnd);

    if (typeflag === "L") {
      // GNU longname: the payload is the name of the NEXT entry.
      pendingName = readString(data, 0, data.length);
    } else if (typeflag === "x" || typeflag === "X") {
      // PAX extended header for the next entry: honor path overrides.
      pendingName = readPaxPath(data) ?? pendingName;
    } else if (typeflag === "g") {
      // PAX global header: metadata only, no entry to emit.
    } else {
      const fullName = pendingName ?? (prefix ? `${prefix}/${name}` : name);
      pendingName = undefined;
      onEntry({ name: fullName, size, typeflag, data });
    }

    offset = dataStart + Math.ceil(size / 512) * 512;

    if (onProgress) {
      onProgress(Math.min(1, offset / buffer.length));
    }
  }
};
