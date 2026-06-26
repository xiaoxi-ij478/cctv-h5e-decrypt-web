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
  WorkerMessageType
};
//# sourceMappingURL=web-decrypt-worker-type.js.map
