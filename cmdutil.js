// src/cmdutil.ts
var LogType = /* @__PURE__ */ ((LogType2) => {
  LogType2[LogType2["DEBUG"] = 0] = "DEBUG";
  LogType2[LogType2["LOG"] = 1] = "LOG";
  LogType2[LogType2["WARN"] = 2] = "WARN";
  LogType2[LogType2["ERROR"] = 3] = "ERROR";
  return LogType2;
})(LogType || {});
var logFunc = (type, content) => {
  switch (type) {
    case 0 /* DEBUG */:
      console.debug(content);
      break;
    case 1 /* LOG */:
      console.log(content);
      break;
    case 2 /* WARN */:
      console.warn(content);
      break;
    case 3 /* ERROR */:
      console.error(content);
      break;
  }
};
var noLog = false;
function setLogFunc(f) {
  logFunc = f;
}
function getLogFunc() {
  return logFunc;
}
function setNoLog(v) {
  noLog = v;
}
function getNoLog() {
  return noLog;
}
function debug(content) {
  if (noLog)
    return;
  logFunc(0 /* DEBUG */, content);
}
function log(content) {
  if (noLog)
    return;
  logFunc(1 /* LOG */, content);
}
function warn(content) {
  if (noLog)
    return;
  logFunc(2 /* WARN */, content);
}
function error(content) {
  if (noLog)
    return;
  logFunc(3 /* ERROR */, content);
}
export {
  LogType,
  debug,
  error,
  getLogFunc,
  getNoLog,
  log,
  setLogFunc,
  setNoLog,
  warn
};
//# sourceMappingURL=cmdutil.js.map
