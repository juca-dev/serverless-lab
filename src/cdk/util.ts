import { lstatSync, readdirSync } from "fs";
import { join } from "path";

export function getSubfolders(dir: string): string[] {
  return readdirSync(dir).filter((name) =>
    lstatSync(join(dir, name)).isDirectory()
  );
}
