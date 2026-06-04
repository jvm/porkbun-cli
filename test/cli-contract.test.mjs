import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import test from "node:test";
import { OPERATIONS } from "../dist/lib/operations.js";

const exec = promisify(execFile);
const cli = new URL("../dist/cli.js", import.meta.url).pathname;

test("operation registry covers every OpenAPI operationId", async () => {
  const spec = JSON.parse(await readFile(new URL("../dist/generated/openapi.json", import.meta.url), "utf8"));
  const expected = [];
  for (const pathItem of Object.values(spec.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      if (pathItem[method]?.operationId) expected.push(pathItem[method].operationId);
    }
  }
  const actual = new Set(OPERATIONS.map((operation) => operation.operationId));
  assert.deepEqual(expected.filter((operationId) => !actual.has(operationId)), []);
});

test("schema command emits parseable clispec-compatible JSON", async () => {
  const { stdout } = await exec(process.execPath, [cli, "schema"]);
  const schema = JSON.parse(stdout);
  assert.equal(schema.clispec, "0.1");
  assert.equal(schema.name, "porkbun");
  assert.ok(schema.commands.find((command) => command.name === "domains"));
  assert.ok(schema.errors.find((error) => error.kind === "rate_limit"));
});

test("CLI defaults to JSON when piped and can call a local API server", async () => {
  const server = createServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/ip");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ status: "SUCCESS", yourIp: "203.0.113.10" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const { stdout } = await exec(process.execPath, [cli, "--base-url", `http://127.0.0.1:${port}`, "ip", "get"]);
    assert.deepEqual(JSON.parse(stdout), { status: "SUCCESS", yourIp: "203.0.113.10" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("non-TTY mutations require --yes unless dry-run is used", async () => {
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
    "yes"
  ]);
  assert.equal(result.code, 2);
  assert.equal(JSON.parse(result.stderr).error.kind, "usage");
});

function execFileResult(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}
