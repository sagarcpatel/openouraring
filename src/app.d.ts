declare global {
  namespace App {
    interface Platform {
      env: Record<string, never>;
      context: ExecutionContext;
    }
  }
}

export {};
