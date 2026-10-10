import "server-only";
import snowflake from "snowflake-sdk";

type SnowflakeConnection = ReturnType<typeof snowflake.createConnection>;
let active: Promise<SnowflakeConnection> | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

async function getConnection(): Promise<SnowflakeConnection> {
  if (!active) {
    active = new Promise<SnowflakeConnection>((resolve, reject) => {
      const authenticator = process.env.SNOWFLAKE_AUTHENTICATOR || "PROGRAMMATIC_ACCESS_TOKEN";
      const options = {
        account: required("SNOWFLAKE_ACCOUNT"),
        username: required("SNOWFLAKE_USER"),
        authenticator,
        warehouse: required("SNOWFLAKE_WAREHOUSE"),
        database: "CARETRACE",
        schema: "PUBLIC",
        role: process.env.SNOWFLAKE_ROLE || undefined,
        application: "CareTraceHackday",
        ...(authenticator === "PROGRAMMATIC_ACCESS_TOKEN"
          ? { token: required("SNOWFLAKE_TOKEN") }
          : authenticator === "SNOWFLAKE"
            ? { password: required("SNOWFLAKE_PASSWORD") }
            : {}),
      };
      const connection = snowflake.createConnection(options);
      connection.connect((err) => (err ? reject(err) : resolve(connection)));
    }).catch((err) => {
      active = undefined; // allow retry after failed authentication
      throw err;
    });
  }
  return active;
}

export async function runQuery(
  sqlText: string,
  binds: Array<string | number | boolean | null> = [],
): Promise<Record<string, unknown>[]> {
  const connection = await getConnection();
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _statement, rows) => {
        if (err) {
          // A disconnected connection should not remain cached.
          active = undefined;
          reject(err);
        } else {
          resolve(rows ?? []);
        }
      },
    });
  });
}
