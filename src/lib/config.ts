import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "./safe-io.js";
import { CliError } from "./errors.js";

export interface Credentials {
  apiKey: string;
  secretApiKey: string;
  source: "flags" | "env" | "profile";
  profile?: string;
}

export interface Profile {
  apiKey: string;
  secretApiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigFile {
  activeProfile?: string | undefined;
  profiles: Map<string, Profile>;
}

export interface CredentialInput {
  apiKey?: string | undefined;
  secretApiKey?: string | undefined;
  profile?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

const DEFAULT_PROFILE = "default";

export function configPath(): string {
  if (process.env.PORKBUN_CONFIG_FILE) return process.env.PORKBUN_CONFIG_FILE;
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "porkbun-cli", "config.json");
}

export async function readConfig(): Promise<ConfigFile> {
  const path = configPath();
  try {
    // Path comes from PORKBUN_CONFIG_FILE / XDG_CONFIG_HOME / ~/.config.
    // All three are operator-controlled environment, not attacker input.
    const contents = await readFile(path, "utf8");
    return parseConfig(JSON.parse(contents));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { profiles: new Map() };
    }
    throw new CliError({
      kind: "usage",
      message: `Failed to read config file at ${path}`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeConfig(config: ConfigFile): Promise<void> {
  const path = configPath();
  const directory = dirname(path);
  // The directory is derived from configPath() (operator-controlled env).
  // File modes 0700 / 0600 below are the security boundary.
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const tmpPath = `${path}.${process.pid}.tmp`;
  // JSON.stringify doesn't serialize Maps; convert at the persistence
  // boundary so the on-disk format stays a plain object.
  const serialized = {
    ...config,
    profiles: Object.fromEntries(config.profiles),
  };
  await writeFile(tmpPath, `${JSON.stringify(serialized, null, 2)}\n`, { mode: 0o600 });
  await chmod(tmpPath, 0o600);
  await rename(tmpPath, path);
  await chmod(path, 0o600);
}

export async function saveProfile(
  profileName: string,
  apiKey: string,
  secretApiKey: string,
  makeActive = true,
): Promise<ConfigFile> {
  const name = validateProfileName(profileName || DEFAULT_PROFILE);
  const config = await readConfig();
  const now = new Date().toISOString();
  const existing = config.profiles.get(name);
  config.profiles.set(name, {
    apiKey,
    secretApiKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (makeActive) config.activeProfile = name;
  await writeConfig(config);
  return config;
}

export async function deleteProfile(profileName: string): Promise<ConfigFile> {
  const name = validateProfileName(profileName || DEFAULT_PROFILE);
  const config = await readConfig();
  config.profiles.delete(name);
  if (config.activeProfile === name) {
    const nextProfile = config.profiles.keys().next().value;
    if (nextProfile) {
      config.activeProfile = nextProfile;
    } else {
      delete config.activeProfile;
    }
  }
  await writeConfig(config);
  return config;
}

export async function listProfiles(): Promise<
  Array<{ name: string; active: boolean; updatedAt: string }>
> {
  const config = await readConfig();
  return Array.from(config.profiles, ([name, profile]) => ({
    name,
    active: name === config.activeProfile,
    updatedAt: profile.updatedAt,
  }));
}

export async function resolveCredentials(
  input: CredentialInput,
  required: boolean,
): Promise<Credentials | undefined> {
  const env = input.env ?? process.env;

  if (input.apiKey || input.secretApiKey) {
    if (!input.apiKey || !input.secretApiKey) {
      throw new CliError({
        kind: "auth",
        message: "Both --api-key and --secret-api-key are required when either is supplied.",
      });
    }
    return {
      apiKey: input.apiKey,
      secretApiKey: input.secretApiKey,
      source: "flags",
    };
  }

  const envApiKey = env.PORKBUN_API_KEY;
  const envSecretApiKey = env.PORKBUN_SECRET_API_KEY;
  if (envApiKey || envSecretApiKey) {
    if (!envApiKey || !envSecretApiKey) {
      throw new CliError({
        kind: "auth",
        message:
          "Both PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY are required when either is supplied.",
      });
    }
    return {
      apiKey: envApiKey,
      secretApiKey: envSecretApiKey,
      source: "env",
    };
  }

  const config = await readConfig();
  const profileName = validateProfileName(input.profile ?? config.activeProfile ?? DEFAULT_PROFILE);
  const profile = config.profiles.get(profileName);
  if (profile) {
    return {
      apiKey: profile.apiKey,
      secretApiKey: profile.secretApiKey,
      source: "profile",
      profile: profileName,
    };
  }

  if (!required) return undefined;

  throw new CliError({
    kind: "auth",
    message:
      "Porkbun credentials were not found. Set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY, pass --api-key/--secret-api-key, or run porkbun auth login.",
  });
}

export async function configFileMode(): Promise<string | undefined> {
  try {
    // Same operator-controlled env source as the read/write above.
    const info = await stat(configPath());
    return `0${(info.mode & 0o777).toString(8)}`;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseConfig(value: unknown): ConfigFile {
  if (!isRecord(value) || (value.profiles !== undefined && !isRecord(value.profiles))) {
    throw new Error("Config must contain a profiles object.");
  }

  const profiles = new Map<string, Profile>();
  for (const [name, profile] of Object.entries(value.profiles ?? {})) {
    validateProfileName(name);
    if (!isProfile(profile)) throw new Error(`Profile '${name}' is malformed.`);
    profiles.set(name, profile);
  }

  const activeProfile =
    value.activeProfile === undefined
      ? undefined
      : validateProfileName(String(value.activeProfile));
  return activeProfile !== undefined ? { activeProfile, profiles } : { profiles };
}

function validateProfileName(value: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value) ||
    value === "__proto__" ||
    value === "prototype" ||
    value === "constructor"
  ) {
    throw new CliError({
      kind: "usage",
      message: "Profile names must be 1-64 letters, numbers, dots, underscores, or hyphens.",
    });
  }
  return value;
}

function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.apiKey === "string" &&
    typeof value.secretApiKey === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
