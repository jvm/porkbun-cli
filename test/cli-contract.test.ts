import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { OPERATIONS } from "../src/lib/operations.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const here = fileURLToPath(new URL(".", import.meta.url));
const cli = join(here, "..", "dist", "cli.js");
const openapiSpec = join(here, "..", "dist", "generated", "openapi.json");

describe("cli-contract", () => {
  it("operation registry covers every OpenAPI operationId", async () => {
    const spec = JSON.parse(await readFile(openapiSpec, "utf8"));
    const expected: string[] = [];
    for (const pathItem of Object.values(spec.paths)) {
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        if (pathItem[method]?.operationId) expected.push(pathItem[method].operationId);
      }
    }
    const actual = new Set(OPERATIONS.map((operation) => operation.operationId));
    expect(expected.filter((operationId) => !actual.has(operationId))).toEqual([]);
  });

  it("schema command emits parseable clispec-compatible JSON", async () => {
    const { stdout } = await exec(process.execPath, [cli, "schema"]);
    const schema = JSON.parse(stdout);
    expect(schema.clispec).toEqual("0.1");
    expect(schema.name).toEqual("porkbun");
    expect(schema.commands.find((command: any) => command.name === "domains")).toBeTruthy();
    expect(schema.errors.find((error: any) => error.kind === "rate_limit")).toBeTruthy();
  });

  it("CLI defaults to JSON when piped and can call a local API server", async () => {
    const server = createServer((request, response) => {
      expect(request.method).toEqual("GET");
      expect(request.url).toEqual("/ip");
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: "SUCCESS", yourIp: "203.0.113.10" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as { port: number };
      const { stdout } = await exec(process.execPath, [
        cli,
        "--base-url",
        `http://127.0.0.1:${port}`,
        "ip",
        "get",
      ]);
      expect(JSON.parse(stdout)).toEqual({ status: "SUCCESS", yourIp: "203.0.113.10" });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("non-TTY mutations require --yes unless dry-run is used", async () => {
    const result = await execFileResult(process.execPath, [
      cli,
      "--api-key",
      "pk",
      "--secret-api-key",
      "sk",
      "domains",
      "register",
      "example.com",
      "--cost",
      "973",
      "--agree-to-terms",
      "yes",
    ]);
    expect(result.code).toEqual(2);
    expect(JSON.parse(result.stderr).error.kind).toEqual("usage");
  });
});

function execFileResult(
  file: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}
