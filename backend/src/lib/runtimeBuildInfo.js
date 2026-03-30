function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function getRuntimeBuildInfo() {
  const commitSha = firstNonEmpty(
    process.env.APP_COMMIT_SHA,
    process.env.COMMIT_SHA,
    process.env.GIT_COMMIT,
    process.env.GITHUB_SHA
  );

  const buildTime = firstNonEmpty(
    process.env.APP_BUILD_TIME,
    process.env.BUILD_TIME
  );

  const revision = firstNonEmpty(process.env.K_REVISION, process.env.GA_REVISION);
  const service = firstNonEmpty(process.env.K_SERVICE, process.env.GA_SERVICE, "app-souza-cass-backend");
  const configuration = firstNonEmpty(process.env.K_CONFIGURATION, process.env.GA_CONFIGURATION);
  const region = firstNonEmpty(process.env.FUNCTION_REGION, process.env.GOOGLE_CLOUD_REGION, process.env.GCLOUD_REGION);
  const projectId = firstNonEmpty(process.env.GOOGLE_CLOUD_PROJECT, process.env.GCLOUD_PROJECT, process.env.PROJECT_ID);

  return {
    service,
    revision,
    configuration,
    region,
    projectId,
    commitSha: commitSha || "unknown",
    shortCommitSha: commitSha ? commitSha.slice(0, 7) : "unknown",
    buildTime: buildTime || "unknown",
    nodeEnv: String(process.env.NODE_ENV || "development"),
    appVersion: String(process.env.npm_package_version || "unknown"),
  };
}

