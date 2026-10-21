const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export type SseSend = (event: string, data: unknown) => void;

/**
 * Wraps an async streaming handler in an SSE response. The handler receives a
 * send function and an abort signal tied to the client connection.
 */
export function sseResponse(
  requestSignal: AbortSignal,
  handler: (send: SseSend, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();

  const onRequestAbort = () => abort.abort();
  if (requestSignal.aborted) {
    abort.abort();
  } else {
    requestSignal.addEventListener("abort", onRequestAbort, { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: SseSend = (event, data) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await handler(send, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) {
          const message = err instanceof Error ? err.message : "Conversation failed";
          try {
            send("error", { error: message });
          } catch {
            // The client may have disconnected while we were handling the error.
          }
        }
      } finally {
        requestSignal.removeEventListener("abort", onRequestAbort);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
    cancel() {
      abort.abort();
      requestSignal.removeEventListener("abort", onRequestAbort);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
