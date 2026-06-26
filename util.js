// src/util.ts
import * as cmdutil from "./cmdutil.js";
function arrayEquals(a, b) {
  return a.length === b.length && a.every((el, idx) => el === b.at(idx));
}
function checkNumberEqual(val, expected, errorMsg = "value mismatch", raiseError = true) {
  if (val !== expected) {
    if (raiseError)
      throw new Error(errorMsg);
    else
      cmdutil.warn(errorMsg);
  }
}
function checkNumberNotEqual(val, unexpected, errorMsg = "value unexpected", raiseError = true) {
  if (val === unexpected) {
    if (raiseError)
      throw new Error(errorMsg);
    else
      cmdutil.warn(errorMsg);
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
  cmdutil.log(`got guid "${guid}"`);
  const videoInfo = await getURLAsJSON(
    `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}`,
    fetchOptions
  );
  if (videoInfo.ack === "no")
    throw new Error(`invalid guid "${guid}"`);
  const ret = videoInfo.manifest.hls_h5e_url.replace(/main/g, resolution.toString()).replace(/\?.*/, "");
  cmdutil.log(`got link "${ret}"`);
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
export {
  appendUint8Array,
  arrayEquals,
  checkNumberEqual,
  checkNumberNotEqual,
  concatUint8Arrays,
  getM3U8FromGUID,
  getM3U8FromWebPage,
  getTsFromM3U8,
  getURLAsJSON,
  getURLAsText,
  getURLAsUint8Array
};
//# sourceMappingURL=util.js.map
