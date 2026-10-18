import type { TestProject } from "vitest/node";
import { adminUrlFromEnv, buildTemplate, dropDatabase } from "./harness";

declare module "vitest" {
  export interface ProvidedContext {
    adminUrl: string;
    templateDb: string;
  }
}

/** Builds the migrated + seeded template once; each test clones it (CREATE DATABASE ... TEMPLATE). */
export default async function setup(project: TestProject) {
  const adminUrl = adminUrlFromEnv();
  const templateDb = `wasel_test_tpl_${process.pid}`;

  const started = Date.now();
  await buildTemplate(adminUrl, templateDb);
  console.log(`[db] template ${templateDb} built in ${Date.now() - started} ms`);

  project.provide("adminUrl", adminUrl);
  project.provide("templateDb", templateDb);

  return async () => {
    await dropDatabase(adminUrl, templateDb);
  };
}
