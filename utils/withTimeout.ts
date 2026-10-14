/** Bound user-facing requests, including time spent waiting for an auth lock. */
export async function withTimeout<T>(
  operation: PromiseLike<T>,
  milliseconds: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
      onTimeout?.();
    }, milliseconds);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
