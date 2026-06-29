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
function setLogFunc(f) {
  logFunc = f;
}
function log(content) {
  if (noLog)
    return;
  logFunc(1 /* LOG */, content);
}
function error(content) {
  if (noLog)
    return;
  logFunc(3 /* ERROR */, content);
}

// src/util.ts
function concatUint8Arrays(arr, toBuffer, noRealloc = false) {
  const totalLength = arr.reduce((a, e) => a + e.byteLength, 0);
  let reallocated = false;
  if (toBuffer && toBuffer.byteLength < totalLength) {
    if (noRealloc)
      throw new Error("buffer size is insufficient and reallocation is disallowed");
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
function appendUint8Array(dst, src, noRealloc = false) {
  return concatUint8Arrays([dst, src], dst.buffer, noRealloc);
}
function allocUint8Array(size) {
  return new Uint8Array(new ArrayBuffer(size), 0, 0);
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
  get currentSize() {
    return this.arr.length;
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
async function* getTsFromM3U8(url, queueCallback, maxCache = 10, fetchOptions) {
  async function backgroundFetcher(urls2, queue2) {
    for (const i in urls2) {
      await queue2.put(await getURLAsUint8Array(urls2[i]));
      queueCallback?.({
        currentSlice: Number(i),
        currentSize: queue2.currentSize,
        maxSize: queue2.maxSize
      });
    }
  }
  const m3u8Content = await getURLAsText(url, fetchOptions);
  const queue = new Queue(maxCache);
  const urls = m3u8Content.split(/\n/).filter((l) => l && !l.startsWith("#")).map((e) => new URL(e, url));
  backgroundFetcher(urls, queue);
  for (const i in urls) {
    yield {
      buffer: await queue.get(),
      currentSlice: Number(i),
      totalSlice: urls.length
    };
    queueCallback?.({
      currentSlice: null,
      currentSize: queue.currentSize,
      maxSize: queue.maxSize
    });
  }
}

// src/worker/worker-type.ts
var isNode = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";

// src/worker/wrapper.ts
var fs;
var os;
var path;
var workerThreads;
if (isNode) {
  fs = await import("node:fs");
  os = await import("node:os");
  path = await import("node:path");
  workerThreads = await import("node:worker_threads");
}
var DecryptWorkerWrapper = class {
  worker;
  callbacks = [];
  constructor(errorCallback = (e) => {
  }) {
    if (isNode) {
      let workerFilename = null;
      const joiner = (e) => path.join(import.meta.dirname, e);
      for (const i of [
        "../worker/worker.ts",
        // running from repo
        "../worker/worker.js",
        // running from build
        "./worker.js"
        // bundled
      ]) {
        try {
          fs.accessSync(joiner(i));
        } catch (e) {
          continue;
        }
        workerFilename = i;
        break;
      }
      if (workerFilename === null)
        throw new Error("Worker file not found; check you've downloaded all required files correctly.");
      const options = {};
      if (workerFilename.endsWith(".ts"))
        options.execArgv = "-r tsx".split(/ /);
      this.worker = new workerThreads.Worker(joiner(workerFilename), options);
      this.worker.on("message", (e) => {
        this.onMessage(e);
      });
      this.worker.on("error", errorCallback);
    } else {
      this.worker = new Worker("js/worker/worker.js", { type: "module" });
      this.worker.addEventListener("message", (e) => {
        this.onMessage(e);
      });
      this.worker.addEventListener("error", errorCallback);
    }
  }
  sendMessage(type, payload, transferArr = []) {
    if (!this.worker)
      throw new Error("Worker has died");
    this.worker.postMessage({ type, payload }, transferArr);
  }
  onMessage(e) {
    const d = isNode ? e : e.data;
    switch (d.type) {
      case 0 /* WANT_DECRYPT */:
      case 2 /* PUSH_WORKER_ENCRYPTED_BUFFER */:
      case 4 /* FINISH_DECRYPT */:
        error("this message is not intended to be sent to the main thread");
        break;
      case 1 /* CAN_PUSH_ENCRYPTED_BUFFER */:
        this.callbacks.shift()?.[0]();
        break;
      case 3 /* PUSH_MAIN_THREAD_DECRYPTED_BUFFER */:
        this.callbacks.shift()?.[0](d.payload.buffer);
        break;
      case 5 /* FINISH_DESTROYING */:
        this.callbacks.shift()?.[0]();
        break;
      case 7 /* DECRYPT_ERROR */:
        this.callbacks.shift()?.[1](d.payload.message);
        break;
    }
  }
  startDecrypt() {
    return new Promise((resolve, reject) => {
      this.callbacks.push([resolve, reject]);
      this.sendMessage(0 /* WANT_DECRYPT */);
    });
  }
  endDecrypt() {
    return new Promise((resolve, reject) => {
      this.callbacks.push([resolve, reject]);
      this.sendMessage(4 /* FINISH_DECRYPT */);
    });
  }
  terminate() {
    if (!this.worker)
      throw new Error("Worker has died");
    const r = this.worker.terminate();
    this.worker = null;
    return Promise.resolve(r);
  }
  decryptTsBuffer(buffer) {
    return new Promise((resolve, reject) => {
      this.callbacks.push([resolve, reject]);
      this.sendMessage(
        2 /* PUSH_WORKER_ENCRYPTED_BUFFER */,
        { buffer, isNALU: false },
        [buffer.buffer]
      );
    });
  }
  decryptNALU(buffer) {
    return new Promise((resolve, reject) => {
      this.callbacks.push([resolve, reject]);
      this.sendMessage(
        2 /* PUSH_WORKER_ENCRYPTED_BUFFER */,
        { buffer, isNALU: true },
        [buffer.buffer]
      );
    });
  }
};

// src/web/web-decrypt-script.ts
var MAX_TS_CHUNK_SIZE = 1073741824;
var MAX_TS_FILE_SIZE = 2147483647;
var newURL = null;
var canDecrypt = true;
var inputFile = document.getElementById("input-file");
var inputGUID = document.getElementById("input-guid");
var maxBufferSlice = document.getElementById("max-buffer-slices");
var form = document.getElementById("form");
var logs = document.getElementById("logs");
var tsBufferStatus = document.getElementById("tsbuffer-status");
var decryptStatus = document.getElementById("decrypt-status");
var tsBufferStatusText = document.getElementById("tsbuffer-status-text");
var decryptStatusText = document.getElementById("decrypt-status-text");
var failure = document.getElementById("failure");
var success = document.getElementById("success");
var failureReason = document.getElementById("failure-reason");
var successFileLink = document.getElementById("success-file-link");
var decryptWorkerWrapper = new DecryptWorkerWrapper(
  (e) => {
    console.error(e);
    alert("Worker \u51FA\u73B0\u9519\u8BEF");
    canDecrypt = false;
  }
);
function setLogEntry(message) {
  logs.textContent = message;
}
function clearLogEntry() {
  logs.textContent = "";
}
function setBufferStatus(current, total) {
  tsBufferStatus.value = current;
  tsBufferStatus.max = total;
  tsBufferStatusText.textContent = `${current} / ${total}`;
}
function clearBufferStatus() {
  tsBufferStatus.value = 0;
  tsBufferStatus.max = 1;
  tsBufferStatusText.textContent = "";
}
function setDecryptStatus(current, total) {
  decryptStatus.value = current;
  decryptStatus.max = total;
  decryptStatusText.textContent = `${current} / ${total}`;
}
function clearDecryptStatus() {
  decryptStatus.value = 0;
  decryptStatus.max = 1;
  decryptStatusText.textContent = "";
}
function resetStatus() {
}
function setSuccess(filelink, filename) {
  success.classList.remove("nodisplay");
  failure.classList.add("nodisplay");
  successFileLink.href = newURL = filelink;
  successFileLink.download = filename;
  resetStatus();
}
function setFailure(reason) {
  failure.classList.remove("nodisplay");
  success.classList.add("nodisplay");
  failureReason.textContent = reason;
  resetStatus();
}
function reset() {
  clearLogEntry();
  clearBufferStatus();
  clearDecryptStatus();
  failure.classList.add("nodisplay");
  success.classList.add("nodisplay");
  resetStatus();
}
setLogFunc((type, message) => {
  switch (type) {
    case 0 /* DEBUG */:
      break;
    case 1 /* LOG */:
      setLogEntry(`\u63D0\u793A\uFF1A${message}`);
      break;
    case 2 /* WARN */:
      setLogEntry(`\u8B66\u544A\uFF1A${message}`);
      break;
    case 3 /* ERROR */:
      setLogEntry(`\u9519\u8BEF\uFF1A${message}`);
      break;
  }
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!canDecrypt) {
    alert("Worker \u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u8FDB\u884C\u89E3\u5BC6");
    return;
  }
  const file = inputFile.files?.[0] ?? null;
  const guid = inputGUID.value;
  if (!file && !guid) {
    alert("\u5FC5\u987B\u6307\u5B9A\u6587\u4EF6\u6216\u8005 GUID\uFF01");
    return;
  }
  if (newURL) {
    URL.revokeObjectURL(newURL);
    newURL = null;
  }
  try {
    await decryptWorkerWrapper.startDecrypt();
  } catch (e2) {
    alert(e2);
    return;
  }
  reset();
  if (guid) {
    let estimatedPerSliceSize = null;
    let decryptBuffers = [];
    try {
      for await (const { buffer, currentSlice, totalSlice } of getTsFromM3U8(
        await getM3U8FromGUID(
          guid,
          Number(new FormData(form).get("resolution"))
        ),
        (e2) => {
          setBufferStatus(e2.currentSize, e2.maxSize);
          if (e2.currentSlice !== null)
            log(`downloading slice ${e2.currentSlice}.ts...`);
        },
        Number(maxBufferSlice.value) ?? 10
      )) {
        setDecryptStatus(currentSlice, totalSlice);
        let decBuf = await decryptWorkerWrapper.decryptTsBuffer(buffer);
        if (!decryptBuffers.length || decryptBuffers.at(-1).byteLength + decBuf.byteLength > MAX_TS_CHUNK_SIZE) {
          let size = decBuf.byteLength;
          if (estimatedPerSliceSize === null)
            estimatedPerSliceSize = size;
          let allocSize = Math.min(
            estimatedPerSliceSize * (totalSlice - currentSlice),
            MAX_TS_CHUNK_SIZE
          );
          if (decryptBuffers.length) {
            const lastBuf = decryptBuffers.at(-1);
            const lastBufRemainSize = lastBuf.buffer.byteLength - lastBuf.byteLength;
            decryptBuffers[decryptBuffers.length - 1] = appendUint8Array(lastBuf, decBuf.subarray(0, lastBufRemainSize), true);
            decBuf = decBuf.subarray(lastBufRemainSize);
            size -= lastBufRemainSize;
          }
          while (size) {
            let buf = allocUint8Array(allocSize);
            buf = appendUint8Array(buf, decBuf, true);
            decryptBuffers.push(buf);
            size -= Math.min(size, allocSize);
          }
        } else
          decryptBuffers[decryptBuffers.length - 1] = appendUint8Array(decryptBuffers.at(-1), decBuf);
      }
      setSuccess(URL.createObjectURL(new Blob(decryptBuffers)), `${guid}.ts`);
    } catch (e2) {
      setFailure(e2);
      await decryptWorkerWrapper.endDecrypt();
      return;
    }
  } else if (file) {
    if (file.size >= MAX_TS_FILE_SIZE) {
      alert("\u4E0D\u53EF\u89E3\u5BC6\u5927\u4E8E 2 GiB \u7684\u89C6\u9891\uFF01\u8BF7\u4F7F\u7528 GUID \u89E3\u5BC6\u6A21\u5F0F\uFF01");
      return;
    }
    log("decrypting...");
    try {
      let decBuf = await decryptWorkerWrapper.decryptTsBuffer(await file.bytes());
      setSuccess(URL.createObjectURL(new Blob([decBuf])), file.name);
    } catch (e2) {
      setFailure(e2);
      await decryptWorkerWrapper.endDecrypt();
      return;
    }
  }
  await decryptWorkerWrapper.endDecrypt();
});
//# sourceMappingURL=web-decrypt-script.js.map
