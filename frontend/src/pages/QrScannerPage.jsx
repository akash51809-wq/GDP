import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  QrCode,
  Upload,
  Camera,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Ticket,
  CreditCard,
  FileText,
  AlertCircle,
  RefreshCw,
  X
} from "lucide-react";
import { API } from "../apiConfig";
import "./QrScannerPage.css";

function authHeaders() {
  const token = localStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function QrScannerPage() {
  const [filePreview, setFilePreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [decodedResult, setDecodedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(API + "/api/qr/scans", {
        credentials: "include",
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.scans)) {
        setHistory(data.scans);
      }
    } catch (e) {
      console.error("Load QR history error:", e);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
    return () => {
      stopCamera();
    };
  }, []);

  async function saveScanToBackend(rawText, name, dataUrl) {
    try {
      const res = await fetch(API + "/api/qr/save", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          rawText,
          fileName: name,
          imageBase64: dataUrl || ""
        })
      });
      const data = await res.json();
      if (res.ok && data.scan) {
        setDecodedResult(data.scan);
        loadHistory();
      }
    } catch (err) {
      console.error("Save QR scan error:", err);
    }
  }

  function processImageFile(file) {
    if (!file) return;
    setErrorMsg("");
    setScanning(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setFilePreview(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });

        setScanning(false);
        if (code && code.data) {
          saveScanToBackend(code.data, file.name, dataUrl);
        } else {
          // Try with inversion
          const codeInverted = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "onlyInvert"
          });
          if (codeInverted && codeInverted.data) {
            saveScanToBackend(codeInverted.data, file.name, dataUrl);
          } else {
            setErrorMsg("No readable QR code found in this image. Please upload a clearer image.");
          }
        }
      };
      img.onerror = () => {
        setScanning(false);
        setErrorMsg("Failed to load image file.");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInputChange(e) {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  }

  async function startCamera() {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        setIsCameraActive(true);
        scanCameraFrame();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Camera access not available or permission denied.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsCameraActive(false);
  }

  function scanCameraFrame() {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanCameraFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      const snapshot = canvas.toDataURL("image/jpeg", 0.85);
      setFilePreview(snapshot);
      stopCamera();
      saveScanToBackend(code.data, `Camera-Scan-${Date.now()}.jpg`, snapshot);
    } else {
      animationFrameRef.current = requestAnimationFrame(scanCameraFrame);
    }
  }

  function copyText(txt) {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteScan(id) {
    try {
      await fetch(`${API}/api/qr/scans/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders()
      });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (decodedResult?.id === id) {
        setDecodedResult(null);
      }
    } catch (err) {
      console.error("Delete scan error:", err);
    }
  }

  function resetScanner() {
    setFilePreview(null);
    setFileName("");
    setDecodedResult(null);
    setErrorMsg("");
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="content qr-scanner-page">
      <div className="module-page-header">
        <div>
          <div className="eyebrow">SMART TICKET & PAYMENT DECODER</div>
          <h1>
            QR Code Reader <span>✦</span>
          </h1>
          <p>
            Upload any QR code image (IRCTC ticket, payment UPI, or receipt) to automatically decode,
            extract railway data, and store in MongoDB.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="settings-reset" onClick={loadHistory} disabled={loadingHistory}>
            <RefreshCw size={13} className={loadingHistory ? "spin" : ""} /> Refresh
          </button>
          {filePreview && (
            <button className="settings-reset" onClick={resetScanner}>
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="qr-grid">
        {/* Upload / Camera Card */}
        <section className="qr-card">
          <div className="qr-card-head">
            <h2>
              <QrCode size={20} color="#38bdf8" /> Scan QR Image
            </h2>
            <button
              className="qr-copy-btn"
              onClick={isCameraActive ? stopCamera : startCamera}
              type="button"
            >
              <Camera size={14} /> {isCameraActive ? "Stop Camera" : "Use Camera"}
            </button>
          </div>

          {isCameraActive ? (
            <div className="qr-preview-box">
              <video ref={videoRef} style={{ width: "100%", maxHeight: "280px" }} />
            </div>
          ) : !filePreview ? (
            <div
              className="qr-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <div className="qr-dropzone-icon">
                <Upload size={28} />
              </div>
              <p>
                <b>Click to upload</b> or drag & drop QR image
              </p>
              <small>Supports JPG, JPEG, PNG, WEBP files</small>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div>
              <div className="qr-preview-box">
                <img src={filePreview} alt="Uploaded QR" />
              </div>
              <div className="qr-preview-actions">
                <button
                  className="save-btn"
                  style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Choose Different Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileInputChange}
                />
              </div>
            </div>
          )}

          {scanning && (
            <div style={{ color: "#38bdf8", textAlign: "center", fontSize: "0.88rem" }}>
              Scanning & decoding QR image...
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#f87171",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem"
              }}
            >
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}
        </section>

        {/* Decoded Output Card */}
        <section className="qr-card">
          <div className="qr-card-head">
            <h2>
              <CheckCircle2 size={20} color="#4ade80" /> Extracted Information
            </h2>
            {decodedResult && (
              <span className="qr-saved-tag">
                <CheckCircle2 size={13} /> Stored in MongoDB
              </span>
            )}
          </div>

          {decodedResult ? (
            <div className="qr-result-box">
              <div className="qr-badge-row">
                <span className={`qr-type-badge ${decodedResult.qrType}`}>
                  {decodedResult.qrType === "RAILWAY_TICKET" && <Ticket size={12} />}
                  {decodedResult.qrType === "UPI_PAYMENT" && <CreditCard size={12} />}
                  {decodedResult.qrType === "URL" && <ExternalLink size={12} />}
                  {decodedResult.qrType === "TEXT" && <FileText size={12} />}
                  {decodedResult.qrType?.replace("_", " ")}
                </span>
                <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                  ID: {decodedResult.id}
                </small>
              </div>

              {/* Structured Fields */}
              <div className="qr-detail-grid">
                {decodedResult.pnr && (
                  <div className="qr-detail-item">
                    <small>PNR Number</small>
                    <span style={{ color: "#38bdf8", letterSpacing: "1px" }}>
                      {decodedResult.pnr}
                    </span>
                  </div>
                )}
                {decodedResult.parsedData?.trainNumber && (
                  <div className="qr-detail-item">
                    <small>Train Number</small>
                    <span>{decodedResult.parsedData.trainNumber}</span>
                  </div>
                )}
                {decodedResult.parsedData?.journeyDate && (
                  <div className="qr-detail-item">
                    <small>Journey Date</small>
                    <span>{decodedResult.parsedData.journeyDate}</span>
                  </div>
                )}
                {decodedResult.parsedData?.payeeName && (
                  <div className="qr-detail-item">
                    <small>Payee Name</small>
                    <span>{decodedResult.parsedData.payeeName}</span>
                  </div>
                )}
                {decodedResult.parsedData?.payeeVpa && (
                  <div className="qr-detail-item">
                    <small>UPI VPA</small>
                    <span>{decodedResult.parsedData.payeeVpa}</span>
                  </div>
                )}
                {decodedResult.parsedData?.amount != null && (
                  <div className="qr-detail-item">
                    <small>Amount</small>
                    <span style={{ color: "#4ade80" }}>₹{decodedResult.parsedData.amount}</span>
                  </div>
                )}
                <div className="qr-detail-item">
                  <small>Scanned At</small>
                  <span>{new Date(decodedResult.scannedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Raw QR Text Box */}
              <div className="qr-raw-box">
                <div className="qr-raw-box-head">
                  <small>RAW DECODED DATA</small>
                  <button className="qr-copy-btn" onClick={() => copyText(decodedResult.rawText)}>
                    {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="qr-raw-text">{decodedResult.rawText}</p>
              </div>

              {decodedResult.driveViewLink && (
                <a
                  href={decodedResult.driveViewLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#38bdf8",
                    fontSize: "0.85rem",
                    textDecoration: "none"
                  }}
                >
                  <ExternalLink size={14} /> View uploaded image in Google Drive
                </a>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "48px 20px",
                color: "#64748b",
                textAlign: "center"
              }}
            >
              <QrCode size={42} strokeWidth={1.2} />
              <p style={{ margin: 0, fontSize: "0.92rem" }}>
                Upload or capture a QR code image to preview its extracted details here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* History Table */}
      <section className="qr-history-table-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", margin: 0, color: "#f1f5f9" }}>
              Scanned QR Code History
            </h2>
            <small style={{ color: "#64748b" }}>
              All records stored permanently in your MongoDB database
            </small>
          </div>
          <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            Total: <b>{history.length}</b> records
          </span>
        </div>

        {history.length === 0 ? (
          <div className="qr-empty-history">
            No scanned QR codes yet. Upload a QR code above to start storing records.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="qr-history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>PNR / Reference</th>
                  <th>Preview Content</th>
                  <th>Date & Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((scan) => (
                  <tr key={scan.id}>
                    <td>
                      <span className={`qr-type-badge ${scan.qrType}`}>
                        {scan.qrType?.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <b>{scan.pnr || scan.parsedData?.trainNumber || scan.id}</b>
                    </td>
                    <td style={{ maxWidth: "340px", wordBreak: "break-all" }}>
                      <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                        {scan.rawText.length > 80 ? scan.rawText.slice(0, 80) + "..." : scan.rawText}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      {new Date(scan.scannedAt || scan.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="qr-action-icon-btn"
                          title="View Details"
                          style={{ color: "#38bdf8" }}
                          onClick={() => setDecodedResult(scan)}
                        >
                          <ExternalLink size={15} />
                        </button>
                        <button
                          className="qr-action-icon-btn"
                          title="Delete Record"
                          onClick={() => deleteScan(scan.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
