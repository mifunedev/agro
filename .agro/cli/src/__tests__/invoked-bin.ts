export function withInvokedBin<T>(bin: string, fn: () => T): T {
  const previous = process.argv[1];
  process.argv[1] = `/usr/local/bin/${bin}`;
  try {
    return fn();
  } finally {
    process.argv[1] = previous;
  }
}

export async function withInvokedBinAsync<T>(bin: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.argv[1];
  process.argv[1] = `/usr/local/bin/${bin}`;
  try {
    return await fn();
  } finally {
    process.argv[1] = previous;
  }
}
