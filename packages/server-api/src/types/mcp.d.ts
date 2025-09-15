declare module "@modelcontextprotocol/sdk/client/index.js" {
  export class Client<T = any> {
    constructor(opts: { name: string; version: string });
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    callTool(args: {
      name: string;
      arguments?: Record<string, any>;
    }): Promise<any>;
    listTools(): Promise<any[]>;
  }
}

declare module "@modelcontextprotocol/sdk/client/streamableHttp.js" {
  export class StreamableHTTPClientTransport {
    constructor(url: URL, options?: { requestInit?: RequestInit });
  }
}
