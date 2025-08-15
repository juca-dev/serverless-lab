import { createHash } from "crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

export function getSubfolders(dir: string): string[] {
  return readdirSync(dir).filter((name) =>
    lstatSync(join(dir, name)).isDirectory()
  );
}

/**
 * Recursively get all file paths from a directory, ignoring node_modules and hidden files/folders.
 * @param dir The root directory to scan.
 * @param arrayOfFiles Internal param, do not set manually.
 */
function getAllFiles(dir: string, arrayOfFiles: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (lstatSync(fullPath).isDirectory()) {
      // Skip node_modules and hidden directories
      if (file === "node_modules" || file.startsWith(".")) continue;
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Skip hidden files
      if (file.startsWith(".")) continue;
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

/**
 * Generate a SHA-256 hash for all files in the specified directory.
 * Ignores node_modules and hidden files.
 * Useful for checking if Lambda code has changed.
 * @param dir The directory to hash.
 * @returns Hex string with the directory content hash.
 */
export function getDirectoryHash(dir: string): string {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`Directory not found: ${dir}`);
  }
  const files = getAllFiles(dir).sort(); // Consistent order
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(readFileSync(file));
    hash.update(file); // Optional: include file path in hash for extra robustness
  }
  return hash.digest("hex");
}
