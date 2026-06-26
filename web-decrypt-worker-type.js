var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/util.ts
var util_exports = {};
__export(util_exports, {
  appendUint8Array: () => appendUint8Array,
  arrayEquals: () => arrayEquals,
  checkNumberEqual: () => checkNumberEqual,
  checkNumberNotEqual: () => checkNumberNotEqual,
  concatUint8Arrays: () => concatUint8Arrays,
  getM3U8FromGUID: () => getM3U8FromGUID,
  getM3U8FromWebPage: () => getM3U8FromWebPage,
  getTsFromM3U8: () => getTsFromM3U8,
  getURLAsJSON: () => getURLAsJSON,
  getURLAsText: () => getURLAsText,
  getURLAsUint8Array: () => getURLAsUint8Array
});

// src/cmdutil.ts
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

// src/util.ts
function arrayEquals(a, b) {
  return a.length === b.length && a.every((el, idx) => el === b.at(idx));
}
function checkNumberEqual(val, expected, errorMsg = "value mismatch", raiseError = true) {
  if (val !== expected) {
    if (raiseError)
      throw new Error(errorMsg);
    else
      warn(errorMsg);
  }
}
function checkNumberNotEqual(val, unexpected, errorMsg = "value unexpected", raiseError = true) {
  if (val === unexpected) {
    if (raiseError)
      throw new Error(errorMsg);
    else
      warn(errorMsg);
  }
}
function concatUint8Arrays(arr, toBuffer) {
  const totalLength = arr.reduce((a, e) => a + e.byteLength, 0);
  let reallocated = false;
  if (toBuffer && toBuffer.byteLength < totalLength) {
    reallocated = true;
    toBuffer = new ArrayBuffer(totalLength);
  }
  const newArr = new Uint8Array(
    toBuffer ?? new ArrayBuffer(totalLength),
    0,
    totalLength
  );
  arr.reduce(
    (a, e) => {
      newArr.set(e, a);
      return a + e.byteLength;
    },
    0
  );
  return newArr;
}
function appendUint8Array(dst, src) {
  return concatUint8Arrays([dst, src], dst.buffer);
}
async function getURLAsUint8Array(url, fetchOptions) {
  const response = await fetch(url, fetchOptions);
  if (!response.ok)
    throw new Error(`URL returned error: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function getURLAsText(url, fetchOptions) {
  const response = await fetch(url, fetchOptions);
  if (!response.ok)
    throw new Error(`URL returned error: ${response.status} ${response.statusText}`);
  return await response.text();
}
async function getURLAsJSON(url, fetchOptions) {
  const response = await fetch(url, fetchOptions);
  if (!response.ok)
    throw new Error(`URL returned error: ${response.status} ${response.statusText}`);
  return await response.json();
}
async function getM3U8FromWebPage(url, resolution, fetchOptions) {
  if (!Number.isInteger(resolution))
    throw new Error("resolution not integer");
  const webpageContent = await getURLAsText(url, fetchOptions);
  let guid;
  for (const line of webpageContent.split("\n")) {
    if (!line.match(/var\s+(?:video_)?guid\s*=/))
      continue;
    guid = line.replace(/.*(["'])(.*)\1.*/, "$2");
    break;
  }
  if (!guid)
    throw new Error("no guid found in webpage provided");
  return await getM3U8FromGUID(guid, resolution, fetchOptions);
}
async function getM3U8FromGUID(guid, resolution, fetchOptions) {
  if (!Number.isInteger(resolution))
    throw new Error("resolution not integer");
  log(`got guid "${guid}"`);
  const videoInfo = await getURLAsJSON(
    `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}`,
    fetchOptions
  );
  if (videoInfo.ack === "no")
    throw new Error(`invalid guid "${guid}"`);
  const ret = videoInfo.manifest.hls_h5e_url.replace(/main/g, resolution.toString()).replace(/\?.*/, "");
  log(`got link "${ret}"`);
  return ret;
}
var Queue = class {
  arr = [];
  getPromiseResolves = [];
  putPromiseResolves = [];
  maxSize;
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }
  async get() {
    if (!this.arr.length)
      await new Promise(
        (resolve) => this.getPromiseResolves.push(resolve)
      );
    this.putPromiseResolves.shift()?.();
    return this.arr.shift();
  }
  async put(el) {
    if (this.arr.length >= this.maxSize)
      await new Promise(
        (resolve) => this.putPromiseResolves.push(resolve)
      );
    this.getPromiseResolves.shift()?.();
    this.arr.push(el);
  }
};
async function backgroundFetcher(urls, queue) {
  for (const i in urls)
    await queue.put(await getURLAsUint8Array(new URL(urls[i][0], urls[i][1])));
}
async function* getTsFromM3U8(url, fetchOptions) {
  const m3u8Content = await getURLAsText(url, fetchOptions);
  const queue = new Queue();
  const urls = m3u8Content.split(/\n/).filter((l) => l && !l.match(/^#/)).map((e) => [e, url]);
  backgroundFetcher(urls, queue);
  for (let i = 0; i < urls.length; i++)
    yield [await queue.get(), urls.length];
}

// src/web-decrypt-worker-type.ts
var WorkerMessageType = /* @__PURE__ */ ((WorkerMessageType2) => {
  WorkerMessageType2[WorkerMessageType2["WANT_DECRYPT_BUFFER"] = 0] = "WANT_DECRYPT_BUFFER";
  WorkerMessageType2[WorkerMessageType2["WANT_DECRYPT_GUID"] = 1] = "WANT_DECRYPT_GUID";
  WorkerMessageType2[WorkerMessageType2["CAN_PUSH_ENCRYPTED_BUFFER"] = 2] = "CAN_PUSH_ENCRYPTED_BUFFER";
  WorkerMessageType2[WorkerMessageType2["PUSH_WORKER_ENCRYPTED_BUFFER"] = 3] = "PUSH_WORKER_ENCRYPTED_BUFFER";
  WorkerMessageType2[WorkerMessageType2["PUSH_BROWSER_DECRYPTED_BUFFER"] = 4] = "PUSH_BROWSER_DECRYPTED_BUFFER";
  WorkerMessageType2[WorkerMessageType2["FINISH_DECRYPT_BUFFER"] = 5] = "FINISH_DECRYPT_BUFFER";
  WorkerMessageType2[WorkerMessageType2["DECRYPT_ERROR"] = 6] = "DECRYPT_ERROR";
  WorkerMessageType2[WorkerMessageType2["REPORT_DEBUG"] = 7] = "REPORT_DEBUG";
  WorkerMessageType2[WorkerMessageType2["REPORT_LOG"] = 8] = "REPORT_LOG";
  WorkerMessageType2[WorkerMessageType2["REPORT_WARN"] = 9] = "REPORT_WARN";
  WorkerMessageType2[WorkerMessageType2["REPORT_ERROR"] = 10] = "REPORT_ERROR";
  return WorkerMessageType2;
})(WorkerMessageType || {});
export {
  WorkerMessageType,
  util_exports as util
};
//# sourceMappingURL=web-decrypt-worker-type.js.map
