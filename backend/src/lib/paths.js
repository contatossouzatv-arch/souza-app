import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const backendRootDir = path.resolve(currentDir, "..", "..");
export const uploadsDir = path.resolve(backendRootDir, "uploads");
export const privateUploadsDir = path.resolve(backendRootDir, "private_uploads");
export const genericUploadsDir = env.genericUploadsDir
  ? path.isAbsolute(env.genericUploadsDir)
    ? path.resolve(env.genericUploadsDir)
    : path.resolve(backendRootDir, env.genericUploadsDir)
  : uploadsDir;
