//
// Util Module
//

// Parse and return JWT decoded integration credentials
function parseJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}
exports.parseJwt = parseJwt;

// Abbreviate Device Id
function shortName(deviceId) {
  return `${deviceId.slice(0, 8)}...${deviceId.slice(-8)}`;
}
exports.shortName = shortName;

// Generate Unique Identifier for each Device (used in Logs)
function uniqueId(d, deviceId) {
  const result = deviceId.slice(-4);
  const existing = Object.keys(d).map((j) => d[j].id).includes(result);
  if (!existing) return result;
  return uniqueId(d, deviceId.slice(0, deviceId.length - 1));
}
exports.uniqueId = uniqueId;

function versionCheck(target, source) {
  const reg = /^\D*(?<MAJOR>\d*)\.(?<MINOR>\d*)\.(?<EXTRA>\d*)\.(?<BUILD>\d*).*$/i;
  const x = (reg.exec(source)).groups;
  const y = (reg.exec(target)).groups;
  if (Number(x.MAJOR) > Number(y.MAJOR)) return true;
  if (Number(x.MAJOR) < Number(y.MAJOR)) return false;
  if (Number(x.MINOR) > Number(y.MINOR)) return true;
  if (Number(x.MINOR) < Number(y.MINOR)) return false;
  if (Number(x.EXTRA) > Number(y.EXTRA)) return true;
  if (Number(x.EXTRA) < Number(y.EXTRA)) return false;
  if (Number(x.BUILD) > Number(y.BUILD)) return true;
  if (Number(x.BUILD) < Number(y.BUILD)) return false;
  return false;
}
exports.versionCheck = versionCheck;
