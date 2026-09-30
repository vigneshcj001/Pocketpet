// Confirm the executable that restarted, rather than assuming an installer succeeded.
const versionFromBuild = (identity) => typeof identity === "string"
  ? /^PocketPet (\S+) · build /.exec(identity)?.[1] ?? "" : "";
const version = (value) => typeof value === "string" && /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
  ? value.replace(/^v/, "") : "";

export function updateConfirmation(pending, identity) {
  const target = version(pending?.targetVersion);
  const before = version(versionFromBuild(pending?.fromIdentity));
  const current = version(versionFromBuild(identity));
  if (!target || !before || !current) return null;
  return { target, current, installed: current === target && current !== before && identity !== pending.fromIdentity };
}
