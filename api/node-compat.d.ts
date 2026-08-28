// Minimal Node/Vercel type shims for the serverless API build.
// The Vercel runtime provides these globals at runtime; these declarations
// keep the frontend TypeScript build independent of @types/node auto-loading.
declare module 'http' {
  interface IncomingMessage {
    method?: string
  }

  interface ServerResponse {
    end: () => void
  }
}

declare const process: {
  env: Record<string, string | undefined>
}

declare const Buffer: {
  from(input: string): {
    toString(encoding: string): string
  }
}
