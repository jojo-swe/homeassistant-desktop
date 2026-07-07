declare module 'bonjour-service' {
  interface Service {
    name: string;
    type: string;
    port: number;
    host: string;
    addresses: string[];
    txt?: Record<string, string>;
  }

  export class Bonjour {
    find(opts: Record<string, unknown>, cb: (service: Service) => void): void;
    destroy(): void;
  }
}
