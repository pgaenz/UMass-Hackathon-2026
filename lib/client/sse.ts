export interface ClientSseEvent {
  event: string;
  data: unknown;
}

/** Parses an SSE response body from fetch (EventSource cannot POST). */
export async function consumeSse(
  response: Response,
  onEvent: (event: ClientSseEvent) => void | Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error("The server returned an empty response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException("Request aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await dispatchBlock(block, onEvent);
        boundary = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      await dispatchBlock(buffer, onEvent);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Already closed.
    }
  }
}

async function dispatchBlock(
  block: string,
  onEvent: (event: ClientSseEvent) => void | Promise<void>,
): Promise<void> {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return;
  }

  const raw = dataLines.join("\n");
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    // Keep the raw payload for non-JSON events.
  }

  await onEvent({ event, data });
}
