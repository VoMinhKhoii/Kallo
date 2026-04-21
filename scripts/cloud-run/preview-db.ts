#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const PREVIEW_BRANCH_PATTERN = /^pr-(\d+)$/;

type CommandRunner = (
  command: string,
  args: string[],
  options?: {
    env?: NodeJS.ProcessEnv;
  }
) => CommandResult;

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface BranchEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  POSTGRES_URL_NON_POOLING: string;
}

interface PreparePreviewBranchOptions {
  prNumber: number | string;
  sha: string;
  seedFile: string;
  gcsSeedBucket: string;
  gcsSeedObject: string;
  githubEnvPath: string;
  run?: CommandRunner;
  appendGithubEnv?: (path: string, values: Record<string, string>) => void;
}

const prepareSchema = z.object({
  prNumber: z.coerce.number().int().positive(),
  sha: z.string().min(1),
  seedFile: z.string().min(1),
  gcsSeedBucket: z.string().min(1),
  gcsSeedObject: z.string().min(1),
  githubEnvPath: z.string().min(1),
});

const cleanupSchema = z.object({
  prNumber: z.coerce.number().int().positive(),
});

const cleanupOrphansSchema = z.object({
  openPrNumbers: z.array(z.string().regex(/^\d+$/)),
});

function defaultRun(
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv }
): CommandResult {
  const result = spawnSync(command, args, {
    env: options?.env ?? process.env,
    encoding: 'utf8',
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function defaultAppendGithubEnv(
  path: string,
  values: Record<string, string>
): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload = `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
  appendFileSync(path, payload, 'utf8');
}

function formatCommandFailure(
  command: string,
  args: string[],
  result: CommandResult
): Error {
  const details = [result.stderr.trim(), result.stdout.trim()]
    .filter(Boolean)
    .join('\n');

  return new Error(
    details || `Command failed: ${[command, ...args].join(' ')}`
  );
}

function ensureCommandSucceeded(
  command: string,
  args: string[],
  result: CommandResult
): void {
  if (result.exitCode !== 0) {
    throw formatCommandFailure(command, args, result);
  }
}

function isMissingBranch(result: CommandResult): boolean {
  if (result.exitCode === 0) return false;

  const output = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return (
    output.includes('not found') ||
    output.includes('does not exist') ||
    output.includes('no branch')
  );
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length)
    : trimmed;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex <= 0) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function extractPreviewBranches(raw: string): string[] {
  return Array.from(new Set(raw.match(/\bpr-\d+\b/g) ?? []));
}

function parseOptionMap(args: string[]): Record<string, string[]> {
  const options: Record<string, string[]> = {};

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = [...(options[key] ?? []), 'true'];
      continue;
    }

    options[key] = [...(options[key] ?? []), next];
    i++;
  }

  return options;
}

function getOption(
  options: Record<string, string[]>,
  key: string
): string | undefined {
  return options[key]?.at(-1);
}

function getOptionValues(
  options: Record<string, string[]>,
  key: string
): string[] {
  return options[key] ?? [];
}

export function buildBranchName(prNumber: number | string): string {
  return `pr-${Number(prNumber)}`;
}

export function buildPreviewImageTag(
  prNumber: number | string,
  sha: string
): string {
  const { GCP_REGION, GCP_PROJECT_ID, GCP_ARTIFACT_REPO } = process.env;
  const baseImage =
    GCP_REGION && GCP_PROJECT_ID && GCP_ARTIFACT_REPO
      ? `${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPO}/nham`
      : 'nham';

  return `${baseImage}:${buildBranchName(prNumber)}-${sha}`;
}

export function parseBranchEnv(raw: string): BranchEnv {
  const parsed = Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => parseEnvLine(line))
      .filter((entry): entry is [string, string] => entry !== null)
  );

  const env = z
    .object({
      SUPABASE_URL: z.string().min(1),
      SUPABASE_ANON_KEY: z.string().min(1),
      POSTGRES_URL_NON_POOLING: z.string().min(1),
    })
    .safeParse(parsed);

  if (!env.success) {
    throw new Error('Supabase branch env output is missing required values');
  }

  return env.data;
}

export function selectOrphanPreviewBranches(
  branchNames: string[],
  openPrNumbers: string[]
): string[] {
  const openPrSet = new Set(openPrNumbers);

  return branchNames.filter((branchName) => {
    const match = branchName.match(PREVIEW_BRANCH_PATTERN);
    return match ? !openPrSet.has(match[1]) : false;
  });
}

async function deletePreviewBranch(
  branchName: string,
  run: CommandRunner,
  tolerateMissing: boolean
): Promise<boolean> {
  const command = 'supabase';
  const args = ['--experimental', 'branches', 'delete', branchName, '--yes'];
  const result = run(command, args);

  if (result.exitCode === 0) {
    return true;
  }

  if (tolerateMissing && isMissingBranch(result)) {
    return false;
  }

  throw formatCommandFailure(command, args, result);
}

export async function preparePreviewBranch(
  options: PreparePreviewBranchOptions
): Promise<{
  branchName: string;
  createdBranch: boolean;
  imageTag: string;
  env: BranchEnv;
}> {
  const parsed = prepareSchema.parse(options);
  const run = options.run ?? defaultRun;
  const appendGithubEnv = options.appendGithubEnv ?? defaultAppendGithubEnv;
  const branchName = buildBranchName(parsed.prNumber);
  const imageTag = buildPreviewImageTag(parsed.prNumber, parsed.sha);

  let createdBranch = false;
  const getArgs = [
    '--experimental',
    'branches',
    'get',
    branchName,
    '-o',
    'env',
  ];
  let getResult = run('supabase', getArgs);

  if (getResult.exitCode !== 0) {
    if (!isMissingBranch(getResult)) {
      throw formatCommandFailure('supabase', getArgs, getResult);
    }

    ensureCommandSucceeded(
      'supabase',
      ['--experimental', 'branches', 'create', branchName],
      run('supabase', ['--experimental', 'branches', 'create', branchName])
    );

    createdBranch = true;
    getResult = run('supabase', getArgs);
  }

  ensureCommandSucceeded('supabase', getArgs, getResult);

  let shouldCleanupSeedFile = false;
  let branchEnv: BranchEnv | undefined;

  try {
    branchEnv = parseBranchEnv(getResult.stdout);
    appendGithubEnv(parsed.githubEnvPath, {
      SUPABASE_URL: branchEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: branchEnv.SUPABASE_ANON_KEY,
      POSTGRES_URL_NON_POOLING: branchEnv.POSTGRES_URL_NON_POOLING,
      BRANCH_NAME: branchName,
      CREATED_BRANCH: String(createdBranch),
      IMAGE_TAG: imageTag,
    });

    ensureCommandSucceeded(
      'supabase',
      ['db', 'push', '--db-url', branchEnv.POSTGRES_URL_NON_POOLING],
      run('supabase', [
        'db',
        'push',
        '--db-url',
        branchEnv.POSTGRES_URL_NON_POOLING,
      ])
    );

    if (createdBranch) {
      mkdirSync(dirname(parsed.seedFile), { recursive: true });
      shouldCleanupSeedFile = true;
      ensureCommandSucceeded(
        'gcloud',
        [
          'storage',
          'cp',
          `gs://${parsed.gcsSeedBucket}/${parsed.gcsSeedObject}`,
          parsed.seedFile,
        ],
        run('gcloud', [
          'storage',
          'cp',
          `gs://${parsed.gcsSeedBucket}/${parsed.gcsSeedObject}`,
          parsed.seedFile,
        ])
      );

      ensureCommandSucceeded(
        'psql',
        [
          branchEnv.POSTGRES_URL_NON_POOLING,
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          parsed.seedFile,
        ],
        run('psql', [
          branchEnv.POSTGRES_URL_NON_POOLING,
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          parsed.seedFile,
        ])
      );
    }
  } catch (error) {
    if (createdBranch) {
      try {
        await deletePreviewBranch(branchName, run, true);
      } catch {
        // best-effort cleanup by spec
      }
    }

    throw error;
  } finally {
    if (shouldCleanupSeedFile) {
      rmSync(parsed.seedFile, { force: true });
    }
  }

  return {
    branchName,
    createdBranch,
    imageTag,
    env: branchEnv!,
  };
}

