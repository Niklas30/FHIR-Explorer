type TarEntry = {
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

export const gunzip = async (buffer: ArrayBuffer): Promise<Uint8Array> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser does not support gzip decompression.");
  }

  const stream = new DecompressionStream("gzip");
  const decompressedStream = new Blob([buffer]).stream().pipeThrough(stream);
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
};

export const parseTar = (buffer: Uint8Array, options: TarParseOptions) => {
  const { onEntry, onProgress } = options;
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const name = readString(header, 0, 100);
    if (!name) break;

    const size = parseOctal(readString(header, 124, 12));
    const typeflag = readString(header, 156, 1);

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (dataEnd > buffer.length) {
      throw new Error("Corrupt tar archive (unexpected end of file).");
    }

    const data = buffer.subarray(dataStart, dataEnd);
    onEntry({ name, size, typeflag, data });

    const nextOffset = dataStart + Math.ceil(size / 512) * 512;
    offset = nextOffset;

    if (onProgress) {
      onProgress(Math.min(1, offset / buffer.length));
    }
  }
};
