import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const backendRootDir = path.resolve(currentDir, "..", "..");
export const uploadsDir = path.resolve(backendRootDir, "uploads");
export const privateUploadsDir = path.resolve(backendRootDir, "private_uploads");