async function cleanupPreviewBranch(prNumber: number | string): Promise<void> {
  await deletePreviewBranch(buildBranchName(prNumber), defaultRun, true);
}

async function cleanupOrphanPreviewBranches(openPrNumbers: string[]): Promise<{
  deletedBranches: string[];
}> {
  const listArgs = ['--experimental', 'branches', 'list'];
  const listResult = defaultRun('supabase', listArgs);
  ensureCommandSucceeded('supabase', listArgs, listResult);

  const branchNames = extractPreviewBranches(listResult.stdout);
  const orphanBranches = selectOrphanPreviewBranches(
    branchNames,
    openPrNumbers
  );

  for (const branchName of orphanBranches) {
    await deletePreviewBranch(branchName, defaultRun, true);
  }

  return { deletedBranches: orphanBranches };
}

function printUsage(): void {
  console.error(`Usage:
  bun scripts/cloud-run/preview-db.ts prepare --pr <number> --sha <sha> --seed-file <path>
  bun scripts/cloud-run/preview-db.ts cleanup --pr-number <number>
  bun scripts/cloud-run/preview-db.ts cleanup-orphans --open-pr <number> [--open-pr <number> ...]
  bun scripts/cloud-run/preview-db.ts cleanup-orphans --open-prs 1,2,3`);
}

async function main(): Promise<void> {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (!subcommand) {
    printUsage();
    process.exit(1);
  }

  const optionMap = parseOptionMap(rest);

  switch (subcommand) {
    case 'prepare': {
      const args = prepareSchema.parse({
        prNumber:
          getOption(optionMap, 'pr') ?? getOption(optionMap, 'pr-number'),
        sha: getOption(optionMap, 'sha'),
        seedFile: getOption(optionMap, 'seed-file'),
        gcsSeedBucket:
          getOption(optionMap, 'gcs-seed-bucket') ??
          process.env.GCS_SEED_BUCKET,
        gcsSeedObject:
          getOption(optionMap, 'gcs-seed-object') ??
          process.env.GCS_SEED_OBJECT,
        githubEnvPath:
          getOption(optionMap, 'github-env') ?? process.env.GITHUB_ENV,
      });

      const result = await preparePreviewBranch(args);
      console.log(
        JSON.stringify({
          branchName: result.branchName,
          createdBranch: result.createdBranch,
          imageTag: result.imageTag,
        })
      );
      return;
    }

    case 'cleanup': {
      const args = cleanupSchema.parse({
        prNumber: getOption(optionMap, 'pr-number'),
      });

      await cleanupPreviewBranch(args.prNumber);
      return;
    }

    case 'cleanup-orphans': {
      const csvNumbers =
        getOption(optionMap, 'open-prs')
          ?.split(',')
          .map((value) => value.trim())
          .filter(Boolean) ?? [];
      const args = cleanupOrphansSchema.parse({
        openPrNumbers: [
          ...getOptionValues(optionMap, 'open-pr'),
          ...csvNumbers,
        ],
      });

      const result = await cleanupOrphanPreviewBranches(args.openPrNumbers);
      console.log(JSON.stringify(result));
      return;
    }

    default:
      printUsage();
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
