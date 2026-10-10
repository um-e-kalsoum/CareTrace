declare module "snowflake-sdk" {
  interface SnowflakeConnection {
    connect(callback: (error: Error | undefined, connection: SnowflakeConnection) => void): void;
    execute(options: {
      sqlText: string;
      binds?: Array<string | number | boolean | null>;
      complete: (error: Error | undefined, statement: unknown, rows: Record<string, unknown>[] | undefined) => void;
    }): void;
  }
  const snowflake: {
    createConnection(options: {
      account: string;
      username: string;
      authenticator: string;
      token?: string;
      password?: string;
      warehouse: string;
      database: string;
      schema: string;
      role?: string;
      application?: string;
    }): SnowflakeConnection;
  };
  export default snowflake;
}
