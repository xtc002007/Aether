export function toLatestBundleName(bundleName) {
  return bundleName.replace(/_(\d+\.\d+\.\d+(?:\.\d+)?)_/, "_latest_");
}

export function getS3ReleaseUrl(appId, bundleName) {
  const bucket = process.env.S3_RELEASES_BUCKET || "nexustools-website-static";
  const region = process.env.AWS_REGION || "us-east-2";
  const latestName = toLatestBundleName(bundleName);
  return `https://${bucket}.s3.${region}.amazonaws.com/releases/${appId}/latest/${latestName}`;
}
