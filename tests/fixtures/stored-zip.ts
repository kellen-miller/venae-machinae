export function readStoredZipEntries(bytes: Buffer): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;

  while (offset <= bytes.length - 30 && bytes.readUInt32LE(offset) === 0x04034b50) {
    const compression = bytes.readUInt16LE(offset + 8);
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    if (compression !== 0) throw new Error('Expected an uncompressed deterministic ZIP entry');

    const nameStart = offset + 30;
    const contentsStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, bytes.subarray(contentsStart, contentsStart + size).toString('utf8'));
    offset = contentsStart + size;
  }

  return entries;
}
