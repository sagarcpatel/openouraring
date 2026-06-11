declare global {
  namespace App {
    interface Platform {
      env: {
        OURA_DATA: R2Bucket;
      };
      context: ExecutionContext;
    }
  }
}

export {};
